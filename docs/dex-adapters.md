# NomoLend DEX Adapters

Modular DEX integration layer for liquidation swaps. All adapters implement the standardized `ISwapRouter` interface, enabling the `LiquidationEngine` to swap collateral tokens to USDC through multiple DEX backends with automatic fallback.

---

## Architecture

```
                    LiquidationEngine
                          |
                 +--------+--------+
                 |                  |
           primaryRouter      fallbackRouter
                 |                  |
        +--------+--------+        |
        |        |        |        |
   Uniswap  Aerodrome  Aero CL  Aero Multihop
   V3 Adapter  Adapter  Adapter    Adapter
        |        |        |        |
        v        v        v        v
   Uniswap V3  Aerodrome  Aerodrome  Aerodrome
   SwapRouter  Router     CL Router  Router
   (Base)      (Base)     (Base)     (via WETH)
```

### Liquidation Swap Flow

```
1. LiquidationEngine receives collateral token + amount
2. Approves primaryRouter for exact amount
3. Calls primaryRouter.swap(tokenIn, USDC, amount, minAmountOut, self)
   |
   +-- SUCCESS: Reset approval, emit event, return proceeds
   |
   +-- FAILURE:
         a. Reset primaryRouter approval to 0
         b. Approve fallbackRouter for exact amount
         c. Call fallbackRouter.swap(...)
         d. Reset fallbackRouter approval to 0
         e. Emit event, return proceeds
```

---

## ISwapRouter Interface

All adapters implement this standardized interface (`contracts/interfaces/ISwapRouter.sol`):

```solidity
interface ISwapRouter {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}
```

| Parameter | Description |
|-----------|-------------|
| `tokenIn` | Collateral token being liquidated |
| `tokenOut` | Target token (always USDC in NomoLend) |
| `amountIn` | Exact amount of collateral to swap |
| `minAmountOut` | Minimum acceptable USDC output (slippage protection) |
| `recipient` | Address to receive output tokens |

---

## Adapter Reference

### UniswapV3Adapter

Wraps the Uniswap V3 SwapRouter02 `exactInputSingle` function.

| Property | Value |
|----------|-------|
| Contract | `UniswapV3Adapter.sol` |
| Underlying DEX | Uniswap V3 SwapRouter02 |
| Router address | `0x43215Df48f040CD5A76ed2a19b9e27E62308b1DC` |
| Default fee tier | 0.3% (3,000) |
| Custom fees | Per-token via `setCustomFee(token, fee)` |
| Swap method | `exactInputSingle` (single-hop) |
| Deadline | None (SwapRouter02 does not require deadline) |

**Fee tiers available:** 100 (0.01%), 500 (0.05%), 3000 (0.3%), 10000 (1%)

---

### AerodromeAdapter

Wraps the Aerodrome Router `swapExactTokensForTokens` for standard AMM pools.

| Property | Value |
|----------|-------|
| Contract | `AerodromeAdapter.sol` |
| Underlying DEX | Aerodrome Router |
| Router address | `0x06578CB045e2c588f9b204416d5dbf5e689A2639` |
| Pool factory | Immutable, set at deployment |
| Pool type | Volatile or Stable (configurable per token) |
| Swap method | `swapExactTokensForTokens` (single-hop) |
| Deadline | `block.timestamp + 300` (5 minutes) |

**Pool configuration:** Use `setStablePool(token, true)` for stablecoin pairs (e.g., USDbC/USDC). Defaults to volatile pools.

---

### AerodromeCLAdapter

Wraps the Aerodrome Slipstream (Concentrated Liquidity) SwapRouter for CL pools.

| Property | Value |
|----------|-------|
| Contract | `AerodromeCLAdapter.sol` |
| Underlying DEX | Aerodrome Slipstream CL Router |
| Router address | `0x51e7a5E748fFd0889F14f5fAd605441900d0DA27` |
| Default tick spacing | 100 (CL100) |
| Custom tick spacing | Per-token via `setCustomTickSpacing(token, spacing)` |
| Swap method | `exactInputSingle` (single-hop) |
| Deadline | `block.timestamp + 300` (5 minutes) |

**Tick spacing options:** CL1 (1), CL50 (50), CL100 (100), CL200 (200). Higher spacing = wider price range per tick = lower gas but less capital efficiency.

---

### AerodromeMultihopAdapter

Wraps the Aerodrome Router with multi-hop routing support (TOKEN -> WETH -> USDC) for tokens without direct USDC liquidity pools.

| Property | Value |
|----------|-------|
| Contract | `AerodromeMultihopAdapter.sol` |
| Underlying DEX | Aerodrome Router |
| Router address | Same as AerodromeAdapter |
| WETH address | Immutable, set at deployment |
| Hop count | 1-hop (direct) or 2-hop (via WETH) |
| Swap method | `swapExactTokensForTokens` (1 or 2 routes) |
| Deadline | `block.timestamp + 300` (5 minutes) |

**Route configuration per token:**

| Setting | Method | Description |
|---------|--------|-------------|
| Single-hop | `setStablePool(token, stable)` | Direct TOKEN -> USDC swap |
| Multi-hop enable | `setMultihopRoute(token, true, firstStable, secondStable)` | TOKEN -> WETH -> USDC |
| First leg pool | `firstLegStable` parameter | Volatile or stable for TOKEN -> WETH |
| Second leg pool | `secondLegStable` parameter | Volatile or stable for WETH -> USDC |

**Multi-hop routing diagram:**

```
Single-hop (default):
  TOKEN ----[volatile/stable]----> USDC

Multi-hop (configured):
  TOKEN ----[leg 1]----> WETH ----[leg 2]----> USDC
            volatile/     volatile/
            stable        stable
```

---

## Deployed Router Addresses (Base)

| Adapter | On-chain Address | Underlying Router |
|---------|-----------------|-------------------|
| UniswapV3Adapter | Deployed on Base | `0x43215Df48f040CD5A76ed2a19b9e27E62308b1DC` (Uniswap V3 SwapRouter02) |
| AerodromeAdapter | Deployed on Base | `0x06578CB045e2c588f9b204416d5dbf5e689A2639` (Aerodrome Router) |
| AerodromeCLAdapter | Deployed on Base | `0x51e7a5E748fFd0889F14f5fAd605441900d0DA27` (Aerodrome CL Router) |
| AerodromeMultihopAdapter | Deployed on Base | Same Aerodrome Router as AerodromeAdapter |

---

## Slippage Protection

Slippage is enforced at two levels:

### 1. Bot Level (Off-chain)

The liquidation bot calculates `minAmountOut` using the on-chain oracle price:

```
collateralValue = PriceOracle.getValueInUsdc(token, amount)
minAmountOut = collateralValue * (10000 - 500) / 10000    // 5% slippage
```

| Parameter | Value |
|-----------|-------|
| Max slippage | 5% (`LIQUIDATION_SLIPPAGE_BPS = 500`) |
| Price source | On-chain PriceOracle (TWAP + Chainlink) |

### 2. Contract Level (On-chain)

Every adapter passes `minAmountOut` directly to the underlying DEX router. The DEX router will revert if the swap output is below this minimum, providing atomic slippage protection.

```
adapter.swap(token, USDC, amount, minAmountOut, recipient)
   |
   +-- Uniswap V3: amountOutMinimum parameter in exactInputSingle
   +-- Aerodrome: amountOutMin parameter in swapExactTokensForTokens
   +-- Aerodrome CL: amountOutMinimum parameter in exactInputSingle
```

---

## Fallback Mechanism

The `LiquidationEngine` implements a primary/fallback router pattern:

```
LiquidationEngine.liquidateCollateral(token, amount, minAmountOut)
   |
   +-- approve(primaryRouter, amount)
   |
   +-- try primaryRouter.swap(token, USDC, amount, minAmountOut, this)
   |     |
   |     +-- SUCCESS: reset approval, emit event, done
   |     |
   |     +-- REVERT:
   |           +-- reset primaryRouter approval to 0
   |           +-- require(fallbackRouter != address(0))
   |           +-- approve(fallbackRouter, amount)
   |           +-- fallbackRouter.swap(token, USDC, amount, minAmountOut, this)
   |           +-- reset fallbackRouter approval to 0
   |           +-- emit event, done
```

Both primary and fallback routers are protected by the 24-hour timelock on `ProtocolConfig`.

---

## Approval Hygiene

All adapters follow the same approval pattern:

1. **Before swap:** `IERC20(tokenIn).forceApprove(router, amountIn)` — approve exact amount
2. **After swap:** `IERC20(tokenIn).forceApprove(router, 0)` — reset approval to zero

This applies to:
- All 4 adapter contracts (internal approvals to underlying DEX routers)
- `LiquidationEngine` (approvals to adapter contracts)

`forceApprove` from OpenZeppelin's SafeERC20 handles tokens that require approval to be zero before setting a new value (e.g., USDT).

---

## Ownership Model

All adapters use a 2-step ownership transfer pattern:

```
currentOwner.transferOwnership(newOwner)    // Step 1: Propose
newOwner.acceptOwnership()                   // Step 2: Accept
```

This prevents accidental ownership transfers to incorrect addresses. The owner can:

- Set custom fee tiers / tick spacings / stable pool preferences
- Configure multi-hop routes
- Rescue stuck tokens via `rescueTokens(token, amount, to)`

---

## Token Rescue

Each adapter includes a `rescueTokens` function allowing the owner to recover tokens accidentally sent to the adapter contract:

```solidity
function rescueTokens(address token, uint256 amount, address to) external onlyOwner
```

This is a safety mechanism for operational errors. Under normal operation, adapters do not hold any token balances between transactions.
