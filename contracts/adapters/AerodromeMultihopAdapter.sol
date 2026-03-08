// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ISwapRouter.sol";

/// @notice Aerodrome Router interface (only what we need)
interface IAerodromeRouterV2 {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/// @title AerodromeMultihopAdapter - Wraps Aerodrome Router with multi-hop support
/// @notice Supports direct (1-hop) and multi-hop (2-hop via WETH) swaps
/// @dev If a token has a custom route configured, uses multi-hop; otherwise single-hop
contract AerodromeMultihopAdapter is ISwapRouter {
    using SafeERC20 for IERC20;

    IAerodromeRouterV2 public immutable aeroRouter;
    address public immutable poolFactory;
    address public immutable weth;

    /// @notice Whether to use stable pool for a given token (single-hop)
    mapping(address => bool) public useStablePool;

    /// @notice Whether a token requires multi-hop via WETH
    mapping(address => bool) public useMultihop;

    /// @notice Whether the first leg (TOKEN->WETH) uses a stable pool
    mapping(address => bool) public multihopFirstLegStable;

    /// @notice Whether the second leg (WETH->USDC) uses a stable pool
    mapping(address => bool) public multihopSecondLegStable;

    /// @notice Owner with 2-step transfer
    address public owner;
    address public pendingOwner;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event MultihopRouteSet(address indexed token, bool enabled, bool firstLegStable, bool secondLegStable);
    event StablePoolSet(address indexed token, bool stable);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _aeroRouter, address _factory, address _weth) {
        require(_aeroRouter != address(0) && _factory != address(0) && _weth != address(0), "Invalid addresses");
        aeroRouter = IAerodromeRouterV2(_aeroRouter);
        poolFactory = _factory;
        weth = _weth;
        owner = msg.sender;
    }

    // --- Owner management (2-step transfer) ---

    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    /// @notice Configure single-hop stable pool preference
    function setStablePool(address token, bool stable) external onlyOwner {
        useStablePool[token] = stable;
        emit StablePoolSet(token, stable);
    }

    /// @notice Configure multi-hop route for a token (TOKEN -> WETH -> tokenOut)
    /// @param token The collateral token
    /// @param enabled Whether to use multi-hop
    /// @param firstLegStable Whether TOKEN->WETH leg uses stable pool
    /// @param secondLegStable Whether WETH->USDC leg uses stable pool
    function setMultihopRoute(
        address token,
        bool enabled,
        bool firstLegStable,
        bool secondLegStable
    ) external onlyOwner {
        useMultihop[token] = enabled;
        multihopFirstLegStable[token] = firstLegStable;
        multihopSecondLegStable[token] = secondLegStable;
        emit MultihopRouteSet(token, enabled, firstLegStable, secondLegStable);
    }

    /// @notice Execute swap via Aerodrome (single-hop or multi-hop)
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external override returns (uint256 amountOut) {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).forceApprove(address(aeroRouter), amountIn);

        IAerodromeRouterV2.Route[] memory routes;

        if (useMultihop[tokenIn]) {
            // Multi-hop: TOKEN -> WETH -> tokenOut
            routes = new IAerodromeRouterV2.Route[](2);
            routes[0] = IAerodromeRouterV2.Route({
                from: tokenIn,
                to: weth,
                stable: multihopFirstLegStable[tokenIn],
                factory: poolFactory
            });
            routes[1] = IAerodromeRouterV2.Route({
                from: weth,
                to: tokenOut,
                stable: multihopSecondLegStable[tokenIn],
                factory: poolFactory
            });
        } else {
            // Single-hop: TOKEN -> tokenOut
            routes = new IAerodromeRouterV2.Route[](1);
            routes[0] = IAerodromeRouterV2.Route({
                from: tokenIn,
                to: tokenOut,
                stable: useStablePool[tokenIn],
                factory: poolFactory
            });
        }

        uint256[] memory amounts = aeroRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            routes,
            recipient,
            block.timestamp + 300
        );

        amountOut = amounts[amounts.length - 1];

        // Reset approval after swap
        IERC20(tokenIn).forceApprove(address(aeroRouter), 0);
    }

    /// @notice Rescue tokens accidentally stuck in this contract
    function rescueTokens(address token, uint256 amount, address to) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(to, amount);
    }
}
