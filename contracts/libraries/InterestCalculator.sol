// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/INomoLend.sol";

/// @title InterestCalculator - Deterministic bracket-based interest calculation
/// @notice Interest is charged based on the time bracket reached, not pro-rata
///
/// Duration brackets:
///   7 days  -> 2% interest
///   14 days -> 4% interest
///   30 days -> 8% interest
///
/// For a 30-day loan repaid after 3 days, borrower pays 2% (first bracket)
/// For a 30-day loan repaid after 10 days, borrower pays 4% (second bracket)
/// For a 30-day loan repaid after 15 days, borrower pays 8% (third bracket)
library InterestCalculator {
    uint256 constant BPS_DENOMINATOR = 10_000;

    uint256 constant INTEREST_7D  = 200;  // 2% in bps
    uint256 constant INTEREST_14D = 400;  // 4% in bps
    uint256 constant INTEREST_30D = 800;  // 8% in bps

    uint256 constant SEVEN_DAYS    = 7 days;
    uint256 constant FOURTEEN_DAYS = 14 days;
    uint256 constant THIRTY_DAYS   = 30 days;

    /// @notice Get the duration in seconds for a Duration enum
    function getDurationSeconds(INomoLend.Duration duration) internal pure returns (uint256) {
        if (duration == INomoLend.Duration.SEVEN_DAYS) return SEVEN_DAYS;
        if (duration == INomoLend.Duration.FOURTEEN_DAYS) return FOURTEEN_DAYS;
        return THIRTY_DAYS;
    }

    /// @notice Get the max interest rate for a duration (the rate if held to maturity)
    function getMaxInterestBps(INomoLend.Duration duration) internal pure returns (uint256) {
        if (duration == INomoLend.Duration.SEVEN_DAYS) return INTEREST_7D;
        if (duration == INomoLend.Duration.FOURTEEN_DAYS) return INTEREST_14D;
        return INTEREST_30D;
    }

    /// @notice Calculate interest based on elapsed time and loan duration
    /// @param principal The loan principal in USDC
    /// @param duration The loan duration bracket
    /// @param elapsed Time elapsed since loan start in seconds
    /// @return interest The interest amount in USDC
    /// @return rateBps The interest rate applied in basis points
    function calculateInterest(
        uint256 principal,
        INomoLend.Duration duration,
        uint256 elapsed
    ) internal pure returns (uint256 interest, uint256 rateBps) {
        rateBps = _getBracketRate(duration, elapsed);
        interest = (principal * rateBps) / BPS_DENOMINATOR;
    }

    /// @notice Determine which interest bracket applies based on elapsed time
    /// @dev For any duration, the bracket thresholds are:
    ///      <= 7 days elapsed  -> 2%
    ///      <= 14 days elapsed -> 4%
    ///      > 14 days elapsed  -> 8% (only for 30-day loans)
    function _getBracketRate(INomoLend.Duration duration, uint256 elapsed) private pure returns (uint256) {
        if (duration == INomoLend.Duration.SEVEN_DAYS) {
            // 7-day loans always charge 2%
            return INTEREST_7D;
        }

        if (duration == INomoLend.Duration.FOURTEEN_DAYS) {
            // 14-day loan: repay within 7 days -> 2%, otherwise 4%
            if (elapsed <= SEVEN_DAYS) return INTEREST_7D;
            return INTEREST_14D;
        }

        // 30-day loan: bracket depends on elapsed time
        if (elapsed <= SEVEN_DAYS) return INTEREST_7D;
        if (elapsed <= FOURTEEN_DAYS) return INTEREST_14D;
        return INTEREST_30D;
    }
}
