// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ProtocolConfig - Central configuration and access control for NomoLend
/// @notice Manages protocol parameters and role-based access
contract ProtocolConfig is AccessControl {
    // ============================================================
    //                          ROLES
    // ============================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");
    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");

    // ============================================================
    //                       CONSTANTS
    // ============================================================

    /// @notice Platform fee: 10% of interest earned (1000 bps)
    uint256 public constant PLATFORM_FEE_BPS = 1000;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Liquidation penalty for expired loans: 2%
    uint256 public constant EXPIRY_PENALTY_BPS = 200;

    /// @notice Max slippage for liquidation swaps: 5%
    uint256 public constant MAX_LIQUIDATION_SLIPPAGE_BPS = 500;

    // ============================================================
    //                     STATE VARIABLES
    // ============================================================

    /// @notice USDC token address on Base
    address public immutable usdc;

    /// @notice Treasury address that collects platform fees
    address public treasury;

    /// @notice Primary DEX router (e.g., Uniswap V3)
    address public primaryRouter;

    /// @notice Fallback DEX router (e.g., Aerodrome)
    address public fallbackRouter;

    /// @notice Protocol contracts registry
    mapping(bytes32 => address) public contracts;

    /// @notice Timelock for router changes (24 hours)
    uint256 public constant ROUTER_TIMELOCK = 24 hours;

    struct PendingRouter {
        address newRouter;
        uint256 readyAt;
    }

    PendingRouter public pendingPrimaryRouter;
    PendingRouter public pendingFallbackRouter;

    // ============================================================
    //                         EVENTS
    // ============================================================

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event RouterUpdated(string routerType, address indexed router);
    event RouterChangeProposed(string routerType, address indexed router, uint256 readyAt);
    event RouterChangeCancelled(string routerType, address indexed previousProposal);
    event ContractRegistered(bytes32 indexed key, address indexed contractAddr);

    // ============================================================
    //                       CONSTRUCTOR
    // ============================================================

    constructor(address _usdc, address _treasury) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_treasury != address(0), "Invalid treasury address");

        usdc = _usdc;
        treasury = _treasury;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(RISK_MANAGER_ROLE, msg.sender);
    }

    // ============================================================
    //                     ADMIN FUNCTIONS
    // ============================================================

    function setTreasury(address _treasury) external onlyRole(ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid treasury");
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    /// @notice Direct set only when router is uninitialized (address(0))
    function initializeRouters(address _primary, address _fallback) external onlyRole(ADMIN_ROLE) {
        require(primaryRouter == address(0) && fallbackRouter == address(0), "Already initialized");
        require(_primary != address(0) && _fallback != address(0), "Invalid routers");
        primaryRouter = _primary;
        fallbackRouter = _fallback;
        emit RouterUpdated("primary", _primary);
        emit RouterUpdated("fallback", _fallback);
    }

    function proposePrimaryRouter(address _router) external onlyRole(ADMIN_ROLE) {
        require(_router != address(0), "Invalid router");
        // L-5-05: emit cancellation event when overwriting a pending proposal
        if (pendingPrimaryRouter.newRouter != address(0)) {
            emit RouterChangeCancelled("primary", pendingPrimaryRouter.newRouter);
        }
        uint256 readyAt = block.timestamp + ROUTER_TIMELOCK;
        pendingPrimaryRouter = PendingRouter(_router, readyAt);
        emit RouterChangeProposed("primary", _router, readyAt);
    }

    function executePrimaryRouter() external onlyRole(ADMIN_ROLE) {
        require(pendingPrimaryRouter.newRouter != address(0), "No pending change");
        require(block.timestamp >= pendingPrimaryRouter.readyAt, "Timelock not expired");
        primaryRouter = pendingPrimaryRouter.newRouter;
        emit RouterUpdated("primary", pendingPrimaryRouter.newRouter);
        delete pendingPrimaryRouter;
    }

    function proposeFallbackRouter(address _router) external onlyRole(ADMIN_ROLE) {
        require(_router != address(0), "Invalid router");
        // L-5-05: emit cancellation event when overwriting a pending proposal
        if (pendingFallbackRouter.newRouter != address(0)) {
            emit RouterChangeCancelled("fallback", pendingFallbackRouter.newRouter);
        }
        uint256 readyAt = block.timestamp + ROUTER_TIMELOCK;
        pendingFallbackRouter = PendingRouter(_router, readyAt);
        emit RouterChangeProposed("fallback", _router, readyAt);
    }

    function executeFallbackRouter() external onlyRole(ADMIN_ROLE) {
        require(pendingFallbackRouter.newRouter != address(0), "No pending change");
        require(block.timestamp >= pendingFallbackRouter.readyAt, "Timelock not expired");
        fallbackRouter = pendingFallbackRouter.newRouter;
        emit RouterUpdated("fallback", pendingFallbackRouter.newRouter);
        delete pendingFallbackRouter;
    }

    function cancelPendingRouter(string calldata routerType) external onlyRole(ADMIN_ROLE) {
        if (keccak256(bytes(routerType)) == keccak256("primary")) {
            if (pendingPrimaryRouter.newRouter != address(0)) {
                emit RouterChangeCancelled("primary", pendingPrimaryRouter.newRouter);
            }
            delete pendingPrimaryRouter;
        } else {
            if (pendingFallbackRouter.newRouter != address(0)) {
                emit RouterChangeCancelled("fallback", pendingFallbackRouter.newRouter);
            }
            delete pendingFallbackRouter;
        }
    }

    function registerContract(bytes32 key, address contractAddr) external onlyRole(ADMIN_ROLE) {
        require(contractAddr != address(0), "Invalid contract");
        contracts[key] = contractAddr;
        emit ContractRegistered(key, contractAddr);
    }

    // ============================================================
    //                      VIEW FUNCTIONS
    // ============================================================

    function getContract(bytes32 key) external view returns (address) {
        address addr = contracts[key];
        require(addr != address(0), "Contract not registered");
        return addr;
    }

    /// @notice Calculate platform fee from interest amount
    function calculatePlatformFee(uint256 interestAmount) external pure returns (uint256) {
        return (interestAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
    }
}
