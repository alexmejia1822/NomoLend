// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../contracts/interfaces/INomoLend.sol";
import "../../contracts/libraries/InterestCalculator.sol";

/// @notice Wrapper contract to expose the InterestCalculator library functions for testing
contract InterestCalculatorHarness {
    function calculateInterest(
        uint256 principal,
        INomoLend.Duration duration,
        uint256 elapsed
    ) external pure returns (uint256 interest, uint256 rateBps) {
        return InterestCalculator.calculateInterest(principal, duration, elapsed);
    }

    function getDurationSeconds(INomoLend.Duration duration) external pure returns (uint256) {
        return InterestCalculator.getDurationSeconds(duration);
    }

    function getMaxInterestBps(INomoLend.Duration duration) external pure returns (uint256) {
        return InterestCalculator.getMaxInterestBps(duration);
    }
}

contract InterestCalculatorFuzzTest is Test {
    InterestCalculatorHarness harness;

    uint256 constant BPS_DENOMINATOR = 10_000;
    uint256 constant INTEREST_7D  = 200;
    uint256 constant INTEREST_14D = 400;
    uint256 constant INTEREST_30D = 800;

    uint256 constant SEVEN_DAYS    = 7 days;
    uint256 constant FOURTEEN_DAYS = 14 days;
    uint256 constant THIRTY_DAYS   = 30 days;

    // Realistic USDC range: 10 USDC (min loan) to 10M USDC
    uint256 constant MIN_PRINCIPAL = 10e6;
    uint256 constant MAX_PRINCIPAL = 10_000_000e6;

    function setUp() public {
        harness = new InterestCalculatorHarness();
    }

    // ================================================================
    //                    ZERO PRINCIPAL TESTS
    // ================================================================

    function testFuzz_zeroPrincipalReturnsZeroInterest(uint256 elapsed) public view {
        elapsed = bound(elapsed, 0, 365 days);

        (uint256 interest7,) = harness.calculateInterest(0, INomoLend.Duration.SEVEN_DAYS, elapsed);
        (uint256 interest14,) = harness.calculateInterest(0, INomoLend.Duration.FOURTEEN_DAYS, elapsed);
        (uint256 interest30,) = harness.calculateInterest(0, INomoLend.Duration.THIRTY_DAYS, elapsed);

        assertEq(interest7, 0, "Zero principal should yield zero interest (7d)");
        assertEq(interest14, 0, "Zero principal should yield zero interest (14d)");
        assertEq(interest30, 0, "Zero principal should yield zero interest (30d)");
    }

    // ================================================================
    //              INTEREST NEVER EXCEEDS 8% (800 BPS)
    // ================================================================

    function testFuzz_interestNeverExceeds8Percent(uint256 principal, uint256 elapsed) public view {
        principal = bound(principal, 1, type(uint128).max);
        elapsed = bound(elapsed, 0, 365 days);

        (uint256 interest7,) = harness.calculateInterest(principal, INomoLend.Duration.SEVEN_DAYS, elapsed);
        (uint256 interest14,) = harness.calculateInterest(principal, INomoLend.Duration.FOURTEEN_DAYS, elapsed);
        (uint256 interest30,) = harness.calculateInterest(principal, INomoLend.Duration.THIRTY_DAYS, elapsed);

        uint256 maxInterest = (principal * INTEREST_30D) / BPS_DENOMINATOR;

        assertLe(interest7, maxInterest, "7d interest exceeds 8%");
        assertLe(interest14, maxInterest, "14d interest exceeds 8%");
        assertLe(interest30, maxInterest, "30d interest exceeds 8%");
    }

    // ================================================================
    //         COMPLETED LOAN ALWAYS CHARGES AT LEAST 2% (200 BPS)
    // ================================================================

    function testFuzz_completedLoanChargesAtLeast2Percent(uint256 principal) public view {
        principal = bound(principal, MIN_PRINCIPAL, MAX_PRINCIPAL);

        uint256 minInterest = (principal * INTEREST_7D) / BPS_DENOMINATOR;

        // A completed loan uses any elapsed time (the bracket minimum is 2%)
        (uint256 interest7,) = harness.calculateInterest(principal, INomoLend.Duration.SEVEN_DAYS, SEVEN_DAYS);
        (uint256 interest14,) = harness.calculateInterest(principal, INomoLend.Duration.FOURTEEN_DAYS, FOURTEEN_DAYS);
        (uint256 interest30,) = harness.calculateInterest(principal, INomoLend.Duration.THIRTY_DAYS, THIRTY_DAYS);

        assertGe(interest7, minInterest, "Completed 7d loan below 2%");
        assertGe(interest14, minInterest, "Completed 14d loan below 2%");
        assertGe(interest30, minInterest, "Completed 30d loan below 2%");
    }

    // ================================================================
    //              MONOTONIC: LONGER ELAPSED NEVER DECREASES INTEREST
    // ================================================================

    function testFuzz_monotonicInterest_7d(uint256 principal, uint256 elapsed1, uint256 elapsed2) public view {
        principal = bound(principal, 1, type(uint128).max);
        elapsed1 = bound(elapsed1, 0, 365 days);
        elapsed2 = bound(elapsed2, elapsed1, 365 days);

        (uint256 interest1,) = harness.calculateInterest(principal, INomoLend.Duration.SEVEN_DAYS, elapsed1);
        (uint256 interest2,) = harness.calculateInterest(principal, INomoLend.Duration.SEVEN_DAYS, elapsed2);

        assertGe(interest2, interest1, "7d: longer elapsed decreased interest");
    }

    function testFuzz_monotonicInterest_14d(uint256 principal, uint256 elapsed1, uint256 elapsed2) public view {
        principal = bound(principal, 1, type(uint128).max);
        elapsed1 = bound(elapsed1, 0, 365 days);
        elapsed2 = bound(elapsed2, elapsed1, 365 days);

        (uint256 interest1,) = harness.calculateInterest(principal, INomoLend.Duration.FOURTEEN_DAYS, elapsed1);
        (uint256 interest2,) = harness.calculateInterest(principal, INomoLend.Duration.FOURTEEN_DAYS, elapsed2);

        assertGe(interest2, interest1, "14d: longer elapsed decreased interest");
    }

    function testFuzz_monotonicInterest_30d(uint256 principal, uint256 elapsed1, uint256 elapsed2) public view {
        principal = bound(principal, 1, type(uint128).max);
        elapsed1 = bound(elapsed1, 0, 365 days);
        elapsed2 = bound(elapsed2, elapsed1, 365 days);

        (uint256 interest1,) = harness.calculateInterest(principal, INomoLend.Duration.THIRTY_DAYS, elapsed1);
        (uint256 interest2,) = harness.calculateInterest(principal, INomoLend.Duration.THIRTY_DAYS, elapsed2);

        assertGe(interest2, interest1, "30d: longer elapsed decreased interest");
    }

    // ================================================================
    //                 LINEAR SCALING WITH PRINCIPAL
    // ================================================================

    function testFuzz_linearScalingWithPrincipal(uint256 principal, uint256 elapsed, uint256 multiplier) public view {
        // Keep values small enough to avoid overflow: principal * multiplier must fit uint256
        principal = bound(principal, 1, type(uint64).max);
        multiplier = bound(multiplier, 1, type(uint64).max);
        elapsed = bound(elapsed, 0, 365 days);

        uint256 scaledPrincipal = principal * multiplier;

        (uint256 interest1,) = harness.calculateInterest(principal, INomoLend.Duration.THIRTY_DAYS, elapsed);
        (uint256 interest2,) = harness.calculateInterest(scaledPrincipal, INomoLend.Duration.THIRTY_DAYS, elapsed);

        // Allow rounding tolerance of `multiplier` wei due to integer division truncation
        // e.g., (p * rate / 10000) * m  vs  (p * m * rate / 10000) differ by at most m-1
        uint256 diff = interest2 > interest1 * multiplier
            ? interest2 - interest1 * multiplier
            : interest1 * multiplier - interest2;
        assertLe(diff, multiplier, "Interest should scale linearly with principal (within rounding)");
    }

    // ================================================================
    //          RATE BPS ALWAYS MATCHES A VALID BRACKET
    // ================================================================

    function testFuzz_rateBpsIsValidBracket_7d(uint256 principal, uint256 elapsed) public view {
        principal = bound(principal, MIN_PRINCIPAL, MAX_PRINCIPAL);
        elapsed = bound(elapsed, 0, 365 days);

        (, uint256 rateBps) = harness.calculateInterest(principal, INomoLend.Duration.SEVEN_DAYS, elapsed);

        // 7-day loans always charge 2%
        assertEq(rateBps, INTEREST_7D, "7d rate should always be 200 bps");
    }

    function testFuzz_rateBpsIsValidBracket_14d(uint256 principal, uint256 elapsed) public view {
        principal = bound(principal, MIN_PRINCIPAL, MAX_PRINCIPAL);
        elapsed = bound(elapsed, 0, 365 days);

        (, uint256 rateBps) = harness.calculateInterest(principal, INomoLend.Duration.FOURTEEN_DAYS, elapsed);

        assertTrue(rateBps == INTEREST_7D || rateBps == INTEREST_14D, "14d rate must be 200 or 400 bps");
    }

    function testFuzz_rateBpsIsValidBracket_30d(uint256 principal, uint256 elapsed) public view {
        principal = bound(principal, MIN_PRINCIPAL, MAX_PRINCIPAL);
        elapsed = bound(elapsed, 0, 365 days);

        (, uint256 rateBps) = harness.calculateInterest(principal, INomoLend.Duration.THIRTY_DAYS, elapsed);

        assertTrue(
            rateBps == INTEREST_7D || rateBps == INTEREST_14D || rateBps == INTEREST_30D,
            "30d rate must be 200, 400, or 800 bps"
        );
    }

    // ================================================================
    //             BRACKET BOUNDARY TESTS (EXACT THRESHOLDS)
    // ================================================================

    function testFuzz_bracketBoundary_14d(uint256 principal) public view {
        principal = bound(principal, MIN_PRINCIPAL, MAX_PRINCIPAL);

        // At exactly 7 days -> 2%
        (, uint256 rateAt7d) = harness.calculateInterest(principal, INomoLend.Duration.FOURTEEN_DAYS, SEVEN_DAYS);
        assertEq(rateAt7d, INTEREST_7D, "14d at exactly 7 days should be 2%");

        // At 7 days + 1 second -> 4%
        (, uint256 rateAfter7d) = harness.calculateInterest(principal, INomoLend.Duration.FOURTEEN_DAYS, SEVEN_DAYS + 1);
        assertEq(rateAfter7d, INTEREST_14D, "14d at 7d+1s should be 4%");
    }

    function testFuzz_bracketBoundary_30d(uint256 principal) public view {
        principal = bound(principal, MIN_PRINCIPAL, MAX_PRINCIPAL);

        // At exactly 7 days -> 2%
        (, uint256 rateAt7d) = harness.calculateInterest(principal, INomoLend.Duration.THIRTY_DAYS, SEVEN_DAYS);
        assertEq(rateAt7d, INTEREST_7D, "30d at exactly 7 days should be 2%");

        // At 7 days + 1 second -> 4%
        (, uint256 rateAfter7d) = harness.calculateInterest(principal, INomoLend.Duration.THIRTY_DAYS, SEVEN_DAYS + 1);
        assertEq(rateAfter7d, INTEREST_14D, "30d at 7d+1s should be 4%");

        // At exactly 14 days -> 4%
        (, uint256 rateAt14d) = harness.calculateInterest(principal, INomoLend.Duration.THIRTY_DAYS, FOURTEEN_DAYS);
        assertEq(rateAt14d, INTEREST_14D, "30d at exactly 14 days should be 4%");

        // At 14 days + 1 second -> 8%
        (, uint256 rateAfter14d) = harness.calculateInterest(principal, INomoLend.Duration.THIRTY_DAYS, FOURTEEN_DAYS + 1);
        assertEq(rateAfter14d, INTEREST_30D, "30d at 14d+1s should be 8%");
    }

    // ================================================================
    //                DURATION SECONDS CONSISTENCY
    // ================================================================

    function test_durationSecondsAreCorrect() public view {
        assertEq(harness.getDurationSeconds(INomoLend.Duration.SEVEN_DAYS), 7 days);
        assertEq(harness.getDurationSeconds(INomoLend.Duration.FOURTEEN_DAYS), 14 days);
        assertEq(harness.getDurationSeconds(INomoLend.Duration.THIRTY_DAYS), 30 days);
    }

    function test_maxInterestBpsAreCorrect() public view {
        assertEq(harness.getMaxInterestBps(INomoLend.Duration.SEVEN_DAYS), 200);
        assertEq(harness.getMaxInterestBps(INomoLend.Duration.FOURTEEN_DAYS), 400);
        assertEq(harness.getMaxInterestBps(INomoLend.Duration.THIRTY_DAYS), 800);
    }

    // ================================================================
    //        INTEREST COMPUTATION MATCHES FORMULA: principal * rateBps / 10000
    // ================================================================

    function testFuzz_interestMatchesFormula(uint256 principal, uint256 elapsed) public view {
        principal = bound(principal, 0, type(uint128).max);
        elapsed = bound(elapsed, 0, 365 days);

        (uint256 interest, uint256 rateBps) = harness.calculateInterest(principal, INomoLend.Duration.THIRTY_DAYS, elapsed);

        uint256 expectedInterest = (principal * rateBps) / BPS_DENOMINATOR;
        assertEq(interest, expectedInterest, "Interest does not match formula");
    }
}
