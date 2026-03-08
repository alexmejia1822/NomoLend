// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

/// @notice Standalone harness that replicates the health factor and liquidation logic
///         from RiskEngine without needing external dependencies (PriceOracle, etc.)
///         This tests the pure math in isolation.
contract HealthFactorHarness {
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Replicates RiskEngine.calculateHealthFactor
    /// @param collateralValueUsdc Value of collateral in USDC (6 decimals)
    /// @param liquidationThresholdBps Liquidation threshold in basis points
    /// @param debtUsdc Total debt in USDC (6 decimals)
    /// @return healthFactor In basis points (10000 = 1.0)
    function calculateHealthFactor(
        uint256 collateralValueUsdc,
        uint256 liquidationThresholdBps,
        uint256 debtUsdc
    ) external pure returns (uint256 healthFactor) {
        if (debtUsdc == 0) return type(uint256).max;
        healthFactor = (collateralValueUsdc * liquidationThresholdBps) / debtUsdc;
    }

    /// @notice Replicates RiskEngine.isLiquidatable
    function isLiquidatable(
        uint256 collateralValueUsdc,
        uint256 liquidationThresholdBps,
        uint256 debtUsdc
    ) external pure returns (bool) {
        if (debtUsdc == 0) return false;
        return (collateralValueUsdc * liquidationThresholdBps) <= (debtUsdc * BPS_DENOMINATOR);
    }
}

contract HealthFactorFuzzTest is Test {
    HealthFactorHarness harness;

    uint256 constant BPS_DENOMINATOR = 10_000;

    // Realistic ranges
    uint256 constant MIN_THRESHOLD = 5000; // 50%
    uint256 constant MAX_THRESHOLD = 6000; // 60%
    uint256 constant MIN_DEBT_USDC = 10e6;       // 10 USDC
    uint256 constant MAX_DEBT_USDC = 100_000e6;  // 100,000 USDC
    uint256 constant MIN_COLLATERAL_VALUE = 1e6;  // 1 USDC
    uint256 constant MAX_COLLATERAL_VALUE = 1_000_000e6; // 1M USDC

    function setUp() public {
        harness = new HealthFactorHarness();
    }

    // ================================================================
    //            HF = MAX when debt is zero
    // ================================================================

    function testFuzz_zeroDebtReturnsMaxHF(uint256 collateralValue, uint256 threshold) public view {
        collateralValue = bound(collateralValue, 0, MAX_COLLATERAL_VALUE);
        threshold = bound(threshold, MIN_THRESHOLD, MAX_THRESHOLD);

        uint256 hf = harness.calculateHealthFactor(collateralValue, threshold, 0);
        assertEq(hf, type(uint256).max, "Zero debt should return max uint256");
    }

    // ================================================================
    //        HF = 0 is NOT liquidatable when debt is zero
    // ================================================================

    function testFuzz_zeroDebtIsNotLiquidatable(uint256 collateralValue, uint256 threshold) public view {
        collateralValue = bound(collateralValue, 0, MAX_COLLATERAL_VALUE);
        threshold = bound(threshold, MIN_THRESHOLD, MAX_THRESHOLD);

        bool liq = harness.isLiquidatable(collateralValue, threshold, 0);
        assertFalse(liq, "Zero debt should never be liquidatable");
    }

    // ================================================================
    //       HF DECREASES WHEN COLLATERAL VALUE DECREASES
    // ================================================================

    function testFuzz_hfDecreasesWhenCollateralDecreases(
        uint256 collateralHigh,
        uint256 collateralLow,
        uint256 threshold,
        uint256 debt
    ) public view {
        debt = bound(debt, MIN_DEBT_USDC, MAX_DEBT_USDC);
        threshold = bound(threshold, MIN_THRESHOLD, MAX_THRESHOLD);
        collateralHigh = bound(collateralHigh, MIN_COLLATERAL_VALUE, MAX_COLLATERAL_VALUE);
        collateralLow = bound(collateralLow, MIN_COLLATERAL_VALUE, collateralHigh);

        uint256 hfHigh = harness.calculateHealthFactor(collateralHigh, threshold, debt);
        uint256 hfLow = harness.calculateHealthFactor(collateralLow, threshold, debt);

        assertGe(hfHigh, hfLow, "HF should decrease when collateral decreases");
    }

    // ================================================================
    //       HF INCREASES WHEN DEBT DECREASES
    // ================================================================

    function testFuzz_hfIncreasesWhenDebtDecreases(
        uint256 collateralValue,
        uint256 threshold,
        uint256 debtHigh,
        uint256 debtLow
    ) public view {
        collateralValue = bound(collateralValue, MIN_COLLATERAL_VALUE, MAX_COLLATERAL_VALUE);
        threshold = bound(threshold, MIN_THRESHOLD, MAX_THRESHOLD);
        debtHigh = bound(debtHigh, MIN_DEBT_USDC, MAX_DEBT_USDC);
        debtLow = bound(debtLow, MIN_DEBT_USDC, debtHigh);

        uint256 hfHigh = harness.calculateHealthFactor(collateralValue, threshold, debtHigh);
        uint256 hfLow = harness.calculateHealthFactor(collateralValue, threshold, debtLow);

        assertGe(hfLow, hfHigh, "HF should increase when debt decreases");
    }

    // ================================================================
    //       HF < BPS_DENOMINATOR MEANS UNDERCOLLATERALIZED
    // ================================================================

    function testFuzz_hfBelowOneIsLiquidatable(
        uint256 collateralValue,
        uint256 threshold,
        uint256 debt
    ) public view {
        debt = bound(debt, MIN_DEBT_USDC, MAX_DEBT_USDC);
        threshold = bound(threshold, MIN_THRESHOLD, MAX_THRESHOLD);
        collateralValue = bound(collateralValue, MIN_COLLATERAL_VALUE, MAX_COLLATERAL_VALUE);

        uint256 hf = harness.calculateHealthFactor(collateralValue, threshold, debt);
        bool liq = harness.isLiquidatable(collateralValue, threshold, debt);

        // HF < 10000 (1.0) means collateralValue * threshold < debt * BPS_DENOMINATOR
        // which is exactly the liquidation condition
        if (hf < BPS_DENOMINATOR) {
            assertTrue(liq, "HF < 1.0 should be liquidatable");
        }

        // HF > 10000 means healthy (not liquidatable)
        if (hf > BPS_DENOMINATOR) {
            assertFalse(liq, "HF > 1.0 should NOT be liquidatable");
        }
    }

    // ================================================================
    //  CONSISTENCY: isLiquidatable matches calculateHealthFactor boundary
    // ================================================================

    function testFuzz_isLiquidatableConsistentWithHF(
        uint256 collateralValue,
        uint256 threshold,
        uint256 debt
    ) public view {
        debt = bound(debt, MIN_DEBT_USDC, MAX_DEBT_USDC);
        threshold = bound(threshold, MIN_THRESHOLD, MAX_THRESHOLD);
        collateralValue = bound(collateralValue, MIN_COLLATERAL_VALUE, MAX_COLLATERAL_VALUE);

        uint256 hf = harness.calculateHealthFactor(collateralValue, threshold, debt);
        bool liq = harness.isLiquidatable(collateralValue, threshold, debt);

        // isLiquidatable: collateralValue * threshold <= debt * BPS_DENOMINATOR
        // HF = collateralValue * threshold / debt
        // liq iff HF <= BPS_DENOMINATOR (i.e., HF <= 1.0)
        if (liq) {
            assertLe(hf, BPS_DENOMINATOR, "Liquidatable but HF > 1.0");
        } else {
            assertGt(hf, BPS_DENOMINATOR, "Not liquidatable but HF <= 1.0");
        }
    }

    // ================================================================
    //      HF FORMULA IS CORRECT: collateralValue * threshold / debt
    // ================================================================

    function testFuzz_hfFormulaIsCorrect(
        uint256 collateralValue,
        uint256 threshold,
        uint256 debt
    ) public view {
        debt = bound(debt, MIN_DEBT_USDC, MAX_DEBT_USDC);
        threshold = bound(threshold, MIN_THRESHOLD, MAX_THRESHOLD);
        // Keep collateral bounded to avoid overflow in multiplication
        collateralValue = bound(collateralValue, MIN_COLLATERAL_VALUE, MAX_COLLATERAL_VALUE);

        uint256 hf = harness.calculateHealthFactor(collateralValue, threshold, debt);
        uint256 expected = (collateralValue * threshold) / debt;

        assertEq(hf, expected, "HF formula mismatch");
    }

    // ================================================================
    //       HF INCREASES WITH HIGHER THRESHOLD
    // ================================================================

    function testFuzz_hfIncreasesWithHigherThreshold(
        uint256 collateralValue,
        uint256 thresholdLow,
        uint256 thresholdHigh,
        uint256 debt
    ) public view {
        debt = bound(debt, MIN_DEBT_USDC, MAX_DEBT_USDC);
        collateralValue = bound(collateralValue, MIN_COLLATERAL_VALUE, MAX_COLLATERAL_VALUE);
        thresholdLow = bound(thresholdLow, MIN_THRESHOLD, MAX_THRESHOLD);
        thresholdHigh = bound(thresholdHigh, thresholdLow, MAX_THRESHOLD);

        uint256 hfLow = harness.calculateHealthFactor(collateralValue, thresholdLow, debt);
        uint256 hfHigh = harness.calculateHealthFactor(collateralValue, thresholdHigh, debt);

        assertGe(hfHigh, hfLow, "Higher threshold should give higher or equal HF");
    }

    // ================================================================
    //       EXACT BOUNDARY: HF == BPS_DENOMINATOR is liquidatable
    // ================================================================

    function test_exactBoundaryIsLiquidatable() public view {
        // collateralValue * threshold == debt * BPS_DENOMINATOR
        // Set collateralValue=200e6, threshold=5000, debt=100e6
        // HF = 200e6 * 5000 / 100e6 = 10000 exactly
        uint256 hf = harness.calculateHealthFactor(200e6, 5000, 100e6);
        assertEq(hf, BPS_DENOMINATOR, "Should be exactly 1.0");

        // isLiquidatable uses <= so exactly 1.0 IS liquidatable
        bool liq = harness.isLiquidatable(200e6, 5000, 100e6);
        assertTrue(liq, "Exactly at boundary should be liquidatable");
    }
}
