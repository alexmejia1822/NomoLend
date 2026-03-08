/// @notice TWAP Price Updater — fetches prices from CoinGecko + DEX pools
/// Handles cooldown, maxTwapChangeBps, gradual updates, CYPR from Aerodrome

import { ethers } from "ethers";
import {
  TOKENS, COINGECKO_IDS, DEX_PRICE_TOKENS, PRICE_UPDATE_INTERVAL, DRY_RUN,
  getSigner, getProvider, getPriceOracle, withFailover,
} from "./config.js";
import { logBotAction, logPriceUpdate, updateBotStatus, getBotControl } from "./firebase.js";
import { alertBotError } from "./alerts.js";
import { heartbeat } from "./watchdog.js";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const USDC_DECIMALS = 6;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }
}

// ============================================================
//  PRICE FROM COINGECKO (tokens with CoinGecko IDs)
// ============================================================
async function fetchCoinGeckoPrices() {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

  const data = await fetchWithRetry(url);
  const prices = {};

  for (const [symbol, cgId] of Object.entries(COINGECKO_IDS)) {
    if (data[cgId] && data[cgId].usd) {
      prices[symbol] = ethers.parseUnits(data[cgId].usd.toFixed(6), USDC_DECIMALS);
    }
  }
  return prices;
}

// ============================================================
//  PRICE FROM DEX POOL (tokens like CYPR)
// ============================================================
async function fetchDexPrice(tokenKey) {
  const info = DEX_PRICE_TOKENS[tokenKey];
  if (!info) return null;

  const provider = getProvider();
  const pool = new ethers.Contract(info.pool, info.poolAbi, provider);

  try {
    const [sqrtPriceX96] = await pool.slot0();
    const token0 = await pool.token0();

    // sqrtPriceX96 = sqrt(price) * 2^96
    // price = (sqrtPriceX96 / 2^96)^2
    const Q96 = 2n ** 96n;
    const sqrtPrice = sqrtPriceX96;

    // Determine which direction the price is
    const cyprIsToken0 = token0.toLowerCase() === info.address.toLowerCase();

    let priceUsdc;
    if (cyprIsToken0) {
      // price = token1/token0 = USDC per CYPR
      // With different decimals: price_human = (sqrtPrice/Q96)^2 * 10^(token0decimals - token1decimals)
      // CYPR(18) / USDC(6) => multiply by 10^(18-6) = 10^12
      // price in USDC 6 decimals = (sqrtPrice^2 * 10^6) / (Q96^2 * 10^12)
      // = sqrtPrice^2 / (Q96^2 * 10^6)
      const numerator = sqrtPrice * sqrtPrice;
      const denominator = Q96 * Q96;
      // Price as float to avoid precision loss
      const priceFloat = Number(numerator) / Number(denominator);
      // Adjust for decimal difference (18 - 6 = 12)
      const adjustedPrice = priceFloat / (10 ** 12);
      priceUsdc = ethers.parseUnits(adjustedPrice.toFixed(6), USDC_DECIMALS);
    } else {
      // CYPR is token1, price is inverted
      const numerator = sqrtPrice * sqrtPrice;
      const denominator = Q96 * Q96;
      const priceFloat = Number(numerator) / Number(denominator);
      // token1/token0, so CYPR price = 1/priceFloat adjusted for decimals
      const adjustedPrice = (10 ** 12) / priceFloat;
      // Cap at reasonable value
      if (adjustedPrice > 1e6) return null;
      priceUsdc = ethers.parseUnits(adjustedPrice.toFixed(6), USDC_DECIMALS);
    }

    if (priceUsdc <= 0n) return null;
    return priceUsdc;
  } catch (err) {
    console.error(`  [PriceUpdater] DEX price fetch failed for ${tokenKey}: ${err.message}`);
    return null;
  }
}

// ============================================================
//  MAIN UPDATE FUNCTION
// ============================================================
async function updatePrices() {
  const control = await getBotControl();
  if (!control.priceUpdater) {
    console.log(`[${new Date().toISOString()}] PriceUpdater DISABLED from admin panel`);
    return;
  }

  const signer = getSigner();
  const oracle = getPriceOracle(signer);

  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Fetching prices...${DRY_RUN ? " (DRY RUN)" : ""}`);
  heartbeat("priceUpdater");

  try {
    // 1. Fetch CoinGecko prices
    const cgPrices = await fetchCoinGeckoPrices();

    // 2. Fetch DEX prices (CYPR, etc.)
    for (const [symbol, info] of Object.entries(DEX_PRICE_TOKENS)) {
      const dexPrice = await fetchDexPrice(symbol);
      if (dexPrice && dexPrice > 0n) {
        cgPrices[symbol] = dexPrice;
      }
    }

    // 3. Build batch arrays
    const tokenAddrs = [];
    const priceValues = [];

    for (const [symbol, price] of Object.entries(cgPrices)) {
      // Find token address
      const token = TOKENS[symbol] || DEX_PRICE_TOKENS[symbol];
      if (!token) continue;

      // Check if price feed exists
      try {
        const feed = await oracle.priceFeeds(token.address);
        if (!feed.isActive) continue;
      } catch {
        continue;
      }

      tokenAddrs.push(token.address);
      priceValues.push(price);
      const priceStr = (Number(price) / 1e6).toFixed(6);
      console.log(`  ${symbol}: $${priceStr}`);
    }

    if (tokenAddrs.length === 0) {
      console.log("  No prices to update");
      await logBotAction("priceUpdater", "no_prices", { status: "info" });
      return;
    }

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would update ${tokenAddrs.length} prices`);
      await logBotAction("priceUpdater", "dry_run", { status: "info", details: `${tokenAddrs.length} tokens` });
      return;
    }

    // 4. Batch update with retry
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const tx = await oracle.batchUpdateTwapPrices(tokenAddrs, priceValues);
        const receipt = await tx.wait();
        console.log(`  Updated ${tokenAddrs.length} prices (tx: ${receipt.hash.slice(0, 18)}...)`);

        await logBotAction("priceUpdater", "batch_update", {
          status: "success",
          txHash: receipt.hash,
          details: `${tokenAddrs.length} tokens`,
        });

        // Log individual prices
        for (let i = 0; i < tokenAddrs.length; i++) {
          const sym = Object.entries(cgPrices).find(([, p]) => p === priceValues[i])?.[0] || "?";
          await logPriceUpdate(tokenAddrs[i], sym, priceValues[i], receipt.hash);
        }

        await updateBotStatus("priceUpdater", {
          active: true,
          lastRun: new Date().toISOString(),
          tokensUpdated: tokenAddrs.length,
        });
        break;
      } catch (txErr) {
        if (attempt === MAX_RETRIES) {
          const errMsg = txErr.reason || txErr.message?.slice(0, 120);
          console.error(`  Error updating prices: ${errMsg}`);
          await logBotAction("priceUpdater", "batch_update_failed", { status: "error", error: errMsg });
          await alertBotError("priceUpdater", errMsg);
          throw txErr;
        }
        const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
        console.log(`  Tx retry ${attempt}/${MAX_RETRIES} in ${delay}ms`);
        await sleep(delay);
      }
    }
  } catch (err) {
    console.error(`  Error in price update cycle: ${err.message}`);
  }
}

// ============================================================
//  START
// ============================================================
export async function startPriceUpdater() {
  console.log("=== Price Updater Started ===");
  console.log(`  Interval: ${PRICE_UPDATE_INTERVAL / 1000}s`);
  console.log(`  DRY_RUN: ${DRY_RUN}`);
  console.log(`  CoinGecko tokens: ${Object.keys(COINGECKO_IDS).join(", ")}`);
  console.log(`  DEX tokens: ${Object.keys(DEX_PRICE_TOKENS).join(", ")}\n`);

  await updatePrices();
  setInterval(updatePrices, PRICE_UPDATE_INTERVAL);
}

if (process.env.pm_id !== undefined || import.meta.url === `file://${process.argv[1]}`) {
  startPriceUpdater();
}
