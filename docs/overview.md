# NomoLend Protocol Overview

## What is NomoLend?

NomoLend is a decentralized peer-to-peer (P2P) overcollateralized lending protocol deployed on **Base** (Ethereum L2). It enables direct lending relationships between individual lenders and borrowers without intermediaries, liquidity pools, or variable interest rates.

Lenders deposit USDC and earn fixed, predictable interest. Borrowers post ERC-20 collateral tokens and receive USDC loans. Every loan is isolated -- if one borrower defaults, it affects only the lender of that specific loan, not the broader protocol.

---

## P2P Lending vs. Pool-Based Lending

Traditional DeFi lending protocols such as Aave and Compound use shared liquidity pools. Depositors supply assets into a common pool, and borrowers draw from that pool. Interest rates float based on pool utilization, and all depositors share the risk of undercollateralized positions.

NomoLend takes a fundamentally different approach:

```
    POOL-BASED (Aave/Compound)              P2P (NomoLend)
    ========================               ================

    Lender A ─┐                            Lender A ──── Borrower A
    Lender B ──┼── [ Pool ] ──┬── Borrower A    (isolated loan)
    Lender C ─┘               └── Borrower B
                                           Lender B ──── Borrower B
    * Shared risk                              (isolated loan)
    * Variable rates
    * Pool utilization determines APY      * No shared risk
                                           * Fixed rates
                                           * Each loan independent
```

### Advantages of P2P Lending

| Feature | Pool-Based (Aave/Compound) | P2P (NomoLend) |
|---------|---------------------------|----------------|
| **Risk Isolation** | All lenders share default risk | Each loan is isolated; one default does not affect others |
| **Interest Rates** | Variable, determined by utilization curves | Fixed bracket rates: 2%, 4%, or 8% |
| **Predictability** | Returns fluctuate with market conditions | Returns known at loan creation |
| **Impermanent Loss** | Possible in some pool designs | None -- USDC in, USDC out |
| **Counterparty Choice** | Protocol assigns counterparties | Lenders and borrowers choose each other |
| **Capital Efficiency** | Idle capital earns reduced rates | Capital only deployed when matched |
| **Liquidation Impact** | Can cascade across the pool | Contained to a single loan |

---

## Protocol Summary

| Property | Value |
|----------|-------|
| **Version** | v1.1 |
| **Network** | Base Mainnet (Chain ID: 8453) |
| **Status** | Live |
| **Website** | [https://nomolend.com](https://nomolend.com) |
| **Source Code** | [https://github.com/alexmejia1822/NomoLend](https://github.com/alexmejia1822/NomoLend) |
| **Lending Currency** | USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) |
| **Governance** | 2-of-3 Gnosis Safe Multisig (`0x362D5267A61f65cb4901B163B5D94adbf147DB87`) |
| **Smart Contracts** | 10 core contracts + 4 DEX adapters |
| **Collateral Tokens** | 21 tokens across 4 risk tiers |
| **Unit Tests** | 15/15 passing |
| **Keeper Bots** | 4 independent PM2 processes |
| **Solidity Version** | 0.8.24 |
| **Security Framework** | OpenZeppelin 5.x (AccessControl, ReentrancyGuard, Pausable) |

---

## Interest Rate Model

NomoLend uses a **bracket-based interest model** with fixed rates tied to loan duration. There are no variable rates, no utilization curves, and no oracle-dependent rate adjustments.

| Duration | Interest Rate | Example (1,000 USDC Loan) |
|----------|---------------|---------------------------|
| 7 days   | 2%            | Borrower repays 1,020 USDC |
| 14 days  | 4%            | Borrower repays 1,040 USDC |
| 30 days  | 8%            | Borrower repays 1,080 USDC |

**Early repayment discount**: For loans with longer durations, interest is calculated based on the actual time elapsed. A 30-day loan repaid within 7 days pays only 2% interest. A 30-day loan repaid between 8 and 14 days pays 4%.

---

## Platform Fee Structure

The protocol charges a **10% platform fee** on interest earned. This fee is split between two destinations:

```
Interest Earned (100%)
    |
    +-- Lender receives ────────── 90% of interest
    |
    +-- Platform Fee (10%) ─────┬── Treasury ──── 80% of fee (8% of interest)
                                |
                                +── Reserve Fund ── 20% of fee (2% of interest)
```

| Component | Percentage | Recipient |
|-----------|-----------|-----------|
| Lender Net Interest | 90% of interest | Lender wallet |
| Treasury Fee | 80% of platform fee (8% of interest) | Protocol treasury (multisig-controlled) |
| Reserve Fee | 20% of platform fee (2% of interest) | ReserveFund contract (bad debt coverage) |

---

## Collateral Tokens

NomoLend supports **21 collateral tokens** organized into four risk tiers. Each tier has specific Loan-to-Value (LTV) ratios and liquidation thresholds calibrated to the token's market characteristics.

### Risk Tier A -- Blue-Chip (LTV 40% / Liquidation 60%)

| Token | Address | Oracle |
|-------|---------|--------|
| WETH | `0x4200000000000000000000000000000000000006` | Chainlink + TWAP |
| cbETH | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` | Chainlink + TWAP |
| DAI | `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb` | Chainlink + TWAP |
| USDbC | `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` | Chainlink + TWAP |

### Risk Tier B -- Established (LTV 35% / Liquidation 55%)

| Token | Address | Oracle |
|-------|---------|--------|
| LINK | `0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196` | Chainlink + TWAP |
| ZRO | `0x6985884c4392d348587b19cb9eaaf157f13271cd` | TWAP |
| MOCA | `0x2b11834ed1feaed4b4b3a86a6f571315e25a884d` | TWAP |

### Risk Tier C -- Moderate (LTV 30% / Liquidation 50%)

| Token | Address | Oracle |
|-------|---------|--------|
| UNI | `0xc3De830EA07524a0761646a6a4e4be0e114a3C83` | TWAP |
| VIRTUAL | `0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b` | TWAP |
| GHST | `0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb` | TWAP |
| AVAIL | `0xd89d90d26b48940fa8f58385fe84625d468e057a` | TWAP |
| TIG | `0x0c03ce270b4826ec62e7dd007f0b716068639f7b` | TWAP |

### Risk Tier D -- Emerging (LTV 25% / Liquidation 50%)

| Token | Address | Oracle |
|-------|---------|--------|
| CYPR | `0xD262A4c7108C8139b2B189758e8D17c3DFC91a38` | TWAP |
| REI | `0x6b2504a03ca4d43d0d73776f6ad46dab2f2a4cfd` | TWAP |
| AVNT | `0x696f9436b67233384889472cd7cd58a6fb5df4f1` | TWAP |
| VFY | `0xa749de6c28262b7ffbc5de27dc845dd7ecd2b358` | TWAP |
| BID | `0xa1832f7f4e534ae557f9b5ab76de54b1873e498b` | TWAP |
| MAMO | `0x7300b37dfdfab110d83290a29dfb31b1740219fe` | TWAP |
| GIZA | `0x590830dfdf9a3f68afcdde2694773debdf267774` | TWAP |
| KTA | `0xc0634090f2fe6c6d75e61be2b949464abb498973` | TWAP |
| BRETT | `0x532f27101965dd16442e59d40670faf5ebb142e4` | TWAP |

---

## Governance

All protocol admin roles are controlled by a **2-of-3 Gnosis Safe multisig**. The original deployer wallet has been fully revoked and holds zero privileges.

| Wallet | Address | Roles | Purpose |
|--------|---------|-------|---------|
| Gnosis Safe | `0x362D5267A61f65cb4901B163B5D94adbf147DB87` | All admin roles (21 across 10 contracts) | Protocol governance |
| Bot Wallet | `0x78cB...5E03` | PRICE_UPDATER + LIQUIDATOR only | Automated operations |
| Deployer | `0x9ce3...3A25` | None (all revoked) | Retired |

---

## Deployed Contracts

All contracts are deployed on **Base Mainnet** (Chain ID: 8453).

| Contract | Address | BaseScan |
|----------|---------|----------|
| ProtocolConfig | `0x0a41e67c838192944F0F7FA93943b48c517af20e` | [View](https://basescan.org/address/0x0a41e67c838192944F0F7FA93943b48c517af20e) |
| TokenValidator | `0xe0CA16261405CA12F156E2F3A0B309d9587B9e4D` | [View](https://basescan.org/address/0xe0CA16261405CA12F156E2F3A0B309d9587B9e4D) |
| PriceOracle | `0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08` | [View](https://basescan.org/address/0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08) |
| RiskEngine | `0xc5E0fDDB27bB10Efb341654dAbeA55d3Cc09870F` | [View](https://basescan.org/address/0xc5E0fDDB27bB10Efb341654dAbeA55d3Cc09870F) |
| CollateralManager | `0x180dcc27C5923c6FEeD4Fd4f210c6F1fE0A812c5` | [View](https://basescan.org/address/0x180dcc27C5923c6FEeD4Fd4f210c6F1fE0A812c5) |
| LiquidationEngine | `0x6e892AEadda28E630bbe84e469fdA25f1B1B4820` | [View](https://basescan.org/address/0x6e892AEadda28E630bbe84e469fdA25f1B1B4820) |
| OrderBook | `0x400Abe15172CE78E51c33aE1b91F673004dB2315` | [View](https://basescan.org/address/0x400Abe15172CE78E51c33aE1b91F673004dB2315) |
| LoanManager | `0x356e137F8F93716e1d92F66F9e2d4866C586d9cf` | [View](https://basescan.org/address/0x356e137F8F93716e1d92F66F9e2d4866C586d9cf) |
| ReserveFund | `0xDD4a6B527598B31dBcC760B58811278ceF9A3A13` | [View](https://basescan.org/address/0xDD4a6B527598B31dBcC760B58811278ceF9A3A13) |
| RiskGuardian | `0xb9b90eE151D53327c1C42a268Eb974A08f1E07Ef` | [View](https://basescan.org/address/0xb9b90eE151D53327c1C42a268Eb974A08f1E07Ef) |
| UniswapV3Adapter | `0x43215Df48f040CD5A76ed2a19b9e27E62308b1DC` | [View](https://basescan.org/address/0x43215Df48f040CD5A76ed2a19b9e27E62308b1DC) |
| AerodromeAdapter | `0x06578CB045e2c588f9b204416d5dbf5e689A2639` | [View](https://basescan.org/address/0x06578CB045e2c588f9b204416d5dbf5e689A2639) |
| AerodromeCLAdapter | `0x51e7a5E748fFd0889F14f5fAd605441900d0DA27` | [View](https://basescan.org/address/0x51e7a5E748fFd0889F14f5fAd605441900d0DA27) |

Full deployment data: [`deployments/base-mainnet.json`](../deployments/base-mainnet.json)

---

## Further Reading

- [Architecture](./architecture.md) -- System design, contract relationships, and data flow diagrams
- [Contract Reference](./contracts.md) -- Detailed per-contract documentation with functions, events, and roles
