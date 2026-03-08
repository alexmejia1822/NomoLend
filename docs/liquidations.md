# Liquidations

Liquidation is the process of selling a borrower's collateral to repay the lender when a loan becomes unsafe. NomoLend enforces liquidation through two triggers: **health factor deterioration** and **loan expiry** (past the grace period).

---

## Health Factor

The health factor measures how well a loan is collateralized:

```
                collateralValue (USDC) x liquidationThreshold (BPS)
healthFactor = --------------------------------------------------------
                              debt (USDC) x 10,000
```

Where:
- `collateralValue` = current market value of locked collateral in USDC (from PriceOracle)
- `liquidationThreshold` = the maximum debt-to-collateral ratio before liquidation (per token tier)
- `debt` = principal + accrued bracket interest

The health factor is returned in basis points: **10,000 = 1.0** (the boundary).

---

## When Is a Loan Liquidatable?

A loan becomes liquidatable under **either** condition:

| Condition              | Trigger                                                     |
|------------------------|-------------------------------------------------------------|
| Undercollateralized    | Health factor < 1.0 (`collateralValue * liqThreshold <= debt * 10,000`) |
| Expired                | Elapsed time > duration + 4-hour grace period               |

Both conditions are checked in `LoanManager.liquidateLoan()`. If the loan is not expired, the contract verifies undercollateralization via `RiskEngine.isLiquidatable()`.

---

## Who Can Liquidate?

| Role                 | Access                                                    |
|----------------------|-----------------------------------------------------------|
| LIQUIDATOR_ROLE      | Always authorized                                         |
| Public liquidator    | Authorized only when `publicLiquidationEnabled == true`   |

Public liquidation can be toggled by the protocol admin. Public liquidators receive a bonus (see Distribution below).

---

## Complete Liquidation Flow

```
 Liquidator              LoanManager           CollateralManager
   |                         |                        |
   |-- liquidateLoan() ----->|                        |
   |   (loanId, minOut)      |                        |
   |                         |                        |
   |                  Check authorization              |
   |                  (LIQUIDATOR_ROLE or              |
   |                   publicLiquidationEnabled)       |
   |                         |                        |
   |                  Check loan is ACTIVE             |
   |                         |                        |
   |                  Is expired (past grace)?         |
   |                  If not, check HF < 1.0           |
   |                         |                        |
   |                  Calculate interest +             |
   |                  penalty (if expired)             |
   |                         |                        |
   |                         |-- releaseForLiquidation()
   |                         |   (all collateral) ---->|
   |                         |                        |
   |                         |<--- collateral tokens --|
   |                         |     to LiquidationEngine|
   |                         |                        |
   |                    LiquidationEngine              |
   |                         |                        |
   |                  +------v--------+                |
   |                  | Try Primary   |                |
   |                  | Router        |                |
   |                  | (Uniswap V3)  |                |
   |                  +------+--------+                |
   |                         |                        |
   |                    Success?                       |
   |                   /        \                      |
   |                 Yes         No                    |
   |                  |    +-----v--------+            |
   |                  |    | Try Fallback  |            |
   |                  |    | Router        |            |
   |                  |    | (Aerodrome)   |            |
   |                  |    +-----+--------+            |
   |                  |          |                     |
   |                  +----+-----+                     |
   |                       |                           |
   |                  Verify: usdcReceived             |
   |                  >= minAmountOut                   |
   |                       |                           |
   |                  distributeProceeds()              |
   |                       |                           |
   |              +--------+--------+--------+         |
   |              |        |        |        |         |
   |           Treasury  Lender  Borrower  Liquidator  |
   |           (fee)     (debt)  (surplus) (bonus)     |
   |                                                   |
   |                  Loan -> LIQUIDATED               |
```

---

## DEX Swap Execution

### Router Priority

| Priority | Router      | Adapter             | Protocol     |
|----------|-------------|---------------------|--------------|
| Primary  | Uniswap V3  | UniswapV3Adapter    | SwapRouter02 |
| Fallback | Aerodrome   | AerodromeAdapter    | AMM Router   |

The primary router is attempted first. If the call reverts (insufficient liquidity, pool not found, etc.), the fallback router is used. If both fail, the entire liquidation reverts.

### Uniswap V3 Adapter

- Uses `exactInputSingle` on SwapRouter02
- Default fee tier: 0.3% (3000)
- Supports custom fee tiers per token via `setCustomFee()`

### Aerodrome Adapter

- Uses `swapExactTokensForTokens` with a single-hop route
- Supports stable/volatile pool selection per token via `setStablePool()`
- Deadline: `block.timestamp + 300` (5 minutes)

### Slippage Protection

- Maximum slippage: **5%** (500 BPS), configurable between 0.01% and 10%
- The `minAmountOut` parameter is passed by the caller and enforced at the router level
- After verification: `require(usdcReceived >= minAmountOut, "Slippage exceeded")`

### Approval Hygiene

Both adapters and the LiquidationEngine reset token approvals to zero after every swap — whether the swap succeeds or fails. This prevents lingering approvals that could be exploited:

```
// Before swap
IERC20(token).forceApprove(router, amount);

// After swap (success or failure)
IERC20(token).forceApprove(router, 0);
```

---

## Proceeds Distribution

After the collateral is swapped to USDC, proceeds are distributed in strict priority order:

```
  Total USDC Received
  |
  +---> 1. Platform Fee  ---------> Treasury
  |
  +---> 2. Debt Repayment --------> Lender
  |     (principal + interest
  |      - platform fee)
  |
  +---> 3. Surplus (if any) ------> Borrower
  |
  +---> 4. Liquidator Bonus ------> Public Liquidator
        (deducted before step 1-3)
```

### Priority Details

| Priority | Recipient         | Amount                                        |
|----------|-------------------|-----------------------------------------------|
| 1        | Treasury          | Platform fee (10% of interest)                |
| 2        | Lender            | `totalDebt - platformFee` or remaining balance|
| 3        | Borrower          | Any surplus after lender is made whole        |

If proceeds are insufficient to cover the full platform fee, whatever is available goes to treasury and an `InsufficientFeeProceeds` event is emitted. The lender receives whatever remains.

### Liquidator Bonus (Public Liquidators Only)

| Parameter           | Value | Notes                                         |
|---------------------|-------|-----------------------------------------------|
| Bonus rate          | 1%    | Of total USDC received from the swap          |
| Cap                 | --    | Reduced so lender still receives full debt     |
| Eligibility         | --    | Only public liquidators (no LIQUIDATOR_ROLE)  |

The bonus is deducted from total proceeds **before** the distribution waterfall. If deducting the full 1% would leave insufficient funds for the lender's debt, the bonus is capped at `usdcReceived - totalDebt`.

---

## Liquidation Penalty (Expired Loans)

When a loan is liquidated due to expiry (not undercollateralization), an additional **2% penalty** (200 BPS) is added to the debt:

```
penalty = (principal * 200) / 10,000
totalDebt = principal + interest + penalty
```

This penalty increases the amount the borrower's collateral must cover and serves as a deterrent against letting loans expire.

---

## Numerical Example

**Scenario**: A 1,000 USDC loan (30-day duration) backed by WETH collateral. The loan expires and is liquidated by a public liquidator on day 35.

| Item                      | Calculation                                    | Amount         |
|---------------------------|------------------------------------------------|----------------|
| Principal                 | --                                             | 1,000.00 USDC  |
| Interest (30d bracket)    | 1,000 x 8%                                    | 80.00 USDC     |
| Expiry penalty (2%)       | 1,000 x 2%                                    | 20.00 USDC     |
| Total debt                | 1,000 + 80 + 20                                | 1,100.00 USDC  |
| Platform fee (10% of int) | 80 x 10%                                      | 8.00 USDC      |
| Collateral swap proceeds  | (assume swap yields)                           | 1,250.00 USDC  |
| Liquidator bonus (1%)     | 1,250 x 1%                                    | 12.50 USDC     |
| Available for waterfall   | 1,250 - 12.50                                  | 1,237.50 USDC  |
| Treasury receives         | 8.00                                           | 8.00 USDC      |
| Lender receives           | 1,100 - 8 = 1,092                              | 1,092.00 USDC  |
| Borrower surplus          | 1,237.50 - 8.00 - 1,092.00                    | 137.50 USDC    |

---

## State Transitions

After liquidation:
- `loan.status` = `LIQUIDATED`
- `loan.interestPaid` = interest amount at time of liquidation
- `loan.repaidAt` = `block.timestamp`
- Token exposure is decremented in RiskEngine
- User loan count for that token is decremented
