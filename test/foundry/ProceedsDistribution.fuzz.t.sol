// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

/// @notice Harness that replicates the proceeds distribution logic from
///         LiquidationEngine.distributeProceeds in pure math, without requiring
///         ERC20 transfers or access control.
contract ProceedsDistributionHarness {
    /// @notice Calculate how proceeds are split among treasury, lender, and borrower
    /// @param debtAmount Lender's share of debt (principal + interest - platformFee)
    /// @param platformFee Platform fee portion
    /// @param totalProceeds Total USDC available from liquidation
    /// @return treasuryPayout Amount sent to treasury
    /// @return lenderPayout Amount sent to lender
    /// @return borrowerPayout Surplus returned to borrower
    function calculateDistribution(
        uint256 debtAmount,
        uint256 platformFee,
        uint256 totalProceeds
    ) external pure returns (
        uint256 treasuryPayout,
        uint256 lenderPayout,
        uint256 borrowerPayout
    ) {
        require(totalProceeds > 0, "No proceeds");

        uint256 remaining = totalProceeds;

        // 1. Pay platform fee first
        if (platformFee > 0 && remaining >= platformFee) {
            treasuryPayout = platformFee;
            remaining -= platformFee;
        } else if (platformFee > 0) {
            // Partial fee payment
            treasuryPayout = remaining;
            remaining = 0;
        }

        // 2. Pay lender
        lenderPayout = debtAmount > remaining ? remaining : debtAmount;
        remaining -= lenderPayout;

        // 3. Surplus to borrower
        borrowerPayout = remaining;
    }

    /// @notice Calculate the platform fee from interest (10% of interest = 1000 bps)
    function calculatePlatformFee(uint256 interestAmount) external pure returns (uint256) {
        return (interestAmount * 1000) / 10_000;
    }
}

contract ProceedsDistributionFuzzTest is Test {
    ProceedsDistributionHarness harness;

    uint256 constant PLATFORM_FEE_BPS = 1000; // 10%
    uint256 constant BPS_DENOMINATOR = 10_000;
    uint256 constant MIN_AMOUNT = 10e6;       // 10 USDC
    uint256 constant MAX_AMOUNT = 1_000_000e6; // 1M USDC

    function setUp() public {
        harness = new ProceedsDistributionHarness();
    }

    // ================================================================
    //  CONSERVATION: total distributed == total proceeds (nothing lost)
    // ================================================================

    function testFuzz_totalDistributedEqualsProceeds(
        uint256 principal,
        uint256 interest,
        uint256 totalProceeds
    ) public view {
        principal = bound(principal, MIN_AMOUNT, MAX_AMOUNT);
        interest = bound(interest, 0, (principal * 800) / BPS_DENOMINATOR); // max 8% interest
        totalProceeds = bound(totalProceeds, 1, MAX_AMOUNT * 2);

        uint256 platformFee = harness.calculatePlatformFee(interest);
        uint256 debtAmount = principal + interest - platformFee;

        (uint256 treasury, uint256 lender, uint256 borrower) =
            harness.calculateDistribution(debtAmount, platformFee, totalProceeds);

        assertEq(
            treasury + lender + borrower,
            totalProceeds,
            "Total distributed must equal total proceeds"
        );
    }

    // ================================================================
    //    PLATFORM FEE IS EXACTLY 10% OF INTEREST
    // ================================================================

    function testFuzz_platformFeeIsCorrectPercentage(uint256 interest) public view {
        interest = bound(interest, 0, MAX_AMOUNT);

        uint256 fee = harness.calculatePlatformFee(interest);
        uint256 expected = (interest * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;

        assertEq(fee, expected, "Platform fee does not match 10% of interest");
    }

    // ================================================================
    //  LENDER RECEIVES AT LEAST PRINCIPAL WHEN PROCEEDS ARE SUFFICIENT
    // ================================================================

    function testFuzz_lenderReceivesAtLeastPrincipalWhenSufficient(
        uint256 principal,
        uint256 interest
    ) public view {
        principal = bound(principal, MIN_AMOUNT, MAX_AMOUNT);
        interest = bound(interest, 0, (principal * 800) / BPS_DENOMINATOR);

        uint256 platformFee = harness.calculatePlatformFee(interest);
        uint256 debtAmount = principal + interest - platformFee;
        // Proceeds cover everything: debt + platformFee + surplus
        uint256 totalProceeds = debtAmount + platformFee + 1e6; // +1 USDC surplus

        (, uint256 lenderPayout,) =
            harness.calculateDistribution(debtAmount, platformFee, totalProceeds);

        assertGe(lenderPayout, principal, "Lender should receive at least principal when proceeds sufficient");
    }

    // ================================================================
    //  SURPLUS GOES TO BORROWER ONLY AFTER LENDER IS MADE WHOLE
    // ================================================================

    function testFuzz_borrowerGetsNothingUntilLenderWhole(
        uint256 principal,
        uint256 interest,
        uint256 totalProceeds
    ) public view {
        principal = bound(principal, MIN_AMOUNT, MAX_AMOUNT);
        interest = bound(interest, 0, (principal * 800) / BPS_DENOMINATOR);
        uint256 platformFee = harness.calculatePlatformFee(interest);
        uint256 debtAmount = principal + interest - platformFee;

        // Proceeds less than full debt + fee
        uint256 maxInsufficient = debtAmount + platformFee;
        totalProceeds = bound(totalProceeds, 1, maxInsufficient);

        (uint256 treasury, uint256 lenderPayout, uint256 borrowerPayout) =
            harness.calculateDistribution(debtAmount, platformFee, totalProceeds);

        // If lender didn't get their full debt amount, borrower must get zero
        if (lenderPayout < debtAmount) {
            assertEq(borrowerPayout, 0, "Borrower should get nothing if lender not fully repaid");
        }

        // Conservation still holds
        assertEq(treasury + lenderPayout + borrowerPayout, totalProceeds, "Conservation violated");
    }

    // ================================================================
    //  WHEN PROCEEDS EXCEED TOTAL DEBT, BORROWER GETS SURPLUS
    // ================================================================

    function testFuzz_borrowerGetsSurplusWhenExcess(
        uint256 principal,
        uint256 interest,
        uint256 surplus
    ) public view {
        principal = bound(principal, MIN_AMOUNT, MAX_AMOUNT);
        interest = bound(interest, 0, (principal * 800) / BPS_DENOMINATOR);
        surplus = bound(surplus, 1, MAX_AMOUNT);

        uint256 platformFee = harness.calculatePlatformFee(interest);
        uint256 debtAmount = principal + interest - platformFee;
        uint256 totalProceeds = debtAmount + platformFee + surplus;

        (uint256 treasury, uint256 lenderPayout, uint256 borrowerPayout) =
            harness.calculateDistribution(debtAmount, platformFee, totalProceeds);

        assertEq(treasury, platformFee, "Treasury should get exact platform fee");
        assertEq(lenderPayout, debtAmount, "Lender should get exact debt amount");
        assertEq(borrowerPayout, surplus, "Borrower should get all surplus");
    }

    // ================================================================
    //      PLATFORM FEE IS PAID FIRST (PRIORITY ORDER)
    // ================================================================

    function testFuzz_platformFeePaidFirst(
        uint256 platformFee,
        uint256 debtAmount,
        uint256 totalProceeds
    ) public view {
        platformFee = bound(platformFee, 1, MAX_AMOUNT / 10);
        debtAmount = bound(debtAmount, MIN_AMOUNT, MAX_AMOUNT);
        totalProceeds = bound(totalProceeds, 1, debtAmount + platformFee + MAX_AMOUNT);

        (uint256 treasury,,) =
            harness.calculateDistribution(debtAmount, platformFee, totalProceeds);

        if (totalProceeds >= platformFee) {
            assertEq(treasury, platformFee, "Treasury should get full fee when proceeds sufficient");
        } else {
            assertEq(treasury, totalProceeds, "Treasury should get all proceeds when insufficient");
        }
    }

    // ================================================================
    //       ZERO INTEREST MEANS ZERO PLATFORM FEE
    // ================================================================

    function test_zeroInterestMeansZeroFee() public view {
        uint256 fee = harness.calculatePlatformFee(0);
        assertEq(fee, 0, "Zero interest should produce zero fee");
    }

    // ================================================================
    //       EDGE CASE: PROCEEDS EXACTLY EQUAL TOTAL DEBT
    // ================================================================

    function testFuzz_proceedsExactlyEqualDebt(uint256 principal, uint256 interest) public view {
        principal = bound(principal, MIN_AMOUNT, MAX_AMOUNT);
        interest = bound(interest, 0, (principal * 800) / BPS_DENOMINATOR);

        uint256 platformFee = harness.calculatePlatformFee(interest);
        uint256 debtAmount = principal + interest - platformFee;
        uint256 totalProceeds = debtAmount + platformFee;

        (uint256 treasury, uint256 lenderPayout, uint256 borrowerPayout) =
            harness.calculateDistribution(debtAmount, platformFee, totalProceeds);

        assertEq(treasury, platformFee, "Treasury should get exact fee");
        assertEq(lenderPayout, debtAmount, "Lender should get exact debt");
        assertEq(borrowerPayout, 0, "Borrower should get nothing when exact");
    }

    // ================================================================
    //   NO PROCEEDS CREATED OUT OF THIN AIR
    // ================================================================

    function testFuzz_noValueCreated(
        uint256 debtAmount,
        uint256 platformFee,
        uint256 totalProceeds
    ) public view {
        debtAmount = bound(debtAmount, MIN_AMOUNT, MAX_AMOUNT);
        platformFee = bound(platformFee, 0, MAX_AMOUNT / 10);
        totalProceeds = bound(totalProceeds, 1, MAX_AMOUNT * 2);

        (uint256 treasury, uint256 lender, uint256 borrower) =
            harness.calculateDistribution(debtAmount, platformFee, totalProceeds);

        // No single payout can exceed total proceeds
        assertLe(treasury, totalProceeds, "Treasury payout exceeds total proceeds");
        assertLe(lender, totalProceeds, "Lender payout exceeds total proceeds");
        assertLe(borrower, totalProceeds, "Borrower payout exceeds total proceeds");

        // Sum is exact
        assertEq(treasury + lender + borrower, totalProceeds, "Value created from nothing");
    }
}
