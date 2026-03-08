// Shared contract addresses and ABIs for configuration scripts
import { ethers } from "ethers";
import "dotenv/config";

// ============================================================
//                    CONTRACT ADDRESSES
// ============================================================

export const CONTRACTS = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ProtocolConfig: "0x0a41e67c838192944F0F7FA93943b48c517af20e",
  TokenValidator: "0xe0CA16261405CA12F156E2F3A0B309d9587B9e4D",
  PriceOracle: "0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08",
  RiskEngine: "0xc5E0fDDB27bB10Efb341654dAbeA55d3Cc09870F",
  CollateralManager: "0x180dcc27C5923c6FEeD4Fd4f210c6F1fE0A812c5",
  LiquidationEngine: "0x6e892AEadda28E630bbe84e469fdA25f1B1B4820",
  OrderBook: "0x400Abe15172CE78E51c33aE1b91F673004dB2315",
  LoanManager: "0x356e137F8F93716e1d92F66F9e2d4866C586d9cf",
  UniswapV3Adapter: "0x43215Df48f040CD5A76ed2a19b9e27E62308b1DC",
  AerodromeAdapter: "0x06578CB045e2c588f9b204416d5dbf5e689A2639",
  AerodromeAdapterCL: "0x51e7a5E748fFd0889F14f5fAd605441900d0DA27",
  RiskGuardian: "0xb9b90eE151D53327c1C42a268Eb974A08f1E07Ef",
  ReserveFund: "0xDD4a6B527598B31dBcC760B58811278ceF9A3A13",
};

// ============================================================
//              TOKEN REGISTRY (Base Mainnet)
// ============================================================

export const TOKENS = {
  WETH: {
    address: "0x4200000000000000000000000000000000000006",
    symbol: "WETH",
    decimals: 18,
    chainlinkFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", // ETH/USD on Base
    tier: "A",
  },
  cbETH: {
    address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    symbol: "cbETH",
    decimals: 18,
    chainlinkFeed: "0xd7818272B9e248357d13057AAb0B417aF31E817d", // cbETH/USD on Base
    tier: "A",
  },
  DAI: {
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    symbol: "DAI",
    decimals: 18,
    chainlinkFeed: "0x591e79239a7d679378eC8c847e5038150364C78F", // DAI/USD on Base
    tier: "A",
  },
  USDbC: {
    address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
    symbol: "USDbC",
    decimals: 6,
    chainlinkFeed: "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B", // USDC/USD on Base (same peg)
    tier: "A",
  },
  LINK: {
    address: "0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196",
    symbol: "LINK",
    decimals: 18,
    chainlinkFeed: "0x17CAb8FE31E32f08326e5E27412894e49B0f9D65", // LINK/USD on Base
    tier: "B",
  },
  UNI: {
    address: "0xc3De830EA07524a0761646a6a4e4be0e114a3C83",
    symbol: "UNI",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000", // No Chainlink on Base — use TWAP
    tier: "C",
  },
  CYPR: {
    address: "0xD262A4c7108C8139b2B189758e8D17c3DFC91a38",
    symbol: "CYPR",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "D",
  },
  REI: {
    address: "0x6b2504a03ca4d43d0d73776f6ad46dab2f2a4cfd",
    symbol: "REI",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "D",
  },
  AVNT: {
    address: "0x696f9436b67233384889472cd7cd58a6fb5df4f1",
    symbol: "AVNT",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "D",
  },
  GHST: {
    address: "0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb",
    symbol: "GHST",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "C",
  },
  VFY: {
    address: "0xa749de6c28262b7ffbc5de27dc845dd7ecd2b358",
    symbol: "VFY",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "D",
  },
  ZRO: {
    address: "0x6985884c4392d348587b19cb9eaaf157f13271cd",
    symbol: "ZRO",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "B",
  },
  TIG: {
    address: "0x0c03ce270b4826ec62e7dd007f0b716068639f7b",
    symbol: "TIG",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "C",
  },
  BID: {
    address: "0xa1832f7f4e534ae557f9b5ab76de54b1873e498b",
    symbol: "BID",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "D",
  },
  MAMO: {
    address: "0x7300b37dfdfab110d83290a29dfb31b1740219fe",
    symbol: "MAMO",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "D",
  },
  GIZA: {
    address: "0x590830dfdf9a3f68afcdde2694773debdf267774",
    symbol: "GIZA",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "D",
  },
  MOCA: {
    address: "0x2b11834ed1feaed4b4b3a86a6f571315e25a884d",
    symbol: "MOCA",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "B",
  },
  AVAIL: {
    address: "0xd89d90d26b48940fa8f58385fe84625d468e057a",
    symbol: "AVAIL",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "C",
  },
  KTA: {
    address: "0xc0634090f2fe6c6d75e61be2b949464abb498973",
    symbol: "KTA",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "D",
  },
  BRETT: {
    address: "0x532f27101965dd16442e59d40670faf5ebb142e4",
    symbol: "BRETT",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "D",
  },
  VIRTUAL: {
    address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b",
    symbol: "VIRTUAL",
    decimals: 18,
    chainlinkFeed: "0x0000000000000000000000000000000000000000",
    tier: "D",
  },
};

// ============================================================
//                      RISK TIERS
// ============================================================

export const RISK_TIERS = {
  A: { ltvBps: 4000, liquidationBps: 6000, label: ">150M market cap" },
  B: { ltvBps: 3500, liquidationBps: 5500, label: ">100M market cap" },
  C: { ltvBps: 3000, liquidationBps: 5000, label: ">50M market cap" },
  D: { ltvBps: 2500, liquidationBps: 5000, label: ">20M market cap" },
};

// Default max exposure per token: 100,000 USDC
export const DEFAULT_MAX_EXPOSURE = ethers.parseUnits("100000", 6);

// ============================================================
//                     DEX ROUTERS (Base)
// ============================================================

export const ROUTERS = {
  uniswapV3: "0x2626664c2603336E57B271c5C0b26F421741e481",   // Uniswap V3 SwapRouter02 on Base
  aerodrome: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",   // Aerodrome Router on Base
};

// ============================================================
//                     MINIMAL ABIs
// ============================================================

export const TokenValidatorABI = [
  "function whitelistToken(address token) external",
  "function blacklistToken(address token) external",
  "function whitelistedTokens(address) view returns (bool)",
  "function blacklistedTokens(address) view returns (bool)",
  "function validateToken(address token) view returns (bool valid, string reason)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function RISK_MANAGER_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function renounceRole(bytes32 role, address account) external",
];

export const PriceOracleABI = [
  "function setPriceFeed(address token, address chainlinkFeed, uint8 tokenDecimals) external",
  "function updateTwapPrice(address token, uint256 price) external",
  "function batchUpdateTwapPrices(address[] tokens, uint256[] prices) external",
  "function getPrice(address token) view returns (uint256 price, bool confidence)",
  "function getValueInUsdc(address token, uint256 amount) view returns (uint256)",
  "function priceFeeds(address) view returns (address chainlinkFeed, uint8 chainlinkDecimals, uint256 twapPrice, uint256 lastTwapUpdate, uint8 tokenDecimals, bool isActive)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function ADMIN_ROLE() view returns (bytes32)",
  "function PRICE_UPDATER_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function renounceRole(bytes32 role, address account) external",
];

export const RiskEngineABI = [
  "function setTokenRiskParams(address token, uint256 ltvBps, uint256 liquidationThresholdBps, uint256 maxExposure) external",
  "function tokenRiskParams(address) view returns (uint256 ltvBps, uint256 liquidationThresholdBps, uint256 maxExposure, bool isActive)",
  "function currentExposure(address) view returns (uint256)",
  "function pausedTokens(address) view returns (bool)",
  "function calculateHealthFactor(address token, uint256 collateralAmount, uint256 debtUsdc) view returns (uint256)",
  "function isLiquidatable(address token, uint256 collateralAmount, uint256 debtUsdc) view returns (bool)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function RISK_MANAGER_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function renounceRole(bytes32 role, address account) external",
];

export const ProtocolConfigABI = [
  "function initializeRouters(address _primary, address _fallback) external",
  "function proposePrimaryRouter(address router) external",
  "function executePrimaryRouter() external",
  "function proposeFallbackRouter(address router) external",
  "function executeFallbackRouter() external",
  "function primaryRouter() view returns (address)",
  "function fallbackRouter() view returns (address)",
  "function treasury() view returns (address)",
  "function usdc() view returns (address)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function ADMIN_ROLE() view returns (bytes32)",
  "function RISK_MANAGER_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function renounceRole(bytes32 role, address account) external",
];

export const LiquidationEngineABI = [
  "function setPrimaryRouter(address router) external",
  "function setFallbackRouter(address router) external",
  "function primaryRouter() view returns (address)",
  "function fallbackRouter() view returns (address)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function ADMIN_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function renounceRole(bytes32 role, address account) external",
];

export const CollateralManagerABI = [
  "function totalCollateral(address) view returns (uint256)",
  "function getLockedCollateral(uint256 loanId, address token) view returns (uint256)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function renounceRole(bytes32 role, address account) external",
];

export const LoanManagerABI = [
  "function nextLoanId() view returns (uint256)",
  "function getLoan(uint256 loanId) view returns (tuple(uint256 loanId, address lender, address borrower, uint256 principal, address collateralToken, uint256 collateralAmount, uint256 startTimestamp, uint8 duration, uint8 status, uint256 interestPaid, uint256 repaidAt))",
  "function getCurrentDebt(uint256 loanId) view returns (uint256 totalDebt, uint256 interest)",
  "function getLoanHealthFactor(uint256 loanId) view returns (uint256)",
  "function isLoanLiquidatable(uint256 loanId) view returns (bool expired, bool undercollateralized)",
  "function liquidateLoan(uint256 loanId, uint256 minAmountOut) external",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function ADMIN_ROLE() view returns (bytes32)",
  "function LIQUIDATOR_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function renounceRole(bytes32 role, address account) external",
];

export const OrderBookABI = [
  "function nextLendingOrderId() view returns (uint256)",
  "function nextBorrowRequestId() view returns (uint256)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function renounceRole(bytes32 role, address account) external",
];

// ============================================================
//                     HELPER: GET SIGNER
// ============================================================

export function getProvider() {
  const rpc = process.env.BASE_RPC_URL;
  if (!rpc) throw new Error("BASE_RPC_URL not set in .env");
  return new ethers.JsonRpcProvider(rpc);
}

export function getSigner() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");
  return new ethers.Wallet(pk, getProvider());
}
