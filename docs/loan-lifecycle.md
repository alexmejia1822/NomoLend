# Loan Lifecycle

NomoLend is a peer-to-peer lending protocol deployed on Base. Every loan is an independent, isolated agreement between one lender and one borrower — there are no shared liquidity pools. USDC is the sole lending currency; borrowers post ERC-20 tokens as collateral.

---

## Two Paths to Create a Loan

Loans can originate from either side of the market. Both paths support **partial fills**, meaning a single order can be matched by multiple counterparties.

### Path 1 — Lender Posts First

```
 Lender                    OrderBook                  Borrower
   |                          |                          |
   |-- createLendingOrder() ->|                          |
   |   (deposits USDC)        |                          |
   |                          |                          |
   |                          |<-- takeLoan() ---------- |
   |                          |    (specifies collateral)|
   |                          |                          |
   |                     LoanManager                     |
   |                          |                          |
   |                          |-- fillLendingOrder() --> OrderBook
   |                          |   (USDC to LoanManager)  |
   |                          |                          |
   |                          |-- validateNewLoan() ---> RiskEngine
   |                          |   (token active? LTV?    |
   |                          |    exposure? circuit      |
   |                          |    breaker? DOS? liq?)    |
   |                          |                          |
   |                          |-- depositCollateral() -> CollateralManager
   |                          |   (locks borrower's      |
   |                          |    tokens)                |
   |                          |                          |
   |                          |-- safeTransfer(USDC) --> Borrower
   |                          |                          |
   |                     Loan ACTIVE                     |
```

1. Lender calls `OrderBook.createLendingOrder(amount, duration)` and deposits USDC into the OrderBook contract.
2. A borrower sees the offer and calls `LoanManager.takeLoan(orderId, amount, collateralToken, collateralAmount)`.
3. The OrderBook partially or fully fills the order and sends USDC to LoanManager.
4. RiskEngine validates the loan (see Validations below).
5. Collateral is transferred from the borrower and locked in CollateralManager.
6. USDC is forwarded to the borrower. The loan is now **ACTIVE**.

### Path 2 — Borrower Posts First

```
 Borrower                  OrderBook                    Lender
   |                          |                          |
   |-- createBorrowRequest()->|                          |
   |   (deposits collateral)  |                          |
   |                          |                          |
   |                          |<-- fillBorrowRequest() --|
   |                          |    (sends USDC)          |
   |                          |                          |
   |                     LoanManager                     |
   |                          |                          |
   |                          |-- fillBorrowRequest() -> OrderBook
   |                          |   (proportional collateral|
   |                          |    to LoanManager)        |
   |                          |                          |
   |                          |-- validateNewLoan() ---> RiskEngine
   |                          |                          |
   |                          |-- depositCollateral() -> CollateralManager
   |                          |   (collateral from       |
   |                          |    OrderBook escrow)      |
   |                          |                          |
   |                          |-- safeTransfer(USDC) --> Borrower
   |                          |                          |
   |                     Loan ACTIVE                     |
```

1. Borrower calls `OrderBook.createBorrowRequest(requestedAmount, collateralToken, collateralAmount, duration)` and deposits collateral into the OrderBook.
2. A lender calls `LoanManager.fillBorrowRequest(requestId, amount)` and sends USDC.
3. The OrderBook releases a **proportional** share of collateral to LoanManager.
4. RiskEngine validates the loan.
5. Collateral moves from OrderBook to CollateralManager via LoanManager.
6. USDC goes to the borrower. The loan is now **ACTIVE**.

---

## Partial Fills

Both lending orders and borrow requests track remaining capacity:

| Order Type      | Tracking Field     | Behavior on Partial Fill                       |
|-----------------|--------------------|-------------------------------------------------|
| Lending Order   | `availableAmount`  | Decremented by fill amount; status stays `OPEN` |
| Borrow Request  | `filledAmount` / `collateralAllocated` | Incremented; collateral split proportionally |

A single lending order of 10,000 USDC can be consumed by three separate borrowers taking 3,000 + 3,000 + 4,000 USDC. Similarly, a borrow request for 5,000 USDC can be funded by two lenders providing 2,000 + 3,000 USDC.

When the available amount reaches zero, the order status transitions to `FILLED` and the active order count for that user is decremented.

---

## Validations at Loan Creation

Every loan — regardless of origination path — must pass the following checks before the `Loan` struct is written to storage:

| # | Check                     | Condition                                               | Error Message                     |
|---|---------------------------|---------------------------------------------------------|-----------------------------------|
| 1 | Minimum amount            | `amount >= 10 USDC` (10e6)                              | `Below minimum loan amount`       |
| 2 | Order status              | Order must be `OPEN`                                    | `Order not open`                  |
| 3 | Filled amount floor       | After partial fill, `filledAmount >= 10 USDC`           | `Filled amount below minimum`     |
| 4 | Circuit breaker           | No recent 30%+ price crash for the collateral token     | `Token paused due to anomaly`     |
| 5 | Token active              | `tokenRiskParams[token].isActive == true`               | `Token not active for lending`    |
| 6 | Token not paused          | `pausedTokens[token] == false`                          | `Token paused due to anomaly`     |
| 7 | Token security validation | TokenValidator confirms contract is safe                | `Token validation failed: ...`    |
| 8 | Exposure limit            | `currentExposure + loanAmount <= maxExposure`            | `Token exposure limit reached`    |
| 9 | DOS protection            | `userTokenLoanCount[borrower][token] < 5`               | `Max loans per token reached`     |
| 10| DEX liquidity freshness   | Liquidity data updated within 6 hours                   | `DEX liquidity data stale`        |
| 11| DEX liquidity minimum     | Token has sufficient DEX liquidity                      | `Insufficient DEX liquidity`      |
| 12| Loan-to-liquidity ratio   | `loanAmount <= 15% of token DEX liquidity`              | `Loan exceeds liquidity limit`    |
| 13| Sufficient collateral     | `collateralAmount >= requiredCollateral` (from LTV)     | `Insufficient collateral`         |

---

## Repayment

```
 Borrower                  LoanManager              Distribution
   |                          |                          |
   |-- repayLoan(loanId) ---> |                          |
   |   (USDC: principal       |                          |
   |    + interest)            |                          |
   |                          |-- principal + 90%        |
   |                          |   interest --> Lender     |
   |                          |                          |
   |                          |-- 8% interest --> Treasury|
   |                          |-- 2% interest --> Reserve |
   |                          |                          |
   |                          |-- releaseCollateral() -> CollateralManager
   |                          |   (collateral back to     |
   |                          |    borrower)              |
   |                          |                          |
   |                     Loan REPAID                      |
```

- **Grace period**: Borrowers have **4 hours** after the loan's scheduled expiry to repay without penalty. After that, the loan becomes liquidatable.
- **Interest model**: Bracket-based, not pro-rata. The rate is determined by which time bracket has been reached at repayment time (see [Interest Model](./interest-model.md)).
- **Platform fee**: 10% of the gross interest amount. Of that fee:
  - **80%** goes to the protocol treasury
  - **20%** goes to the reserve fund

### Duration and Interest Rate Table

| Loan Duration | Repay within 7 days | Repay 7-14 days | Repay after 14 days |
|---------------|---------------------|-----------------|---------------------|
| 7 days        | 2%                  | --              | --                  |
| 14 days       | 2%                  | 4%              | --                  |
| 30 days       | 2%                  | 4%              | 8%                  |

---

## Numerical Example

**Scenario**: Alice borrows 1,000 USDC for 30 days. She repays after 10 days.

| Item                | Calculation                          | Amount       |
|---------------------|--------------------------------------|--------------|
| Principal           | --                                   | 1,000.00 USDC|
| Interest bracket    | 10 days falls in 7-14 day bracket    | 4%           |
| Gross interest      | 1,000 x 4%                           | 40.00 USDC   |
| Platform fee (10%)  | 40 x 10%                             | 4.00 USDC    |
| Treasury (80% fee)  | 4.00 x 80%                           | 3.20 USDC    |
| Reserve (20% fee)   | 4.00 x 20%                           | 0.80 USDC    |
| Lender receives     | 1,000 + (40 - 4)                     | 1,036.00 USDC|
| **Borrower pays**   | 1,000 + 40                           | **1,040.00 USDC** |

Alice's collateral is released back to her upon successful repayment.

---

## Order Management

### Cancellation

- **Lending orders**: Lender can cancel at any time while status is `OPEN`. The remaining `availableAmount` of USDC is returned.
- **Borrow requests**: Borrower can cancel at any time while status is `OPEN`. Unallocated collateral (total minus what has been allocated to already-filled portions) is returned.

### DOS Protection

| Limit                         | Default | Configurable Range |
|-------------------------------|---------|--------------------|
| Max active orders per user    | 20      | 1 - 100            |
| Max loans per user per token  | 5       | 1 - 50             |

---

## Loan States

```
                  +----------+
                  |  ACTIVE  |
                  +----+-----+
                       |
           +-----------+-----------+
           |                       |
    repayLoan()            liquidateLoan()
           |                       |
     +-----v-----+         +------v-------+
     |  REPAID    |         |  LIQUIDATED  |
     +-----------+          +--------------+
```

A loan can only transition out of `ACTIVE` once. There is no mechanism to extend or renegotiate an existing loan.
