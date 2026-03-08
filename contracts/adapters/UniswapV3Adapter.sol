// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/ISwapRouter.sol";

/// @notice Uniswap V3 SwapRouter02 interface (only what we need)
interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

/// @title UniswapV3Adapter - Wraps Uniswap V3 SwapRouter02 to ISwapRouter interface
/// @notice Uses typed interface call instead of raw encoding (M-NEW-01 fix)
contract UniswapV3Adapter is ISwapRouter {
    using SafeERC20 for IERC20;

    ISwapRouter02 public immutable uniRouter;

    /// @notice Default pool fee tier (0.3%)
    uint24 public constant DEFAULT_FEE = 3000;

    /// @notice Custom fee tiers per token (tokenIn => fee)
    mapping(address => uint24) public customFees;

    /// @notice Owner with transfer support (M-NEW-03 fix)
    address public owner;
    address public pendingOwner;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _uniRouter) {
        require(_uniRouter != address(0), "Invalid router");
        uniRouter = ISwapRouter02(_uniRouter);
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

    function setCustomFee(address token, uint24 fee) external onlyOwner {
        customFees[token] = fee;
    }

    /// @notice Execute swap via Uniswap V3 using typed interface
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external override returns (uint256 amountOut) {
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).forceApprove(address(uniRouter), amountIn);

        uint24 fee = customFees[tokenIn];
        if (fee == 0) fee = DEFAULT_FEE;

        amountOut = uniRouter.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: recipient,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        );

        // Reset approval after swap (L-NEW-03)
        IERC20(tokenIn).forceApprove(address(uniRouter), 0);
    }

    /// @notice Rescue tokens accidentally stuck in this contract (L-3-06)
    function rescueTokens(address token, uint256 amount, address to) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(to, amount);
    }
}
