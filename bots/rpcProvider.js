/// @notice RPC Provider with failover support
/// Falls back to secondary/tertiary RPC endpoints on failure

import { ethers } from "ethers";
import "dotenv/config";

const RPC_ENDPOINTS = [
  process.env.BASE_RPC_URL,
  process.env.BASE_RPC_URL_2 || null,
  process.env.BASE_RPC_URL_3 || null,
  "https://mainnet.base.org", // Public fallback (rate-limited)
].filter(Boolean);

let currentIndex = 0;
let currentProvider = null;

function createProvider(url) {
  return new ethers.JsonRpcProvider(url, {
    chainId: 8453,
    name: "base",
  });
}

/// @notice Get a healthy provider, cycling through endpoints on failure
export function getProvider() {
  if (!currentProvider) {
    if (RPC_ENDPOINTS.length === 0) throw new Error("No RPC endpoints configured");
    currentProvider = createProvider(RPC_ENDPOINTS[0]);
  }
  return currentProvider;
}

/// @notice Switch to the next available RPC endpoint
export function rotateProvider() {
  const oldIndex = currentIndex;
  currentIndex = (currentIndex + 1) % RPC_ENDPOINTS.length;
  currentProvider = createProvider(RPC_ENDPOINTS[currentIndex]);
  console.log(`  [RPC] Rotated from endpoint ${oldIndex} to ${currentIndex}`);
  return currentProvider;
}

/// @notice Execute an RPC call with automatic failover
export async function withFailover(fn) {
  const maxAttempts = RPC_ENDPOINTS.length;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn(getProvider());
    } catch (err) {
      const isRpcError =
        err.code === "NETWORK_ERROR" ||
        err.code === "SERVER_ERROR" ||
        err.code === "TIMEOUT" ||
        err.message?.includes("502") ||
        err.message?.includes("503") ||
        err.message?.includes("rate limit") ||
        err.message?.includes("ECONNREFUSED");

      if (!isRpcError || attempt === maxAttempts - 1) throw err;

      console.log(`  [RPC] Provider failed (${err.code || err.message?.slice(0, 50)}), rotating...`);
      rotateProvider();
    }
  }
}

/// @notice Get signer with current provider (uses BOT_PRIVATE_KEY first)
export function getSigner() {
  const pk = process.env.BOT_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("BOT_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY not set");
  return new ethers.Wallet(pk, getProvider());
}

/// @notice Get signer with failover — rotates provider and rebuilds signer
export function getSignerWithFailover() {
  const pk = process.env.BOT_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("BOT_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY not set");

  return {
    getSigner: () => new ethers.Wallet(pk, getProvider()),
    rotate: () => {
      rotateProvider();
      return new ethers.Wallet(pk, getProvider());
    },
  };
}
