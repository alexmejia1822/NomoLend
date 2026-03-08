# NomoLend — Test Suite

NomoLend ships with 84 test scenarios distributed across three complementary layers. Unit tests verify isolated contract logic on a local fork; fuzz tests hammer mathematical invariants with randomized inputs; integration tests execute real transactions on Base Mainnet against live oracles, DEX routers, and gas markets.

```
84 Test Scenarios
├── Unit Tests (15)              Hardhat — contract logic, math, access control
├── Fuzz & Invariant Tests (45)  Foundry — randomized property testing (1000 runs each)
└── Integration Tests (24)       Base Mainnet — real DEX, real oracle, real gas
```

---

## Unit Tests (15) — Hardhat

**Framework:** Hardhat + Chai + ethers.js
**File:** `tests/NomoLend.test.js`
**Command:** `npx hardhat test`
**Result:** 15/15 passing

Each test deploys the full protocol stack on the Hardhat local network with mock tokens, a mock Chainlink price feed ($10/token), a mock swap router, and risk parameters set to 40% LTV / 60% liquidation threshold / 1M USDC max exposure.

| # | Category | Test | Expected Result |
|---|----------|------|-----------------|
| 1 | Interest Calculator | 2% for 7-day loan | 1,000 USDC loan, repaid after 5 days. Interest = 20 USDC, status = REPAID |
| 2 | Interest Calculator | 4% for 30-day loan (bracket 2) | 1,000 USDC loan, repaid after 10 days. Interest = 40 USDC |
| 3 | Interest Calculator | 8% for 30-day loan (bracket 3) | 1,000 USDC loan, repaid after 20 days. Interest = 80 USDC |
| 4 | OrderBook | Create and cancel lending order | 1,000 USDC order created (OPEN), cancelled, full USDC refund |
| 5 | OrderBook | Create and cancel borrow request | 500 USDC request with 200 TEST collateral, cancelled, collateral returned |
| 6 | OrderBook | Partial fill | 1,000 USDC order, borrower takes 400. Order stays OPEN, available = 600 |
| 7 | Platform Fee | 10% of interest to treasury | 20 USDC interest on 1,000 USDC loan. Treasury gets 2 USDC, lender gets 1,018 |
| 8 | Risk Engine | Reject loan exceeding exposure limit | Max exposure 500 USDC, attempt 600. Reverts: "Token exposure limit reached" |
| 9 | Risk Engine | Reject non-whitelisted token | Loan with unwhitelisted token reverts |
| 10 | Collateral | Lock on creation, release on repay | 300 TEST sent, 250 TEST locked (required by LTV). 250 TEST returned on repay |
| 11 | Borrow Request | Lender fills a borrow request | Borrower posts 500 USDC request, lender fills. Loan ACTIVE with correct parties |
| 12 | Emergency Pause | Block new orders when paused | OrderBook paused, lending order attempt reverts with `EnforcedPause` |
| 13 | Emergency Pause | Allow repayment when paused | LoanManager paused, repayment succeeds. Status = REPAID |
| 14 | Price Oracle | Correct price from Chainlink feed | Returns 10 USDC (6 decimals), confidence = true |
| 15 | Price Oracle | Correct USDC value calculation | 100 TEST at $10 each = 1,000 USDC |

---

## Fuzz & Invariant Tests (45) — Foundry

**Framework:** Foundry (forge) with forge-std
**Directory:** `test/foundry/`
**Command:** `forge test -vv`
**Result:** 45/45 passing, 1000 randomized runs per test

Each fuzz test receives random inputs bounded to realistic ranges and asserts that mathematical properties hold for every combination. Harness contracts replicate core protocol math in isolation, eliminating external dependencies.

### InterestCalculator (15 tests)

**File:** `test/foundry/InterestCalculator.fuzz.t.sol`

| # | Test | Property Verified |
|---|------|-------------------|
| 1 | `testFuzz_zeroPrincipalReturnsZeroInterest` | Zero principal yields zero interest for all durations |
| 2 | `testFuzz_interestNeverExceeds8Percent` | Interest is always <= 800 BPS (8%) of principal |
| 3 | `testFuzz_completedLoanChargesAtLeast2Percent` | Completed loans always charge >= 200 BPS (2%) |
| 4 | `testFuzz_monotonicInterest_7d` | Longer elapsed time never decreases interest (7d) |
| 5 | `testFuzz_monotonicInterest_14d` | Longer elapsed time never decreases interest (14d) |
| 6 | `testFuzz_monotonicInterest_30d` | Longer elapsed time never decreases interest (30d) |
| 7 | `testFuzz_linearScalingWithPrincipal` | Interest scales linearly with principal (within rounding) |
| 8 | `testFuzz_rateBpsIsValidBracket_7d` | 7d rate is always 200 BPS |
| 9 | `testFuzz_rateBpsIsValidBracket_14d` | 14d rate is always 200 or 400 BPS |
| 10 | `testFuzz_rateBpsIsValidBracket_30d` | 30d rate is always 200, 400, or 800 BPS |
| 11 | `testFuzz_bracketBoundary_14d` | Exact bracket transition at 7 days for 14d loans |
| 12 | `testFuzz_bracketBoundary_30d` | Exact bracket transitions at 7d and 14d for 30d loans |
| 13 | `testFuzz_interestMatchesFormula` | Interest == principal * rateBps / 10000 |
| 14 | `test_durationSecondsAreCorrect` | Duration constants: 7d, 14d, 30d in seconds |
| 15 | `test_maxInterestBpsAreCorrect` | Max BPS constants: 200, 400, 800 |

### Health Factor (9 tests)

**File:** `test/foundry/HealthFactor.fuzz.t.sol`

| # | Test | Property Verified |
|---|------|-------------------|
| 1 | `testFuzz_zeroDebtReturnsMaxHF` | Zero debt returns max uint256 health factor |
| 2 | `testFuzz_zeroDebtIsNotLiquidatable` | Zero debt is never liquidatable |
| 3 | `testFuzz_hfDecreasesWhenCollateralDecreases` | HF monotonically decreases with collateral |
| 4 | `testFuzz_hfIncreasesWhenDebtDecreases` | HF monotonically increases as debt shrinks |
| 5 | `testFuzz_hfBelowOneIsLiquidatable` | HF < 1.0 always flagged as liquidatable |
| 6 | `testFuzz_isLiquidatableConsistentWithHF` | isLiquidatable() consistent with calculateHealthFactor() |
| 7 | `testFuzz_hfFormulaIsCorrect` | HF = (collateralValue * threshold) / debt |
| 8 | `testFuzz_hfIncreasesWithHigherThreshold` | Higher threshold produces higher or equal HF |
| 9 | `test_exactBoundaryIsLiquidatable` | HF == 1.0 (10000 BPS) is liquidatable |

### Proceeds Distribution (9 tests)

**File:** `test/foundry/ProceedsDistribution.fuzz.t.sol`

| # | Test | Property Verified |
|---|------|-------------------|
| 1 | `testFuzz_totalDistributedEqualsProceeds` | Conservation: total distributed == total proceeds |
| 2 | `testFuzz_platformFeeIsCorrectPercentage` | Platform fee is exactly 10% of interest |
| 3 | `testFuzz_lenderReceivesAtLeastPrincipalWhenSufficient` | Lender gets >= principal when proceeds cover debt |
| 4 | `testFuzz_borrowerGetsNothingUntilLenderWhole` | Borrower gets $0 until lender is fully repaid |
| 5 | `testFuzz_borrowerGetsSurplusWhenExcess` | Surplus goes to borrower after lender is whole |
| 6 | `testFuzz_platformFeePaidFirst` | Platform fee has priority in distribution waterfall |
| 7 | `test_zeroInterestMeansZeroFee` | Zero interest produces zero platform fee |
| 8 | `testFuzz_proceedsExactlyEqualDebt` | Edge case: proceeds exactly cover debt, borrower gets nothing |
| 9 | `testFuzz_noValueCreated` | No payout exceeds total proceeds; sum is exact |

### Risk Parameters (12 tests)

**File:** `test/foundry/RiskParams.fuzz.t.sol`

| # | Test | Property Verified |
|---|------|-------------------|
| 1 | `testFuzz_ltvAlwaysLessThanLiquidationThreshold` | LTV < liquidation threshold (core invariant) |
| 2 | `testFuzz_revertWhenLtvEqualsThreshold` | LTV == threshold always reverts |
| 3 | `testFuzz_revertWhenLtvExceedsThreshold` | LTV > threshold always reverts |
| 4 | `testFuzz_thresholdNeverExceeds90Percent` | Threshold <= 9000 BPS (90%) |
| 5 | `testFuzz_revertWhenThresholdExceeds90Percent` | Threshold > 90% always reverts |
| 6 | `testFuzz_exposureLimitAlwaysPositive` | Exposure limit > 0 after successful set |
| 7 | `test_revertWhenExposureIsZero` | Zero exposure always reverts |
| 8 | `test_revertWhenLtvIsZero` | Zero LTV always reverts |
| 9 | `test_allProtocolTiersAreValid` | All 4 protocol tiers (40/60, 35/55, 30/50, 25/50) pass validation |
| 10 | `testFuzz_randomValidParamsStoreCorrectly` | Valid params stored and retrieved correctly |
| 11 | `testFuzz_safetyGapBetweenLtvAndThreshold` | Gap >= 1 BPS between LTV and threshold |
| 12 | `testFuzz_overwriteParamsPreservesInvariants` | Overwriting params preserves all invariants |

**Key properties verified across all 45 fuzz tests:**

- Interest never exceeds 8%, always >= 2% for completed loans, scales linearly, matches `principal * rateBps / 10000` exactly.
- Health factor is monotonic in collateral and debt, zero-debt positions are never liquidatable, HF == 1.0 boundary is liquidatable.
- Proceeds distribution conserves value (no USDC created or lost), respects payment priority (treasury, lender, borrower).
- Risk parameters enforce LTV < threshold < 90%, positive exposure, and minimum safety gap across all updates.

---

## Integration Tests (24) — Base Mainnet

**Framework:** Node.js web panel (`scripts/test-panel-web.js` spawning `scripts/test-panel.js`)
**Network:** Base Mainnet (chain ID 8453)
**Port:** `http://localhost:4000`
**Command:** `npm run test-panel`

These tests execute real on-chain transactions against deployed contracts, using live Chainlink oracles, real DEX routers, and real gas. They cover scenarios that local mocks cannot replicate.

### Core Protocol

| ID | Test | Description |
|----|------|-------------|
| diag | Diagnostics | Verify contract configuration, wallet balances, token whitelist, oracle feed, risk params, pause state |
| test1 | Lending Order | Create USDC lending order, verify on-chain state, cancel, confirm full refund |
| test2 | Borrow with Collateral | Create lending order, take loan with collateral, verify ACTIVE status and locked collateral |
| test3 | Repayment (2%) | 7-day bracket loan, early repayment, verify 2% interest and collateral release |

### Interest Brackets

| ID | Test | Description |
|----|------|-------------|
| test4 | Bracket 2 (4%) | 30-day loan, wait >7 days on mainnet, repay, verify 4% interest |
| test15 | Bracket 3 (8%) | 30-day loan, wait >14 days on mainnet, repay, verify 8% interest |

### Liquidations

| ID | Test | Description |
|----|------|-------------|
| test5 | Liquidation by Price Drop | Manipulate TWAP downward (~20 min), breach threshold, liquidate, verify DEX swap and debt recovery |
| test11 | Underwater Liquidation | Crash price until debt > collateral value, verify protocol handles bad debt gracefully |
| test16 | Expiry Liquidation | Wait past expiration + grace period, liquidate on time expiry |
| test17 | Cascading Liquidations | Multiple loans, price crash, sequential liquidations execute independently |
| test23 | Flash Liquidation | Instant price crash, immediate liquidation in same block window |

### Oracle & TWAP

| ID | Test | Description |
|----|------|-------------|
| test7 | Circuit Breaker | Price drop >30% triggers automatic token pause, new loans blocked |
| test14 | TWAP Protection | Rapid manipulation attempt rejected by TWAP smoothing and cooldown enforcement |
| test22 | Oracle Liveness | Detect stale oracle data, enforce cooldown, reject operations on stale feeds |

### DEX & Routing

| ID | Test | Description |
|----|------|-------------|
| test12 | Slippage Revert | Liquidation swap reverts when slippage exceeds configured maximum |
| test13 | Router Fallback | Primary router fails, LiquidationEngine falls back to secondary router |
| test24 | Zero DEX Liquidity | Liquidation with zero pool liquidity fails gracefully, no stuck state |

### Risk & Limits

| ID | Test | Description |
|----|------|-------------|
| test8 | Reserve Fund | `coverBadDebt` from reserve fund covers liquidation shortfall |
| test9 | Spam Protection | Enforce per-user order limit, reject excess orders |
| test10 | Loan Limit | Enforce per-token loan limit, prevent resource exhaustion |
| test18 | Exposure Limit | Loans up to per-token exposure cap, next loan rejected |

### Stress & Adversarial

| ID | Test | Description |
|----|------|-------------|
| test19 | Random Ops (Stress) | Randomized sequences of create, borrow, repay, cancel. Verify no reverts or inconsistent state |
| test20 | Death Spiral | 95% price crash triggers mass liquidations, then recovery to verify protocol resumes |
| test21 | Governance Abuse | Unprivileged wallet attempts role escalation, all attempts revert |

---

## Running Tests

```bash
npx hardhat test          # 15 unit tests
forge test -vv            # 45 fuzz tests (1000 runs each)
npm run test-panel        # 24 integration tests (web panel on port 4000)
```

---

## Coverage Matrix

| Category | Unit | Fuzz | Integration | What It Validates |
|----------|:----:|:----:|:-----------:|-------------------|
| Interest Calculation | 3 | 15 | 2 | Bracket math, boundaries, linear scaling, formula correctness |
| Health Factor | -- | 9 | -- | HF formula, monotonicity, liquidation boundary |
| Proceeds Distribution | -- | 9 | -- | Conservation, payment priority, surplus routing |
| Risk Parameters | 2 | 12 | 1 | LTV/threshold invariants, tier validation, overwrite safety |
| Order Book | 3 | -- | 1 | Create, cancel, partial fills, on-chain state |
| Platform Fee | 1 | -- | -- | 10% fee split to treasury |
| Collateral | 1 | -- | 1 | Lock on creation, release on repayment |
| Borrow Request Flow | 1 | -- | -- | Reverse order flow (borrower-initiated) |
| Emergency Pause | 2 | -- | 1 | Pause blocks new activity, repayment always allowed |
| Price Oracle | 2 | -- | 2 | Chainlink feed, TWAP, liveness, staleness |
| Liquidations | -- | -- | 5 | Price drop, underwater, expiry, cascading, flash |
| DEX / Routing | -- | -- | 3 | Slippage revert, router fallback, zero liquidity |
| Spam / DOS Protection | -- | -- | 2 | Order limits, loan limits |
| Reserve Fund | -- | -- | 1 | Bad debt coverage |
| Stress Testing | -- | -- | 1 | Randomized ops, state consistency |
| Extreme Market | -- | -- | 1 | 95% crash + recovery (death spiral) |
| Governance / Security | -- | -- | 1 | Unauthorized role escalation |
| Protocol Diagnostics | -- | -- | 1 | Config verification, balance checks |
| Cleanup | -- | -- | 1 | State reset (repay, unpause, cancel) |
| **Total** | **15** | **45** | **24** | **84 scenarios** |
