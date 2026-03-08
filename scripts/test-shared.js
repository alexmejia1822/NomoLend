/**
 * Test Shared - Utilidades y ABIs compartidas para scripts de testing en Base Mainnet
 * IMPORTANTE: Estos scripts usan fondos REALES en mainnet. Solo cantidades pequenas.
 */
import { ethers } from "ethers";
import "dotenv/config";
import { CONTRACTS, getSigner, getProvider } from "./shared.js";

// Re-export
export { CONTRACTS, getSigner, getProvider };

// ============================================================
//                     TOKENS DE TEST
// ============================================================

export const USDC_ADDRESS = CONTRACTS.USDC;
export const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
export const CYPR_ADDRESS = "0xD262A4c7108C8139b2B189758e8D17c3DFC91a38";

// Registro de tokens colaterales soportados para testing
export const COLLATERAL_TOKENS = {
  CYPR: { address: CYPR_ADDRESS, symbol: "CYPR", decimals: 18 },
  WETH: { address: WETH_ADDRESS, symbol: "WETH", decimals: 18 },
};

// Token activo por defecto (cambiar aqui o pasar por CLI: TOKEN=CYPR node script.js)
// Tambien soporta direccion directa: TOKEN=0x1234... node script.js
export function getActiveToken() {
  const key = (process.env.TOKEN || "CYPR");
  // Si es una direccion hex, crear token entry dinamico
  if (key.startsWith("0x") && key.length === 42) {
    const decimals = parseInt(process.env.TOKEN_DECIMALS || "18");
    const symbol = process.env.TOKEN_SYMBOL || "CUSTOM";
    return { address: key, symbol, decimals };
  }
  const token = COLLATERAL_TOKENS[key.toUpperCase()];
  if (!token) throw new Error(`Token "${key}" no soportado. Usa: ${Object.keys(COLLATERAL_TOKENS).join(", ")} o una direccion 0x...`);
  return token;
}

// ============================================================
//                     ABIs COMPLETAS
// ============================================================

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) external returns (bool)",
];

export const ORDERBOOK_ABI = [
  "function createLendingOrder(uint256 amount, uint8 duration) external returns (uint256 orderId)",
  "function cancelLendingOrder(uint256 orderId) external",
  "function getLendingOrder(uint256 orderId) view returns (tuple(address lender, uint256 totalAmount, uint256 availableAmount, uint8 duration, uint8 status, uint256 createdAt))",
  "function createBorrowRequest(uint256 requestedAmount, address collateralToken, uint256 collateralAmount, uint8 duration) external returns (uint256 requestId)",
  "function cancelBorrowRequest(uint256 requestId) external",
  "function getBorrowRequest(uint256 requestId) view returns (tuple(address borrower, uint256 requestedAmount, uint256 filledAmount, address collateralToken, uint256 collateralAmount, uint256 collateralAllocated, uint8 duration, uint8 status, uint256 createdAt))",
  "function nextLendingOrderId() view returns (uint256)",
  "function nextBorrowRequestId() view returns (uint256)",
  "function activeOrderCount(address) view returns (uint256)",
  "function maxActiveOrdersPerUser() view returns (uint256)",
  "function getUserLendingOrders(address user) view returns (uint256[])",
  "function getUserBorrowRequests(address user) view returns (uint256[])",
  "function usdc() view returns (address)",
];

export const LOANMANAGER_ABI = [
  "function takeLoan(uint256 lendingOrderId, uint256 amount, address collateralToken, uint256 collateralAmount) external returns (uint256 loanId)",
  "function fillBorrowRequest(uint256 borrowRequestId, uint256 amount) external returns (uint256 loanId)",
  "function repayLoan(uint256 loanId) external",
  "function liquidateLoan(uint256 loanId, uint256 minAmountOut) external",
  "function getLoan(uint256 loanId) view returns (tuple(uint256 loanId, address lender, address borrower, uint256 principal, address collateralToken, uint256 collateralAmount, uint256 startTimestamp, uint8 duration, uint8 status, uint256 interestPaid, uint256 repaidAt))",
  "function getCurrentDebt(uint256 loanId) view returns (uint256 totalDebt, uint256 interest)",
  "function getLoanHealthFactor(uint256 loanId) view returns (uint256)",
  "function isLoanLiquidatable(uint256 loanId) view returns (bool expired, bool undercollateralized)",
  "function nextLoanId() view returns (uint256)",
  "function getBorrowerLoans(address borrower) view returns (uint256[])",
  "function getLenderLoans(address lender) view returns (uint256[])",
  "function setPublicLiquidation(bool enabled) external",
  "function publicLiquidationEnabled() view returns (bool)",
  "function reserveFund() view returns (address)",
  "function setReserveFund(address _reserveFund) external",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function LIQUIDATOR_ROLE() view returns (bytes32)",
  "function ADMIN_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
];

export const RISKENGINE_ABI = [
  "function setTokenRiskParams(address token, uint256 ltvBps, uint256 liquidationThresholdBps, uint256 maxExposure) external",
  "function tokenRiskParams(address) view returns (uint256 ltvBps, uint256 liquidationThresholdBps, uint256 maxExposure, bool isActive)",
  "function calculateRequiredCollateral(address token, uint256 loanAmountUsdc) view returns (uint256)",
  "function calculateHealthFactor(address token, uint256 collateralAmount, uint256 debtUsdc) view returns (uint256)",
  "function isLiquidatable(address token, uint256 collateralAmount, uint256 debtUsdc) view returns (bool)",
  "function currentExposure(address) view returns (uint256)",
  "function pausedTokens(address) view returns (bool)",
  "function setTokenPaused(address token, bool paused, string reason) external",
  "function priceSnapshot(address) view returns (uint256)",
  "function snapshotTimestamp(address) view returns (uint256)",
  "function checkCircuitBreaker(address token) external returns (bool)",
  "function priceDropThresholdBps() view returns (uint256)",
  "function maxLoansPerUserPerToken() view returns (uint256)",
  "function userTokenLoanCount(address, address) view returns (uint256)",
  "function setTokenDexLiquidity(address token, uint256 liquidityUsdc) external",
  "function tokenDexLiquidity(address) view returns (uint256)",
  "function setMinDexLiquidity(address token, uint256 minLiquidity) external",
  "function getTokenRiskSummary(address token) view returns (uint256, uint256, uint256, bool, uint256, bool, uint256, uint256, uint256, uint256)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function RISK_MANAGER_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function deactivateToken(address token) external",
];

export const PRICEORACLE_ABI = [
  "function setPriceFeed(address token, address chainlinkFeed, uint8 tokenDecimals) external",
  "function updateTwapPrice(address token, uint256 price) external",
  "function batchUpdateTwapPrices(address[] tokens, uint256[] prices) external",
  "function getPrice(address token) view returns (uint256 price, bool confidence)",
  "function getValueInUsdc(address token, uint256 amount) view returns (uint256)",
  "function priceFeeds(address) view returns (address chainlinkFeed, uint8 chainlinkDecimals, uint256 twapPrice, uint256 lastTwapUpdate, uint8 tokenDecimals, bool isActive)",
  "function maxTwapChangeBps() view returns (uint256)",
  "function setMaxTwapChangeBps(uint256 bps) external",
  "function twapUpdateCooldown() view returns (uint256)",
  "function setTwapUpdateCooldown(uint256 seconds_) external",
  "function priceDeviationThresholdBps() view returns (uint256)",
  "function setDeviationThreshold(uint256 bps) external",
];

export const COLLATERALMANAGER_ABI = [
  "function getLockedCollateral(uint256 loanId, address token) view returns (uint256)",
  "function totalCollateral(address) view returns (uint256)",
];

export const LIQUIDATIONENGINE_ABI = [
  "function primaryRouter() view returns (address)",
  "function fallbackRouter() view returns (address)",
  "function setPrimaryRouter(address router) external",
  "function setFallbackRouter(address router) external",
  "function liquidateCollateral(address token, uint256 amount, uint256 minAmountOut) external returns (uint256)",
  "function distributeProceeds(address lender, address borrower, address treasury, uint256 debtAmount, uint256 platformFee, uint256 totalProceeds) external",
];

export const RESERVEFUND_ABI = [
  "function getReserveBalance() view returns (uint256)",
  "function coverBadDebt(uint256 amount, address recipient, string reason) external",
  "function usdc() view returns (address)",
];

export const PROTOCOLCONFIG_ABI = [
  "function treasury() view returns (address)",
  "function usdc() view returns (address)",
  "function calculatePlatformFee(uint256 interestAmount) view returns (uint256)",
  "function PLATFORM_FEE_BPS() view returns (uint256)",
  "function EXPIRY_PENALTY_BPS() view returns (uint256)",
];

// ============================================================
//                    HELPER FUNCTIONS
// ============================================================

/**
 * Safe approve: USDC en Base requiere resetear a 0 antes de cambiar allowance,
 * pero revierte si la allowance ya es 0. Otros tokens permiten approve directo.
 */
export async function safeApprove(token, spender, amount) {
  const owner = await token.runner.getAddress();
  const tokenAddr = await token.getAddress();
  const current = await token.allowance(owner, spender);
  const isUsdc = tokenAddr.toLowerCase() === USDC_ADDRESS.toLowerCase();
  if (current > 0n && isUsdc) {
    const tx0 = await token.approve(spender, 0n);
    await tx0.wait();
  }
  if (current !== amount) {
    const tx1 = await token.approve(spender, amount);
    await tx1.wait();
    // Espera fija para que todos los nodos RPC sincronicen (Base load balancing)
    await new Promise(r => setTimeout(r, 5000));
    return tx1;
  }
}

export function formatUsdc(amount) {
  return ethers.formatUnits(amount, 6);
}

export function parseUsdc(amount) {
  return ethers.parseUnits(amount.toString(), 6);
}

export function formatToken(amount, decimals = 18) {
  return ethers.formatUnits(amount, decimals);
}

export function parseToken(amount, decimals = 18) {
  return ethers.parseUnits(amount.toString(), decimals);
}

export function log(msg) {
  console.log(`  ${msg}`);
}

export function logSection(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);
}

export function logSuccess(msg) {
  console.log(`  [OK] ${msg}`);
}

export function logError(msg) {
  console.log(`  [ERROR] ${msg}`);
}

export function logTx(label, receipt) {
  console.log(`  [TX] ${label}: ${receipt.hash}`);
  console.log(`        Gas: ${receipt.gasUsed.toString()} | Block: ${receipt.blockNumber}`);
}

export async function logBalance(label, token, address) {
  const bal = await token.balanceOf(address);
  const sym = await token.symbol();
  const dec = await token.decimals();
  console.log(`  [BAL] ${label}: ${ethers.formatUnits(bal, dec)} ${sym}`);
  return bal;
}

// Duration enum values
export const Duration = {
  SEVEN_DAYS: 0,
  FOURTEEN_DAYS: 1,
  THIRTY_DAYS: 2,
};

// Loan status
export const LoanStatus = {
  ACTIVE: 0,
  REPAID: 1,
  LIQUIDATED: 2,
};

// Order status
export const OrderStatus = {
  OPEN: 0,
  FILLED: 1,
  CANCELLED: 2,
};

/**
 * Crea instancias de todos los contratos del protocolo
 */
export function getContracts(signer) {
  const token = getActiveToken();
  return {
    usdc: new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer),
    weth: new ethers.Contract(WETH_ADDRESS, ERC20_ABI, signer),
    cypr: new ethers.Contract(CYPR_ADDRESS, ERC20_ABI, signer),
    collateralToken: new ethers.Contract(token.address, ERC20_ABI, signer),
    collateralInfo: token,
    orderBook: new ethers.Contract(CONTRACTS.OrderBook, ORDERBOOK_ABI, signer),
    loanManager: new ethers.Contract(CONTRACTS.LoanManager, LOANMANAGER_ABI, signer),
    riskEngine: new ethers.Contract(CONTRACTS.RiskEngine, RISKENGINE_ABI, signer),
    priceOracle: new ethers.Contract(CONTRACTS.PriceOracle, PRICEORACLE_ABI, signer),
    collateralManager: new ethers.Contract(CONTRACTS.CollateralManager, COLLATERALMANAGER_ABI, signer),
    liquidationEngine: new ethers.Contract(CONTRACTS.LiquidationEngine, LIQUIDATIONENGINE_ABI, signer),
    reserveFund: new ethers.Contract(CONTRACTS.ReserveFund, RESERVEFUND_ABI, signer),
    protocolConfig: new ethers.Contract(CONTRACTS.ProtocolConfig, PROTOCOLCONFIG_ABI, signer),
  };
}

/**
 * Espera el cooldown de TWAP para poder hacer el siguiente update.
 */
// Timestamp local del ultimo update exitoso (para evitar RPC stale en lastTwapUpdate)
let _lastLocalTwapUpdate = 0;

export async function waitTwapCooldown(priceOracle, tokenAddress) {
  const cooldown = Number(await priceOracle.twapUpdateCooldown());
  const now = Math.floor(Date.now() / 1000);

  // Fuente de verdad: timestamp local (si existe), porque el RPC puede dar datos stale
  if (_lastLocalTwapUpdate > 0) {
    const elapsed = now - _lastLocalTwapUpdate;
    const remaining = cooldown - elapsed;
    if (remaining <= 0) return;
    const waitSec = remaining + 3;
    log(`Esperando cooldown TWAP (${waitSec}s)...`);
    await new Promise(resolve => setTimeout(resolve, waitSec * 1000));
    logSuccess("Cooldown completado");
    return;
  }

  // Sin timestamp local: siempre esperar cooldown completo (seguro)
  const waitSec = cooldown + 5;
  log(`Esperando cooldown TWAP (${waitSec}s)...`);
  await new Promise(resolve => setTimeout(resolve, waitSec * 1000));
  logSuccess("Cooldown completado");
}

export function markTwapUpdated() {
  _lastLocalTwapUpdate = Math.floor(Date.now() / 1000);
}

// ABIs adicionales para TokenValidator (setup de CYPR)
export const TOKENVALIDATOR_ABI = [
  "function whitelistToken(address token) external",
  "function blacklistToken(address token) external",
  "function whitelistedTokens(address) view returns (bool)",
  "function validateToken(address token) view returns (bool valid, string reason)",
];
