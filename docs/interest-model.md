# Interest Model

NomoLend uses a **bracket-based** (step-function) interest model. Interest is determined by which time bracket the loan has reached at the moment of repayment — it is **not** calculated pro-rata over elapsed time.

This design provides predictable, transparent costs for borrowers and removes the complexity of continuous compounding.

---

## Core Concept

Instead of accruing interest linearly per second, the protocol defines fixed interest rates tied to discrete time brackets. A borrower who repays at day 1 and a borrower who repays at day 6 both pay the same rate — because they both fall within the same bracket.

```
Interest
Rate
  |
8%|                              +-------------------+
  |                              |                   |
4%|              +---------------+                   |
  |              |                                   |
2%|  +-----------+                                   |
  |  |                                               |
  +--+-------+-------+-------+-------+-------+-------> Days
  0  1       7       14      21      28      30
```

---

## Constants

All rates are stored as basis points (BPS) with a denominator of 10,000:

| Constant        | Value (BPS) | Percentage | Time Bracket    |
|-----------------|-------------|------------|-----------------|
| `INTEREST_7D`   | 200         | 2%         | 0 - 7 days      |
| `INTEREST_14D`  | 400         | 4%         | 7 - 14 days     |
| `INTEREST_30D`  | 800         | 8%         | 14 - 30 days    |

Time thresholds:

| Constant         | Value        |
|------------------|--------------|
| `SEVEN_DAYS`     | 604,800 sec  |
| `FOURTEEN_DAYS`  | 1,209,600 sec|
| `THIRTY_DAYS`    | 2,592,000 sec|

---

## Rate Determination by Duration

### 7-Day Loans

A 7-day loan always charges 2%, regardless of when the borrower repays (as long as it is within the duration + grace period).

| Elapsed Time | Rate Applied |
|--------------|--------------|
| 0 - 7 days   | 2%           |

### 14-Day Loans

| Elapsed Time | Rate Applied |
|--------------|--------------|
| 0 - 7 days   | 2%           |
| 7 - 14 days  | 4%           |

A borrower who repays a 14-day loan on day 5 pays 2%. If they wait until day 10, they pay 4%.

### 30-Day Loans

| Elapsed Time  | Rate Applied |
|---------------|--------------|
| 0 - 7 days    | 2%           |
| 7 - 14 days   | 4%           |
| 14 - 30 days  | 8%           |

---

## Calculation Formula

```
interest = (principal * rateBps) / 10,000
```

The `rateBps` is selected by `_getBracketRate(duration, elapsed)`, which returns the single flat rate for the bracket the loan currently occupies.

---

## Platform Fee

The protocol charges a **10% platform fee** on gross interest. This fee is deducted before distributing proceeds:

```
platformFee  = interest * 10%
lenderShare  = interest - platformFee
```

### Fee Split

The platform fee itself is split between two destinations:

| Destination    | Share of Platform Fee | Share of Interest |
|----------------|----------------------|-------------------|
| Treasury       | 80%                  | 8%                |
| Reserve Fund   | 20%                  | 2%                |

The reserve fund allocation (`reserveFeeBps`) is configurable by the admin, with a maximum of 50% of the platform fee.

---

## Comparative Table

The following table shows the total cost for a **1,000 USDC** loan across all durations and brackets:

| Duration | Repay Day | Bracket   | Gross Interest | Platform Fee | Treasury | Reserve | Lender Receives | Borrower Pays |
|----------|-----------|-----------|----------------|-------------|----------|---------|-----------------|---------------|
| 7 days   | Day 3     | 0-7d      | 20.00 USDC     | 2.00 USDC   | 1.60     | 0.40    | 1,018.00 USDC   | 1,020.00 USDC |
| 7 days   | Day 7     | 0-7d      | 20.00 USDC     | 2.00 USDC   | 1.60     | 0.40    | 1,018.00 USDC   | 1,020.00 USDC |
| 14 days  | Day 5     | 0-7d      | 20.00 USDC     | 2.00 USDC   | 1.60     | 0.40    | 1,018.00 USDC   | 1,020.00 USDC |
| 14 days  | Day 10    | 7-14d     | 40.00 USDC     | 4.00 USDC   | 3.20     | 0.80    | 1,036.00 USDC   | 1,040.00 USDC |
| 30 days  | Day 3     | 0-7d      | 20.00 USDC     | 2.00 USDC   | 1.60     | 0.40    | 1,018.00 USDC   | 1,020.00 USDC |
| 30 days  | Day 10    | 7-14d     | 40.00 USDC     | 4.00 USDC   | 3.20     | 0.80    | 1,036.00 USDC   | 1,040.00 USDC |
| 30 days  | Day 20    | 14-30d    | 80.00 USDC     | 8.00 USDC   | 6.40     | 1.60    | 1,072.00 USDC   | 1,080.00 USDC |
| 30 days  | Day 30    | 14-30d    | 80.00 USDC     | 8.00 USDC   | 6.40     | 1.60    | 1,072.00 USDC   | 1,080.00 USDC |

---

## Detailed Example: 1,000 USDC Loan for 30 Days

**Setup**: Bob borrows 1,000 USDC with a 30-day duration. He repays on day 20.

### Step 1 — Determine the bracket

Day 20 exceeds 14 days, so the third bracket applies: **8% (800 BPS)**.

### Step 2 — Calculate gross interest

```
interest = (1,000,000,000 * 800) / 10,000
         = 80,000,000
         = 80.00 USDC
```

(All USDC amounts use 6 decimal places internally: 1 USDC = 1,000,000.)

### Step 3 — Calculate platform fee

```
platformFee = (80,000,000 * 1,000) / 10,000
            = 8,000,000
            = 8.00 USDC
```

### Step 4 — Split the platform fee

```
treasuryPortion = 8.00 * 80% = 6.40 USDC
reservePortion  = 8.00 * 20% = 1.60 USDC
```

### Step 5 — Final distribution

| Recipient       | Amount          | Composition                    |
|-----------------|-----------------|--------------------------------|
| Lender          | 1,072.00 USDC   | 1,000 principal + 72 interest  |
| Treasury        | 6.40 USDC       | 80% of platform fee            |
| Reserve Fund    | 1.60 USDC       | 20% of platform fee            |
| **Borrower pays** | **1,080.00 USDC** | Principal + gross interest   |

### Step 6 — Collateral release

Upon successful repayment, CollateralManager releases the full collateral back to Bob.

---

## Key Design Decisions

1. **Simplicity over precision**: Bracket rates are trivially understandable. A borrower always knows in advance what the next cost jump will be.
2. **Early repayment incentive**: Within a 30-day loan, repaying in the first week costs only 2% — a 4x discount vs. holding to maturity.
3. **No compounding**: Interest is a single flat percentage of the principal. There is no concept of APY or continuous accrual.
4. **Grace period**: Borrowers get 4 additional hours after the loan's scheduled expiry to repay at the maximum bracket rate before the loan becomes liquidatable.
