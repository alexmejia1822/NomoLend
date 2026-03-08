# NomoLend Frequently Asked Questions

---

### How do loans work?

NomoLend is a peer-to-peer lending protocol. There are two ways to create a loan:

1. **Lender-initiated:** A lender creates a lending order by depositing USDC into the OrderBook with a chosen duration (7, 14, or 30 days). A borrower can then take a loan from that order by providing sufficient collateral.

2. **Borrower-initiated:** A borrower creates a borrow request by depositing collateral into the OrderBook and specifying the desired USDC amount and duration. A lender can then fill the request by providing the USDC.

In both cases, a loan is created with the borrower's collateral locked in the CollateralManager. The borrower receives USDC and must repay the principal plus interest before the loan expires.

---

### What tokens can I use as collateral?

NomoLend supports 21 tokens on Base as collateral, organized into four risk tiers:

| Tier | Tokens | LTV |
|------|--------|-----|
| **A** | WETH, cbETH, DAI, USDbC | 40% |
| **B** | LINK, ZRO, MOCA | 35% |
| **C** | UNI, VIRTUAL, GHST, AVAIL, TIG | 30% |
| **D** | CYPR, REI, AVNT, VFY, BID, MAMO, GIZA, KTA, BRETT | 25% |

Higher-tier tokens have better LTV ratios, meaning you need to post less collateral for the same loan amount. See the [Collateral Tokens](./collateral-tokens.md) document for full details including addresses and oracle configurations.

---

### What happens if the collateral price drops?

Your loan has a **health factor** that measures the ratio of your collateral value to your debt. As the collateral price drops, the health factor decreases:

- **HF > 1.2** — Healthy. No action needed.
- **1.05 < HF < 1.2** — At risk. The protocol flags your loan and alerts are sent. Consider repaying early or adding collateral awareness.
- **HF < 1.05** — Liquidation zone. Your loan becomes eligible for liquidation.

The health factor is continuously monitored by keeper bots scanning every 1-2 minutes.

---

### What happens if I don't repay on time?

When a loan expires, the following sequence occurs:

1. **4-hour grace period** — After the loan duration ends, borrowers have a 4-hour window to repay without additional penalty.
2. **Liquidation eligibility** — After the grace period, the loan becomes liquidatable regardless of the health factor.
3. **Automatic liquidation** — The liquidation bot sells the collateral on DEX (Uniswap V3 or Aerodrome) to recover the lender's principal and interest.
4. **Collateral return** — Any excess collateral after covering the debt is returned to the borrower.

It is strongly recommended to repay before expiration to recover your full collateral.

---

### How is interest calculated?

NomoLend uses a **fixed-rate bracket system** based on loan duration:

| Duration | Interest Rate | Example on $1,000 |
|----------|--------------|-------------------|
| 7 days | 2% | $20 |
| 14 days | 4% | $40 |
| 30 days | 8% | $80 |

Key points:
- Interest is **fixed at the time of repayment**, not at loan creation
- Interest is the **full bracket amount** regardless of when you repay within the period (repaying a 7-day loan on day 2 still costs 2%)
- There are **no compounding fees** or variable rates
- Early repayment is allowed with **no penalty**

---

### What is the grace period?

The grace period is a 4-hour window after a loan's scheduled end time. During this period:
- The borrower can still repay the loan normally
- The loan is NOT yet eligible for liquidation
- No additional fees or penalties are charged

After the grace period expires, the loan becomes liquidatable.

---

### How are liquidations executed?

When a loan becomes liquidatable (HF < 1.05 or expired past grace period):

1. The liquidation bot detects the loan via health factor scanning
2. The LoanManager calls the LiquidationEngine
3. The LiquidationEngine swaps the borrower's collateral for USDC through DEX adapters (Uniswap V3 or Aerodrome)
4. The lender receives their principal + interest (minus 10% platform fee)
5. Any remaining collateral is returned to the borrower
6. A maximum of 15% of available DEX liquidity is used per swap to minimize price impact
7. Slippage tolerance is set at 5%

---

### Who can liquidate?

Liquidations are executed by authorized keeper bots holding the `LIQUIDATOR_ROLE`. Only wallets granted this role by governance can trigger liquidations through the LoanManager contract.

The protocol runs automated liquidation bots that scan for eligible loans every 2 minutes. Manual liquidation by arbitrary users is not supported in the current version.

---

### What fees does the protocol charge?

NomoLend charges a **10% platform fee on interest only**. The principal is never subject to fees.

**Fee breakdown:**

```
Borrower pays: Principal + Interest
                              |
                   +----------+----------+
                   |                     |
              90% to Lender       10% Platform Fee
                                         |
                              +----------+----------+
                              |                     |
                         80% Treasury          20% Reserve Fund
                         (protocol revenue)    (bad debt buffer)
```

**Example:** On a $1,000 loan with 2% interest ($20):
- Lender receives: $1,000 + $18 = $1,018
- Treasury receives: $1.60
- Reserve Fund receives: $0.40
- Borrower pays: $1,020 total

---

### What is the circuit breaker?

The circuit breaker is an emergency mechanism implemented through the RiskGuardian contract. It allows governance to:

- **Pause all contracts** — Stops new order creation, loan origination, and liquidations
- **Allow repayments** — Even when paused, borrowers can repay their loans to recover collateral
- **Auto-trigger** — Can be activated by governance in response to extreme market conditions, oracle failures, or detected exploits

The circuit breaker protects users during crisis events while ensuring borrowers are never locked out of repaying their debts.

---

### How is price manipulation prevented?

Multiple layers protect against oracle manipulation:

1. **Dual oracle system** — Tier A/B tokens use Chainlink (decentralized, tamper-resistant) as the primary source, with TWAP as a cross-check
2. **Deviation detection** — Large discrepancies between Chainlink and TWAP prices trigger alerts and can restrict new lending
3. **Staleness threshold** — Prices older than 30 minutes are flagged as stale and rejected for new loan creation
4. **TWAP smoothing** — Time-weighted average prices dampen short-term price spikes from flash loans or thin-order-book manipulation
5. **Confidence flag** — The oracle returns a boolean `confidence` value; low-confidence prices restrict protocol operations
6. **Exposure limits** — Per-token caps prevent attackers from creating outsized positions

---

### Where can I see my health factor?

Your health factor is visible in multiple places:

- **My Loans page** (`/my-loans`) — Shows the health factor for each of your active loans with color coding (green > 1.5, yellow 1.2-1.5, red < 1.2)
- **Dashboard** (`/`) — The token exposure table shows aggregate risk levels
- **Risk page** (`/risk`) — Detailed risk parameters per token

The health factor is calculated on-chain by the LoanManager contract:

```
Health Factor = (Collateral Value * Liquidation Threshold) / Total Debt
```

A health factor above 1.0 means the loan is solvent. Below 1.0 means the loan is undercollateralized and subject to liquidation.

---

### Is the protocol audited?

The protocol has been developed with security best practices including:
- OpenZeppelin library usage for access control, reentrancy guards, and pausability
- 15/15 automated tests passing covering all core flows
- Modular contract architecture limiting blast radius
- Post-deployment role verification and governance migration

Users should evaluate the protocol's security posture independently before depositing funds. All contracts are verified and readable on BaseScan.

---

### Who controls the protocol?

Protocol governance is managed by a **Gnosis Safe 2-of-3 multisig** at address `0x362D5267A61f65cb4901B163B5D94adbf147DB87`.

Key governance facts:
- All admin roles across 10 protocol contracts are held by the Safe multisig
- The original deployer wallet (`0x9ce3F036365DfAf608D5F98B34A5872bbe5Ee125`) has been stripped of all on-chain roles via `renounceRole()`
- Bot wallets only hold operational roles (`PRICE_UPDATER_ROLE`, `LIQUIDATOR_ROLE`) and cannot modify protocol parameters
- Any protocol configuration change requires 2-of-3 signer approval through the Safe interface
- Role assignments are publicly verifiable on-chain
