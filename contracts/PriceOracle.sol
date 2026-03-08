// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IPriceOracle.sol";

/// @title PriceOracle - Hybrid oracle system for NomoLend
/// @notice Uses Chainlink as primary source with DEX TWAP fallback
/// @dev Prices are returned in USDC units (6 decimals)
///
/// Architecture:
///   1. Primary: Chainlink price feeds (when available)
///   2. Fallback: DEX TWAP prices (set by off-chain keeper)
///   3. If sources disagree beyond threshold -> block new loans
contract PriceOracle is IPriceOracle, AccessControl {
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 public constant USDC_DECIMALS = 6;
    uint256 public constant PRICE_PRECISION = 1e6; // 6 decimals for USDC parity

    /// @notice Max allowed deviation between Chainlink and TWAP (5%)
    uint256 public priceDeviationThresholdBps = 500;

    /// @notice Max allowed TWAP price change per update (10%) — prevents keeper manipulation
    uint256 public maxTwapChangeBps = 1000;

    /// @notice Minimum cooldown between TWAP updates (H-5-01: prevents rapid manipulation)
    uint256 public twapUpdateCooldown = 5 minutes;

    /// @notice Max staleness for a price update (default 25 hours, covers 24h heartbeats + buffer)
    uint256 public maxPriceStaleness = 25 hours;

    struct PriceFeed {
        address chainlinkFeed;    // Chainlink aggregator address (0x0 if none)
        uint8 chainlinkDecimals;  // Decimals of the Chainlink feed
        uint256 twapPrice;        // TWAP price in USDC (6 decimals) per 1 whole token
        uint256 lastTwapUpdate;   // Timestamp of last TWAP update
        uint8 tokenDecimals;      // Decimals of the token
        bool isActive;            // Whether price feed is active
    }

    /// @notice token address => price feed configuration
    mapping(address => PriceFeed) public priceFeeds;

    // ============================================================
    //                         EVENTS
    // ============================================================

    event PriceFeedSet(address indexed token, address chainlinkFeed, uint8 tokenDecimals);
    event TwapPriceUpdated(address indexed token, uint256 price, uint256 timestamp);
    event PriceFeedDeactivated(address indexed token);
    event DeviationThresholdUpdated(uint256 newThreshold);
    event MaxPriceStalenessUpdated(uint256 newStaleness);
    event TwapPriceRejected(address indexed token, uint256 newPrice, uint256 lastPrice);
    event MaxTwapChangeBpsUpdated(uint256 newMaxChangeBps);
    event TwapCooldownUpdated(uint256 newCooldown);

    // ============================================================
    //                       CONSTRUCTOR
    // ============================================================

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PRICE_UPDATER_ROLE, msg.sender);
    }

    // ============================================================
    //                     ADMIN FUNCTIONS
    // ============================================================

    /// @notice Configure a price feed for a token
    function setPriceFeed(
        address token,
        address chainlinkFeed,
        uint8 tokenDecimals
    ) external onlyRole(ADMIN_ROLE) {
        require(token != address(0), "Invalid token");

        uint8 clDecimals = 0;
        if (chainlinkFeed != address(0)) {
            // Read decimals from Chainlink feed
            (bool success, bytes memory data) = chainlinkFeed.staticcall(
                abi.encodeWithSignature("decimals()")
            );
            require(success, "Cannot read Chainlink decimals");
            clDecimals = abi.decode(data, (uint8));
        }

        // L-3-04: preserve existing TWAP data when reconfiguring a feed
        PriceFeed storage existing = priceFeeds[token];
        uint256 prevTwap = existing.twapPrice;
        uint256 prevTwapUpdate = existing.lastTwapUpdate;

        priceFeeds[token] = PriceFeed({
            chainlinkFeed: chainlinkFeed,
            chainlinkDecimals: clDecimals,
            twapPrice: prevTwap,
            lastTwapUpdate: prevTwapUpdate,
            tokenDecimals: tokenDecimals,
            isActive: true
        });

        emit PriceFeedSet(token, chainlinkFeed, tokenDecimals);
    }

    /// @notice Update TWAP price (called by off-chain keeper)
    function updateTwapPrice(address token, uint256 price) external onlyRole(PRICE_UPDATER_ROLE) {
        _updateTwap(token, price);
    }

    /// @notice Batch update TWAP prices
    function batchUpdateTwapPrices(
        address[] calldata tokens,
        uint256[] calldata prices
    ) external onlyRole(PRICE_UPDATER_ROLE) {
        require(tokens.length == prices.length, "Length mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            _updateTwap(tokens[i], prices[i]);
        }
    }

    /// @notice Internal TWAP update with manipulation protection
    function _updateTwap(address token, uint256 price) internal {
        PriceFeed storage feed = priceFeeds[token];
        require(feed.isActive, "Feed not active");
        require(price > 0, "Price cannot be zero");

        // H-5-01: enforce cooldown between TWAP updates
        require(
            block.timestamp >= feed.lastTwapUpdate + twapUpdateCooldown,
            "TWAP update too frequent"
        );

        // Check max change if there's a previous TWAP price
        uint256 lastPrice = feed.twapPrice;
        if (lastPrice > 0) {
            uint256 diff = price > lastPrice ? price - lastPrice : lastPrice - price;
            uint256 maxChange = (lastPrice * maxTwapChangeBps) / 10_000;
            if (diff > maxChange) {
                emit TwapPriceRejected(token, price, lastPrice);
                return; // Skip silently — don't revert to allow batch to continue
            }
        }

        feed.twapPrice = price;
        feed.lastTwapUpdate = block.timestamp;
        emit TwapPriceUpdated(token, price, block.timestamp);
    }

    function setMaxTwapChangeBps(uint256 bps) external onlyRole(ADMIN_ROLE) {
        require(bps >= 100 && bps <= 5000, "Range 1%-50%");
        maxTwapChangeBps = bps;
        emit MaxTwapChangeBpsUpdated(bps);
    }

    /// @notice Update TWAP cooldown period (H-5-01)
    function setTwapUpdateCooldown(uint256 seconds_) external onlyRole(ADMIN_ROLE) {
        require(seconds_ >= 1 minutes && seconds_ <= 1 hours, "Cooldown 1min-1h");
        twapUpdateCooldown = seconds_;
        emit TwapCooldownUpdated(seconds_);
    }

    function deactivateFeed(address token) external onlyRole(ADMIN_ROLE) {
        priceFeeds[token].isActive = false;
        emit PriceFeedDeactivated(token);
    }

    function setDeviationThreshold(uint256 bps) external onlyRole(ADMIN_ROLE) {
        require(bps > 0 && bps <= 2000, "Invalid threshold");
        priceDeviationThresholdBps = bps;
        emit DeviationThresholdUpdated(bps);
    }

    /// @notice Update max price staleness (C-02 fix)
    function setMaxPriceStaleness(uint256 seconds_) external onlyRole(ADMIN_ROLE) {
        require(seconds_ >= 1 hours && seconds_ <= 48 hours, "Staleness 1h-48h");
        maxPriceStaleness = seconds_;
        emit MaxPriceStalenessUpdated(seconds_);
    }

    // ============================================================
    //                      PRICE QUERIES
    // ============================================================

    /// @notice Get token price in USDC (6 decimals) for 1 whole token
    /// @return price Price per whole token in USDC
    /// @return confidence Whether the price sources agree within threshold
    function getPrice(address token) public view override returns (uint256 price, bool confidence) {
        PriceFeed storage feed = priceFeeds[token];

        // M-5-02: graceful degradation when feed is deactivated
        if (!feed.isActive) {
            // Return last known TWAP price with confidence=false
            require(feed.twapPrice > 0, "No price available");
            return (feed.twapPrice, false);
        }

        uint256 chainlinkPrice = _getChainlinkPrice(feed);
        uint256 twapPrice = _getTwapPrice(feed);

        // If we have both sources, check deviation
        if (chainlinkPrice > 0 && twapPrice > 0) {
            confidence = _checkDeviation(chainlinkPrice, twapPrice);
            // Use Chainlink as primary
            price = chainlinkPrice;
        } else if (chainlinkPrice > 0) {
            price = chainlinkPrice;
            confidence = true;
        } else if (twapPrice > 0) {
            price = twapPrice;
            confidence = true;
        } else {
            revert("No price available");
        }
    }

    /// @notice Get the USDC value of a token amount
    /// @dev M-5-06: reverts when price confidence is low (sources disagree beyond threshold)
    function getValueInUsdc(address token, uint256 amount) external view override returns (uint256) {
        (uint256 price, bool confidence) = getPrice(token);
        require(confidence, "Price not confident");

        PriceFeed storage feed = priceFeeds[token];
        // price is per 1 whole token (in USDC 6 decimals)
        // amount is in token decimals
        // value = amount * price / 10^tokenDecimals
        return (amount * price) / (10 ** feed.tokenDecimals);
    }

    // ============================================================
    //                    INTERNAL FUNCTIONS
    // ============================================================

    function _getChainlinkPrice(PriceFeed storage feed) internal view returns (uint256) {
        if (feed.chainlinkFeed == address(0)) return 0;

        // Call latestRoundData() on Chainlink aggregator
        (bool success, bytes memory data) = feed.chainlinkFeed.staticcall(
            abi.encodeWithSignature("latestRoundData()")
        );
        if (!success) return 0;

        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = abi.decode(data, (uint80, int256, uint256, uint256, uint80));

        // M-3-02: verify round completeness
        if (answeredInRound < roundId) return 0;
        // Check staleness
        if (block.timestamp - updatedAt > maxPriceStaleness) return 0;
        if (answer <= 0) return 0;

        // Convert to 6 decimals (USDC precision)
        // Chainlink feeds are typically 8 decimals for USD pairs
        if (feed.chainlinkDecimals >= USDC_DECIMALS) {
            return uint256(answer) / (10 ** (feed.chainlinkDecimals - USDC_DECIMALS));
        } else {
            return uint256(answer) * (10 ** (USDC_DECIMALS - feed.chainlinkDecimals));
        }
    }

    function _getTwapPrice(PriceFeed storage feed) internal view returns (uint256) {
        if (feed.twapPrice == 0) return 0;

        // Check staleness
        if (block.timestamp - feed.lastTwapUpdate > maxPriceStaleness) return 0;

        return feed.twapPrice;
    }

    /// @notice Check if two prices are within the acceptable deviation threshold
    function _checkDeviation(uint256 price1, uint256 price2) internal view returns (bool) {
        uint256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
        uint256 avg = (price1 + price2) / 2;
        // deviation = diff * 10000 / avg
        uint256 deviationBps = (diff * 10_000) / avg;
        return deviationBps <= priceDeviationThresholdBps;
    }
}
