/// @notice Keeper service configuration
import { ethers } from "ethers";
import "dotenv/config";

// Import shared contract data
import {
  CONTRACTS, TOKENS,
  PriceOracleABI, RiskEngineABI, LoanManagerABI,
} from "../scripts/shared.js";

export { CONTRACTS, TOKENS };

// ============================================================
//                    KEEPER SETTINGS
// ============================================================

// How often to update TWAP prices (ms)
export const PRICE_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

// How often to check loan health (ms)
export const HEALTH_CHECK_INTERVAL = 60 * 1000; // 1 minute

// How often to run monitoring checks (ms)
export const MONITOR_INTERVAL = 2 * 60 * 1000; // 2 minutes

// Minimum health factor before liquidation (in BPS — 10000 = 1.0)
export const LIQUIDATION_TRIGGER_BPS = 10500; // 1.05

// Slippage tolerance for liquidation swaps (5%)
export const LIQUIDATION_SLIPPAGE_BPS = 500;

// DRY_RUN mode — no transactions, only logs
export const DRY_RUN = process.env.DRY_RUN === "true";

// Watchdog: alert if bot hasn't run in this many minutes
export const WATCHDOG_THRESHOLD_MIN = 10;

// Reserve Fund minimum balance (alert if below)
export const RESERVE_FUND_MIN_USDC = 10; // $10

// Oracle staleness threshold (seconds)
export const ORACLE_STALE_THRESHOLD = 30 * 60; // 30 minutes

// CoinGecko IDs for price fetching (free API, no key needed)
export const COINGECKO_IDS = {
  WETH: "ethereum",
  cbETH: "coinbase-wrapped-staked-eth",
  DAI: "dai",
  USDbC: "usd-coin",
  LINK: "chainlink",
  UNI: "uniswap",
  CYPR: "cypher-2",
  REI: "unit-00-rei",
  AVNT: "avantis",
  GHST: "aavegotchi",
  VFY: "zkverify",
  ZRO: "layerzero",
  TIG: "the-innovation-game",
  BID: "creatorbid",
  MAMO: "mamo",
  GIZA: "giza",
  MOCA: "mocaverse",
  AVAIL: "avail",
  KTA: "keeta",
  BRETT: "based-brett",
  VIRTUAL: "virtual-protocol",
};

// Tokens that get price from DEX pools instead of CoinGecko
// Add tokens here if they don't have a CoinGecko ID
// Example:
// export const DEX_PRICE_TOKENS = {
//   TOKEN: {
//     address: "0x...", symbol: "TOKEN", decimals: 18,
//     pool: "0x...", dex: "aerodrome-cl",
//     poolAbi: ["function slot0() view returns (uint160,int24,uint16,uint16,uint16,bool)", "function token0() view returns (address)", "function token1() view returns (address)"],
//   },
// };
export const DEX_PRICE_TOKENS = {};

// ============================================================
//                    PROVIDER & SIGNER
// ============================================================
// Uses rpcProvider.js with automatic failover between RPC endpoints

import {
  getProvider as _getProvider,
  getSigner as _getSigner,
  withFailover,
} from "./rpcProvider.js";

export { withFailover };

export function getProvider() {
  return _getProvider();
}

export function getSigner() {
  return _getSigner();
}

// ============================================================
//                    CONTRACT INSTANCES
// ============================================================

export function getPriceOracle(signerOrProvider) {
  return new ethers.Contract(CONTRACTS.PriceOracle, PriceOracleABI, signerOrProvider);
}

export function getRiskEngine(signerOrProvider) {
  return new ethers.Contract(CONTRACTS.RiskEngine, RiskEngineABI, signerOrProvider);
}

export function getLoanManager(signerOrProvider) {
  return new ethers.Contract(CONTRACTS.LoanManager, LoanManagerABI, signerOrProvider);
}
