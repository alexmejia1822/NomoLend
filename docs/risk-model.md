# Risk Model

NomoLend's risk framework is managed by the **RiskEngine** contract, which enforces collateral requirements, exposure limits, anomaly detection, and circuit breakers. Every new loan must pass through this engine before creation.

---

## Risk Tiers

Collateral tokens are classified into four risk tiers based on market capitalization, liquidity depth, and protocol maturity. Each tier defines a Loan-to-Value (LTV) ratio and a Liquidation Threshold:

| Tier | Classification | LTV   | Liquidation Threshold | Tokens                                              |
|------|----------------|-------|-----------------------|------------------------------------------------------|
| A    | Blue-chip      | 40%   | 60%                   | WETH, cbETH, DAI, USDbC                             |
| B    | Established    | 35%   | 55%                   | LINK, ZRO, MOCA                                     |
| C    | Moderate       | 30%   | 50%                   | UNI, VIRTUAL, GHST, AVAIL, TIG                      |
| D    | Emerging       | 25%   | 50%                   | CYPR, REI, AVNT, VFY, BID, MAMO, GIZA, KTA, BRETT  |

### What LTV and Liquidation Threshold Mean

- **LTV (Loan-to-Value)**: The maximum USDC a borrower can receive relative to the value of their collateral. A 40% LTV means for $1,000 worth of WETH, the borrower can borrow up to 400 USDC.
- **Liquidation Threshold**: The collateral value ratio at which a loan becomes liquidatable. A 60% threshold means the loan is safe as long as the debt is less than 60% of the collateral's current value.

The gap between LTV and Liquidation Threshold provides a **safety buffer**:

```
  Collateral Value
  |
  |  +----------------------------------+
  |  |          SAFE ZONE               |  Debt < LTV
  |  +----------------------------------+
  |  |      BUFFER ZONE                 |  LTV < Debt < Liq Threshold
  |  |  (no new loans, not yet          |
  |  |   liquidatable)                  |
  |  +----------------------------------+
  |  |      LIQUIDATION ZONE            |  Debt >= Liq Threshold
  |  +----------------------------------+
  |
```

| Tier | LTV  | Liq Threshold | Buffer |
|------|------|---------------|--------|
| A    | 40%  | 60%           | 20%    |
| B    | 35%  | 55%           | 20%    |
| C    | 30%  | 50%           | 20%    |
| D    | 25%  | 50%           | 25%    |

---

## All 21 Supported Tokens

| #  | Symbol   | Address                                      | Tier | Decimals | Chainlink Feed |
|----|----------|----------------------------------------------|------|----------|----------------|
| 1  | WETH     | `0x4200...0006`                               | A    | 18       | Yes            |
| 2  | cbETH    | `0x2Ae3...c22`                                | A    | 18       | Yes            |
| 3  | DAI      | `0x50c5...0Cb`                                | A    | 18       | Yes            |
| 4  | USDbC    | `0xd9aA...6CA`                                | A    | 6        | Yes            |
| 5  | LINK     | `0x88Fb...196`                                | B    | 18       | Yes            |
| 6  | ZRO      | `0x6985...5cd`                                | B    | 18       | TWAP only      |
| 7  | MOCA     | `0x2b11...e4d`                                | B    | 18       | TWAP only      |
| 8  | UNI      | `0xc3De...C83`                                | C    | 18       | TWAP only      |
| 9  | VIRTUAL  | `0x0b3e...e1b`                                | C    | 18       | TWAP only      |
| 10 | GHST     | `0xcd2f...bcb`                                | C    | 18       | TWAP only      |
| 11 | AVAIL    | `0xd89d...57a`                                | C    | 18       | TWAP only      |
| 12 | TIG      | `0x0c03...f7b`                                | C    | 18       | TWAP only      |
| 13 | CYPR     | `0xD262...a38`                                | D    | 18       | TWAP only      |
| 14 | REI      | `0x6b25...cfd`                                | D    | 18       | TWAP only      |
| 15 | AVNT     | `0x696f...4f1`                                | D    | 18       | TWAP only      |
| 16 | VFY      | `0xa749...358`                                | D    | 18       | TWAP only      |
| 17 | BID      | `0xa183...b1b`                                | D    | 18       | TWAP only      |
| 18 | MAMO     | `0x7300...9fe`                                | D    | 18       | TWAP only      |
| 19 | GIZA     | `0x5908...774`                                | D    | 18       | TWAP only      |
| 20 | KTA      | `0xc063...973`                                | D    | 18       | TWAP only      |
| 21 | BRETT    | `0x532f...e4`                                 | D    | 18       | TWAP only      |

---

## Exposure Limits

Each token has a configurable **maximum exposure** — the total USDC value of all outstanding loans collateralized by that token.

| Parameter        | Default         | Notes                                    |
|------------------|-----------------|------------------------------------------|
| `maxExposure`    | 100,000 USDC    | Per token, configurable by risk manager  |

When a new loan is created, the RiskEngine checks:

```
currentExposure[token] + loanAmountUsdc <= maxExposure
```

Exposure is incremented on loan creation and decremented on repayment or liquidation.

---

## Surge Detection

The protocol monitors borrowing velocity to detect abnormal demand spikes that may indicate a manipulation attempt or market event.

```
  Borrowing in Window
  |
  |      Surge Threshold (50K USDC)
  |  ====================================  <-- auto-pause triggered
  |         /
  |        /  (accumulating)
  |       /
  |      /
  +-----+----------------------------> Time
        Window Start (1 hour)
```

| Parameter              | Default       | Configurable |
|------------------------|---------------|--------------|
| `surgeThresholdUsdc`   | 50,000 USDC   | Yes          |
| `surgeWindowSeconds`   | 1 hour        | Fixed        |

**Behavior**:
- Each new loan adds its USDC amount to the token's rolling window.
- If the window has expired, it resets — but carries forward **half** of the previous window's accumulated amount (to catch bursts that straddle window boundaries).
- If the accumulated amount exceeds the threshold, the token is **automatically paused** and a `SurgeDetected` event is emitted. No new loans can use this token until a risk manager manually unpauses it.

---

## Circuit Breaker

The circuit breaker protects against sudden price crashes. It stores a **price snapshot** for each token (updated whenever a new loan is created) and compares it against the live oracle price.

| Parameter                 | Default | Range       |
|---------------------------|---------|-------------|
| `priceDropThresholdBps`   | 30%     | 5% - 50%   |

**Trigger condition**:

```
priceDrop = (snapshotPrice - currentPrice) / snapshotPrice

if priceDrop >= 30%:
    pausedTokens[token] = true
    emit CircuitBreakerTriggered(...)
```

The circuit breaker is checked at the beginning of every loan creation (`checkCircuitBreaker()`). If triggered, the token is paused immediately and all subsequent loan creation attempts for that token will revert.

---

## DOS Protection

To prevent a single user from monopolizing a token or spamming the order book:

| Limit                             | Default | Configurable Range |
|-----------------------------------|---------|--------------------|
| Max active loans per user per token | 5       | 1 - 50            |
| Max active orders per user         | 20      | 1 - 100           |

These limits are tracked in:
- `RiskEngine.userTokenLoanCount[user][token]` — incremented on loan creation, decremented on repayment/liquidation
- `OrderBook.activeOrderCount[user]` — incremented on order creation, decremented on fill/cancel

---

## DEX Liquidity Checks

The protocol verifies that sufficient on-chain liquidity exists to liquidate collateral if needed.

### Liquidity Data

DEX liquidity values are maintained by an off-chain keeper via `setTokenDexLiquidity()` or `batchSetTokenDexLiquidity()`.

| Parameter                | Default  | Notes                              |
|--------------------------|----------|------------------------------------|
| `maxLoanToLiquidityBps`  | 15%      | Max single loan as % of liquidity  |
| `maxLiquidityStaleness`  | 6 hours  | Configurable 1h - 24h             |
| `minDexLiquidity`        | Per token| Minimum required liquidity         |

### Checks at Loan Creation

1. **Staleness**: If `minDexLiquidity` is set for a token, the liquidity data must have been updated within the last 6 hours. Stale data blocks new loans.
2. **Minimum liquidity**: The token's DEX liquidity must meet the configured minimum.
3. **Loan-to-liquidity ratio**: A single loan cannot exceed 15% of the token's total DEX liquidity:

```
maxLoan = (tokenDexLiquidity * 1,500) / 10,000
require(loanAmount <= maxLoan)
```

This prevents a scenario where liquidating a single loan would consume an outsized portion of available liquidity and cause excessive slippage.

---

## Validation Summary

Every new loan passes through `RiskEngine.validateNewLoan()`, which enforces the following in order:

```
validateNewLoan(token, loanAmountUsdc, borrower)
   |
   +-- Token is active?
   +-- Token not paused?
   +-- Token passes security validation (TokenValidator)?
   +-- Exposure within limit?
   +-- User loan count within limit (max 5)?
   +-- DEX liquidity data fresh?
   +-- DEX liquidity above minimum?
   +-- Loan size within 15% of DEX liquidity?
```

If any check fails, the loan creation reverts.
