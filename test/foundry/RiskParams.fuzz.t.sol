// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

/// @notice Harness that replicates the risk parameter validation logic from
///         RiskEngine.setTokenRiskParams without external dependencies.
contract RiskParamsHarness {
    uint256 public constant BPS_DENOMINATOR = 10_000;

    struct TokenRiskParams {
        uint256 ltvBps;
        uint256 liquidationThresholdBps;
        uint256 maxExposure;
        bool isActive;
    }

    mapping(address => TokenRiskParams) public tokenRiskParams;

    /// @notice Mimics RiskEngine.setTokenRiskParams validation
    function setTokenRiskParams(
        address token,
        uint256 ltvBps,
        uint256 liquidationThresholdBps,
        uint256 maxExposure
    ) external {
        require(ltvBps > 0 && ltvBps < liquidationThresholdBps, "Invalid LTV");
        require(liquidationThresholdBps <= 9000, "Threshold too high");
        require(maxExposure > 0, "Invalid max exposure");

        tokenRiskParams[token] = TokenRiskParams({
            ltvBps: ltvBps,
            liquidationThresholdBps: liquidationThresholdBps,
            maxExposure: maxExposure,
            isActive: true
        });
    }

    /// @notice Get stored params
    function getParams(address token) external view returns (
        uint256 ltvBps,
        uint256 liquidationThresholdBps,
        uint256 maxExposure,
        bool isActive
    ) {
        TokenRiskParams storage p = tokenRiskParams[token];
        return (p.ltvBps, p.liquidationThresholdBps, p.maxExposure, p.isActive);
    }
}

contract RiskParamsFuzzTest is Test {
    RiskParamsHarness harness;

    uint256 constant BPS_DENOMINATOR = 10_000;

    // Protocol-defined tier values from RiskEngine docs
    uint256 constant LTV_TIER1 = 4000; // 40%
    uint256 constant LIQ_TIER1 = 6000; // 60%
    uint256 constant LTV_TIER2 = 3500; // 35%
    uint256 constant LIQ_TIER2 = 5500; // 55%
    uint256 constant LTV_TIER3 = 3000; // 30%
    uint256 constant LIQ_TIER3 = 5000; // 50%
    uint256 constant LTV_TIER4 = 2500; // 25%
    uint256 constant LIQ_TIER4 = 5000; // 50%

    function setUp() public {
        harness = new RiskParamsHarness();
    }

    // ================================================================
    //       LTV IS ALWAYS < LIQUIDATION THRESHOLD (INVARIANT)
    // ================================================================

    function testFuzz_ltvAlwaysLessThanLiquidationThreshold(
        uint256 ltvBps,
        uint256 liquidationThresholdBps,
        uint256 maxExposure
    ) public {
        ltvBps = bound(ltvBps, 1, 8999);
        liquidationThresholdBps = bound(liquidationThresholdBps, ltvBps + 1, 9000);
        maxExposure = bound(maxExposure, 1, type(uint128).max);

        address token = address(uint160(uint256(keccak256(abi.encode(ltvBps, liquidationThresholdBps)))));

        harness.setTokenRiskParams(token, ltvBps, liquidationThresholdBps, maxExposure);

        (uint256 storedLtv, uint256 storedLiq,,) = harness.getParams(token);
        assertLt(storedLtv, storedLiq, "LTV must be strictly less than liquidation threshold");
    }

    // ================================================================
    //    SETTING LTV >= THRESHOLD ALWAYS REVERTS
    // ================================================================

    function testFuzz_revertWhenLtvEqualsThreshold(uint256 value) public {
        value = bound(value, 1, 9000);
        address token = address(0xBEEF);

        vm.expectRevert("Invalid LTV");
        harness.setTokenRiskParams(token, value, value, 1e18);
    }

    function testFuzz_revertWhenLtvExceedsThreshold(uint256 ltvBps, uint256 liquidationThresholdBps) public {
        ltvBps = bound(ltvBps, 2, 9000);
        liquidationThresholdBps = bound(liquidationThresholdBps, 1, ltvBps - 1);
        address token = address(0xBEEF);

        vm.expectRevert("Invalid LTV");
        harness.setTokenRiskParams(token, ltvBps, liquidationThresholdBps, 1e18);
    }

    // ================================================================
    //    LIQUIDATION THRESHOLD IS ALWAYS <= 90% (9000 BPS)
    // ================================================================

    function testFuzz_thresholdNeverExceeds90Percent(uint256 ltvBps, uint256 liquidationThresholdBps) public {
        liquidationThresholdBps = bound(liquidationThresholdBps, 2, 9000);
        ltvBps = bound(ltvBps, 1, liquidationThresholdBps - 1);
        address token = address(uint160(uint256(keccak256(abi.encode(ltvBps)))));

        harness.setTokenRiskParams(token, ltvBps, liquidationThresholdBps, 1e18);

        (, uint256 storedLiq,,) = harness.getParams(token);
        assertLe(storedLiq, 9000, "Liquidation threshold exceeds 90%");
    }

    function testFuzz_revertWhenThresholdExceeds90Percent(uint256 threshold) public {
        threshold = bound(threshold, 9001, type(uint16).max);
        address token = address(0xBEEF);

        vm.expectRevert("Threshold too high");
        harness.setTokenRiskParams(token, 1000, threshold, 1e18);
    }

    // ================================================================
    //       EXPOSURE LIMIT IS ALWAYS > 0
    // ================================================================

    function testFuzz_exposureLimitAlwaysPositive(uint256 maxExposure) public {
        maxExposure = bound(maxExposure, 1, type(uint128).max);
        address token = address(0xBEEF);

        harness.setTokenRiskParams(token, 3000, 5000, maxExposure);

        (,, uint256 storedExposure,) = harness.getParams(token);
        assertGt(storedExposure, 0, "Exposure limit must be positive");
    }

    function test_revertWhenExposureIsZero() public {
        address token = address(0xBEEF);

        vm.expectRevert("Invalid max exposure");
        harness.setTokenRiskParams(token, 3000, 5000, 0);
    }

    // ================================================================
    //       LTV CANNOT BE ZERO
    // ================================================================

    function test_revertWhenLtvIsZero() public {
        address token = address(0xBEEF);

        vm.expectRevert("Invalid LTV");
        harness.setTokenRiskParams(token, 0, 5000, 1e18);
    }

    // ================================================================
    //    PROTOCOL TIERS ARE ALL VALID ACCORDING TO CONSTRAINTS
    // ================================================================

    function test_allProtocolTiersAreValid() public {
        // Tier 1: Market Cap > $150M
        address t1 = address(0x1);
        harness.setTokenRiskParams(t1, LTV_TIER1, LIQ_TIER1, 500_000e6);
        (uint256 ltv1, uint256 liq1, uint256 exp1, bool active1) = harness.getParams(t1);
        assertLt(ltv1, liq1);
        assertLe(liq1, 9000);
        assertGt(exp1, 0);
        assertTrue(active1);

        // Tier 2: Market Cap > $100M
        address t2 = address(0x2);
        harness.setTokenRiskParams(t2, LTV_TIER2, LIQ_TIER2, 300_000e6);
        (uint256 ltv2, uint256 liq2,,) = harness.getParams(t2);
        assertLt(ltv2, liq2);

        // Tier 3: Market Cap > $50M
        address t3 = address(0x3);
        harness.setTokenRiskParams(t3, LTV_TIER3, LIQ_TIER3, 200_000e6);
        (uint256 ltv3, uint256 liq3,,) = harness.getParams(t3);
        assertLt(ltv3, liq3);

        // Tier 4: Market Cap > $20M
        address t4 = address(0x4);
        harness.setTokenRiskParams(t4, LTV_TIER4, LIQ_TIER4, 100_000e6);
        (uint256 ltv4, uint256 liq4,,) = harness.getParams(t4);
        assertLt(ltv4, liq4);
    }

    // ================================================================
    //  FUZZ TIER ASSIGNMENTS: RANDOM BUT VALID PARAMS ALWAYS HOLD
    // ================================================================

    function testFuzz_randomValidParamsStoreCorrectly(
        uint256 ltvBps,
        uint256 liquidationThresholdBps,
        uint256 maxExposure,
        uint160 tokenSeed
    ) public {
        liquidationThresholdBps = bound(liquidationThresholdBps, 2, 9000);
        ltvBps = bound(ltvBps, 1, liquidationThresholdBps - 1);
        maxExposure = bound(maxExposure, 1, type(uint128).max);
        address token = address(tokenSeed);

        harness.setTokenRiskParams(token, ltvBps, liquidationThresholdBps, maxExposure);

        (uint256 storedLtv, uint256 storedLiq, uint256 storedExp, bool storedActive) = harness.getParams(token);

        assertEq(storedLtv, ltvBps, "LTV not stored correctly");
        assertEq(storedLiq, liquidationThresholdBps, "Threshold not stored correctly");
        assertEq(storedExp, maxExposure, "Exposure not stored correctly");
        assertTrue(storedActive, "Should be active after setting");

        // Invariants still hold
        assertLt(storedLtv, storedLiq, "LTV >= threshold after store");
        assertLe(storedLiq, 9000, "Threshold > 90% after store");
        assertGt(storedExp, 0, "Exposure == 0 after store");
    }

    // ================================================================
    //    SAFETY GAP: LTV AND THRESHOLD ALWAYS HAVE >= 1 BPS GAP
    // ================================================================

    function testFuzz_safetyGapBetweenLtvAndThreshold(
        uint256 ltvBps,
        uint256 liquidationThresholdBps,
        uint256 maxExposure
    ) public {
        liquidationThresholdBps = bound(liquidationThresholdBps, 2, 9000);
        ltvBps = bound(ltvBps, 1, liquidationThresholdBps - 1);
        maxExposure = bound(maxExposure, 1, type(uint128).max);
        address token = address(0xCAFE);

        harness.setTokenRiskParams(token, ltvBps, liquidationThresholdBps, maxExposure);

        (uint256 storedLtv, uint256 storedLiq,,) = harness.getParams(token);
        uint256 gap = storedLiq - storedLtv;

        assertGe(gap, 1, "Gap between LTV and threshold must be at least 1 bps");
    }

    // ================================================================
    //   OVERWRITING PARAMS PRESERVES INVARIANTS
    // ================================================================

    function testFuzz_overwriteParamsPreservesInvariants(
        uint256 ltv1,
        uint256 liq1,
        uint256 exp1,
        uint256 ltv2,
        uint256 liq2,
        uint256 exp2
    ) public {
        address token = address(0xDEAD);

        liq1 = bound(liq1, 2, 9000);
        ltv1 = bound(ltv1, 1, liq1 - 1);
        exp1 = bound(exp1, 1, type(uint128).max);

        liq2 = bound(liq2, 2, 9000);
        ltv2 = bound(ltv2, 1, liq2 - 1);
        exp2 = bound(exp2, 1, type(uint128).max);

        harness.setTokenRiskParams(token, ltv1, liq1, exp1);
        harness.setTokenRiskParams(token, ltv2, liq2, exp2);

        (uint256 storedLtv, uint256 storedLiq, uint256 storedExp,) = harness.getParams(token);

        assertEq(storedLtv, ltv2, "Overwrite should use new LTV");
        assertEq(storedLiq, liq2, "Overwrite should use new threshold");
        assertEq(storedExp, exp2, "Overwrite should use new exposure");
        assertLt(storedLtv, storedLiq, "Invariant broken after overwrite");
    }
}
