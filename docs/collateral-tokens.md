# NomoLend Collateral Tokens

## Overview

NomoLend supports 21 collateral tokens on Base Mainnet, organized into four risk tiers (A through D). Each tier defines the Loan-to-Value (LTV) ratio and liquidation threshold. Tokens with higher market capitalization and deeper liquidity are assigned to lower-risk tiers with more favorable LTV ratios.

All loans are denominated in **USDC** (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).

---

## Risk Tier Summary

| Tier | Market Cap | LTV | Liquidation Threshold | Collateral per $1,000 Loan | Tokens |
|------|-----------|-----|----------------------|---------------------------|--------|
| **A** | >$150M | 40% | 60% | $2,500 | 4 |
| **B** | >$100M | 35% | 55% | $2,857 | 3 |
| **C** | >$50M | 30% | 50% | $3,333 | 5 |
| **D** | >$20M | 25% | 50% | $4,000 | 9 |

---

## Tier A Tokens

High-liquidity, established assets. LTV 40%, Liquidation at 60%.

| Token | Symbol | Address | Decimals | Chainlink Feed | Oracle |
|-------|--------|---------|----------|---------------|--------|
| Wrapped Ether | WETH | `0x4200000000000000000000000000000000000006` | 18 | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` | Chainlink + TWAP |
| Coinbase Wrapped Staked ETH | cbETH | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` | 18 | `0xd7818272B9e248357d13057AAb0B417aF31E817d` | Chainlink + TWAP |
| Dai Stablecoin | DAI | `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb` | 18 | `0x591e79239a7d679378eC8c847e5038150364C78F` | Chainlink + TWAP |
| USD Base Coin | USDbC | `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` | 6 | `0x7e860098F58bBFC8648a4311b374B1D669a2bc6B` | Chainlink + TWAP |

---

## Tier B Tokens

Mid-cap tokens with reliable price feeds. LTV 35%, Liquidation at 55%.

| Token | Symbol | Address | Decimals | Chainlink Feed | Oracle |
|-------|--------|---------|----------|---------------|--------|
| Chainlink | LINK | `0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196` | 18 | `0x17CAb8FE31E32f08326e5E27412894e49B0f9D65` | Chainlink + TWAP |
| LayerZero | ZRO | `0x6985884c4392d348587b19cb9eaaf157f13271cd` | 18 | — | TWAP only |
| Moca Network | MOCA | `0x2b11834ed1feaed4b4b3a86a6f571315e25a884d` | 18 | — | TWAP only |

---

## Tier C Tokens

Emerging tokens with moderate liquidity. LTV 30%, Liquidation at 50%.

| Token | Symbol | Address | Decimals | Chainlink Feed | Oracle |
|-------|--------|---------|----------|---------------|--------|
| Uniswap | UNI | `0xc3De830EA07524a0761646a6a4e4be0e114a3C83` | 18 | — | TWAP only |
| Virtual Protocol | VIRTUAL | `0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b` | 18 | — | TWAP only |
| Aavegotchi | GHST | `0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb` | 18 | — | TWAP only |
| Avail | AVAIL | `0xd89d90d26b48940fa8f58385fe84625d468e057a` | 18 | — | TWAP only |
| TIG | TIG | `0x0c03ce270b4826ec62e7dd007f0b716068639f7b` | 18 | — | TWAP only |

---

## Tier D Tokens

Lower-cap tokens with higher volatility. LTV 25%, Liquidation at 50%.

| Token | Symbol | Address | Decimals | Chainlink Feed | Oracle |
|-------|--------|---------|----------|---------------|--------|
| CYPR | CYPR | `0xD262A4c7108C8139b2B189758e8D17c3DFC91a38` | 18 | — | TWAP only |
| REI Network | REI | `0x6b2504a03ca4d43d0d73776f6ad46dab2f2a4cfd` | 18 | — | TWAP only |
| Aventus | AVNT | `0x696f9436b67233384889472cd7cd58a6fb5df4f1` | 18 | — | TWAP only |
| Verify | VFY | `0xa749de6c28262b7ffbc5de27dc845dd7ecd2b358` | 18 | — | TWAP only |
| Bidao | BID | `0xa1832f7f4e534ae557f9b5ab76de54b1873e498b` | 18 | — | TWAP only |
| Mamo | MAMO | `0x7300b37dfdfab110d83290a29dfb31b1740219fe` | 18 | — | TWAP only |
| Giza | GIZA | `0x590830dfdf9a3f68afcdde2694773debdf267774` | 18 | — | TWAP only |
| KTA | KTA | `0xc0634090f2fe6c6d75e61be2b949464abb498973` | 18 | — | TWAP only |
| Brett | BRETT | `0x532f27101965dd16442e59d40670faf5ebb142e4` | 18 | — | TWAP only |

---

## Oracle Architecture

```
+------------------+
|   PriceOracle    |
+--------+---------+
         |
    +----+----+
    |         |
    v         v
Chainlink   TWAP
  Feed     (Keeper)
    |         |
    v         v
  Tier A   All Tokens
  Tier B*  (updated every
  tokens    5 minutes)
```

### Dual Oracle System

Tokens with Chainlink feeds (5 tokens) use a dual-oracle approach:
1. **Primary:** Chainlink price feed (real-time, high confidence)
2. **Fallback:** TWAP price (keeper-updated every 5 minutes)

The oracle returns a `confidence` flag:
- `true` — Chainlink feed is active and fresh
- `false` — Using TWAP fallback or price is stale

### TWAP-Only Tokens

The remaining 16 tokens rely exclusively on TWAP prices updated by the keeper bot. Staleness is monitored with a 30-minute threshold. Stale prices trigger alerts and can pause lending for the affected token.

### Chainlink Feed Addresses

| Token | Feed Address |
|-------|-------------|
| WETH | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` |
| cbETH | `0xd7818272B9e248357d13057AAb0B417aF31E817d` |
| DAI | `0x591e79239a7d679378eC8c847e5038150364C78F` |
| USDbC | `0x7e860098F58bBFC8648a4311b374B1D669a2bc6B` |
| LINK | `0x17CAb8FE31E32f08326e5E27412894e49B0f9D65` |

---

## Collateral Calculation

For a loan of `P` USDC with a token at price `$X` and LTV of `L%`:

```
Required Collateral Value = P / (L / 100)
Required Collateral Tokens = Required Collateral Value / X
```

### Example: $1,000 USDC Loan

| Tier | LTV | Collateral Value | If Token = $10 | If Token = $1 |
|------|-----|-----------------|----------------|---------------|
| A | 40% | $2,500 | 250 tokens | 2,500 tokens |
| B | 35% | $2,857 | 286 tokens | 2,857 tokens |
| C | 30% | $3,333 | 333 tokens | 3,333 tokens |
| D | 25% | $4,000 | 400 tokens | 4,000 tokens |

---

## Exposure Limits

Each token has a maximum exposure limit (in USDC) set by the RiskEngine. This caps the total outstanding loan value backed by that collateral token, preventing concentration risk.

The current exposure and maximum exposure for each token can be queried on-chain:

```
RiskEngine.tokenRiskParams(tokenAddress) -> (ltvBps, liquidationThresholdBps, maxExposure, isActive)
RiskEngine.currentExposure(tokenAddress) -> uint256
```

Usage percentage is displayed in the frontend dashboard with color coding:
- Green: < 50% utilization
- Yellow: 50-80% utilization
- Red: > 80% utilization
