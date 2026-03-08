// Contract addresses on Base Mainnet
export const CONTRACTS = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
  ProtocolConfig: "0x0a41e67c838192944F0F7FA93943b48c517af20e" as `0x${string}`,
  TokenValidator: "0xe0CA16261405CA12F156E2F3A0B309d9587B9e4D" as `0x${string}`,
  PriceOracle: "0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08" as `0x${string}`,
  RiskEngine: "0xc5E0fDDB27bB10Efb341654dAbeA55d3Cc09870F" as `0x${string}`,
  CollateralManager: "0x180dcc27C5923c6FEeD4Fd4f210c6F1fE0A812c5" as `0x${string}`,
  LiquidationEngine: "0x6e892AEadda28E630bbe84e469fdA25f1B1B4820" as `0x${string}`,
  OrderBook: "0x400Abe15172CE78E51c33aE1b91F673004dB2315" as `0x${string}`,
  LoanManager: "0x356e137F8F93716e1d92F66F9e2d4866C586d9cf" as `0x${string}`,
  RiskGuardian: "0xb9b90eE151D53327c1C42a268Eb974A08f1E07Ef" as `0x${string}`,
  ReserveFund: "0xDD4a6B527598B31dBcC760B58811278ceF9A3A13" as `0x${string}`,
  UniswapV3Adapter: "0x43215Df48f040CD5A76ed2a19b9e27E62308b1DC" as `0x${string}`,
  AerodromeAdapter: "0x06578CB045e2c588f9b204416d5dbf5e689A2639" as `0x${string}`,
  AerodromeCLAdapter: "0x51e7a5E748fFd0889F14f5fAd605441900d0DA27" as `0x${string}`,
} as const;

// Duration enum mapping
export const DURATIONS = {
  0: { days: 7, interest: "2%" },
  1: { days: 14, interest: "4%" },
  2: { days: 30, interest: "8%" },
} as const;

// Supported collateral tokens on Base
export const COLLATERAL_TOKENS = [
  { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" as `0x${string}`, decimals: 18 },
  { symbol: "cbETH", address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22" as `0x${string}`, decimals: 18 },
  { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" as `0x${string}`, decimals: 18 },
  { symbol: "USDbC", address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA" as `0x${string}`, decimals: 6 },
  { symbol: "LINK", address: "0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196" as `0x${string}`, decimals: 18 },
  { symbol: "UNI", address: "0xc3De830EA07524a0761646a6a4e4be0e114a3C83" as `0x${string}`, decimals: 18 },
  { symbol: "CYPR", address: "0xD262A4c7108C8139b2B189758e8D17c3DFC91a38" as `0x${string}`, decimals: 18 },
  { symbol: "REI", address: "0x6b2504a03ca4d43d0d73776f6ad46dab2f2a4cfd" as `0x${string}`, decimals: 18 },
  { symbol: "AVNT", address: "0x696f9436b67233384889472cd7cd58a6fb5df4f1" as `0x${string}`, decimals: 18 },
  { symbol: "GHST", address: "0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb" as `0x${string}`, decimals: 18 },
  { symbol: "VFY", address: "0xa749de6c28262b7ffbc5de27dc845dd7ecd2b358" as `0x${string}`, decimals: 18 },
  { symbol: "ZRO", address: "0x6985884c4392d348587b19cb9eaaf157f13271cd" as `0x${string}`, decimals: 18 },
  { symbol: "TIG", address: "0x0c03ce270b4826ec62e7dd007f0b716068639f7b" as `0x${string}`, decimals: 18 },
  { symbol: "BID", address: "0xa1832f7f4e534ae557f9b5ab76de54b1873e498b" as `0x${string}`, decimals: 18 },
  { symbol: "MAMO", address: "0x7300b37dfdfab110d83290a29dfb31b1740219fe" as `0x${string}`, decimals: 18 },
  { symbol: "GIZA", address: "0x590830dfdf9a3f68afcdde2694773debdf267774" as `0x${string}`, decimals: 18 },
  { symbol: "MOCA", address: "0x2b11834ed1feaed4b4b3a86a6f571315e25a884d" as `0x${string}`, decimals: 18 },
  { symbol: "AVAIL", address: "0xd89d90d26b48940fa8f58385fe84625d468e057a" as `0x${string}`, decimals: 18 },
  { symbol: "KTA", address: "0xc0634090f2fe6c6d75e61be2b949464abb498973" as `0x${string}`, decimals: 18 },
  { symbol: "BRETT", address: "0x532f27101965dd16442e59d40670faf5ebb142e4" as `0x${string}`, decimals: 18 },
  { symbol: "VIRTUAL", address: "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b" as `0x${string}`, decimals: 18 },
] as const;
