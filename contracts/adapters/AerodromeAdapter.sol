// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ISwapRouter.sol";

/// @notice Aerodrome Router interface (only what we need)
interface IAerodromeRouter {
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

/// @title AerodromeAdapter - Wraps Aerodrome Router to ISwapRouter interface
/// @notice Uses typed interface call instead of raw encoding (M-NEW-02 fix)
contract AerodromeAdapter is ISwapRouter {
    using SafeERC20 for IERC20;

    IAerodromeRouter public immutable aeroRouter;
    address public immutable poolFactory;

    /// @notice Whether to use stable pool for a given token
    mapping(address => bool) public useStablePool;

    /// @notice Owner with transfer support (M-NEW-03 fix)
    address public owner;
    address public pendingOwner;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _aeroRouter, address _factory) {
        require(_aeroRouter != address(0) && _factory != address(0), "Invalid addresses");
        aeroRouter = IAerodromeRouter(_aeroRouter);
        poolFactory = _factory;
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

    function setStablePool(address token, bool stable) external onlyOwner {
        useStablePool[token] = stable;
    }

    /// @notice Execute swap via Aerodrome using typed interface
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external override returns (uint256 amountOut) {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).forceApprove(address(aeroRouter), amountIn);

        // Build single-hop route
        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({
            from: tokenIn,
            to: tokenOut,
            stable: useStablePool[tokenIn],
            factory: poolFactory
        });

        uint256[] memory amounts = aeroRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            routes,
            recipient,
            block.timestamp + 300
        );

        amountOut = amounts[amounts.length - 1];

        // Reset approval after swap (L-NEW-03)
        IERC20(tokenIn).forceApprove(address(aeroRouter), 0);
    }

    /// @notice Rescue tokens accidentally stuck in this contract (L-3-06)
    function rescueTokens(address token, uint256 amount, address to) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(to, amount);
    }
}
