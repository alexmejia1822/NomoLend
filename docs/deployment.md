# NomoLend Deployment Documentation

## Overview

NomoLend is deployed on **Base Mainnet** (Chain ID 8453) using Hardhat for smart contract deployment and Vercel for frontend hosting. The protocol consists of 14 deployed contracts, a Next.js frontend, keeper bots managed by PM2, and Vercel Cron Jobs for automated tasks.

---

## Deployed Contract Addresses

### Core Protocol

| Contract | Address | Purpose |
|----------|---------|---------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Lending currency (native Base USDC) |
| ProtocolConfig | `0x0a41e67c838192944F0F7FA93943b48c517af20e` | Treasury, fee config |
| TokenValidator | `0xe0CA16261405CA12F156E2F3A0B309d9587B9e4D` | Token whitelist |
| PriceOracle | `0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08` | Chainlink + TWAP price feeds |
| RiskEngine | `0xc5E0fDDB27bB10Efb341654dAbeA55d3Cc09870F` | LTV, liquidation thresholds, exposure |
| CollateralManager | `0x180dcc27C5923c6FEeD4Fd4f210c6F1fE0A812c5` | Collateral custody |
| LiquidationEngine | `0x6e892AEadda28E630bbe84e469fdA25f1B1B4820` | DEX liquidation execution |
| OrderBook | `0x400Abe15172CE78E51c33aE1b91F673004dB2315` | Lending orders + borrow requests |
| LoanManager | `0x356e137F8F93716e1d92F66F9e2d4866C586d9cf` | Loan lifecycle orchestrator |

### Auxiliary Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| ReserveFund | `0xDD4a6B527598B31dBcC760B58811278ceF9A3A13` | Bad debt reserve (20% of platform fees) |
| RiskGuardian | `0xb9b90eE151D53327c1C42a268Eb974A08f1E07Ef` | Circuit breaker, emergency actions |
| UniswapV3Adapter | `0x43215Df48f040CD5A76ed2a19b9e27E62308b1DC` | Uniswap V3 swap adapter |
| AerodromeAdapter | `0x06578CB045e2c588f9b204416d5dbf5e689A2639` | Aerodrome V2 swap adapter |
| AerodromeCLAdapter | `0x51e7a5E748fFd0889F14f5fAd605441900d0DA27` | Aerodrome CL swap adapter |

### DEX Routers

| Router | Address |
|--------|---------|
| Uniswap V3 | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| Aerodrome | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |

---

## Hardhat Configuration

```
Solidity:       0.8.24
Optimizer:      enabled (200 runs)
Via IR:         true
Test directory: ./tests
```

**Network config (Base):**
- URL: `BASE_RPC_URL` env var or `https://mainnet.base.org`
- Accounts: `DEPLOYER_PRIVATE_KEY` env var
- Chain ID: 8453

---

## Deployment Steps

### Phase 1: Smart Contract Deployment

```
Step 1: Deploy Contracts (Hardhat)
    npx hardhat run scripts/deploy.js --network base

    Deployment order:
    1. ProtocolConfig(USDC_ADDRESS, TREASURY)
    2. TokenValidator()
    3. PriceOracle()
    4. RiskEngine(priceOracle, tokenValidator)
    5. CollateralManager()
    6. LiquidationEngine(USDC_ADDRESS)
    7. OrderBook(USDC_ADDRESS)
    8. LoanManager(config, orderBook, collateralManager,
                   riskEngine, liquidationEngine, priceOracle)

    Role setup (automatic):
    - CollateralManager.grantRole(LOAN_MANAGER_ROLE, LoanManager)
    - OrderBook.grantRole(LOAN_MANAGER_ROLE, LoanManager)
    - RiskEngine.grantRole(RISK_MANAGER_ROLE, LoanManager)
    - LiquidationEngine.grantRole(LIQUIDATOR_ROLE, LoanManager)
```

### Phase 2: Protocol Configuration

```
Step 2: Configure ProtocolConfig
    - Set treasury address
    - Set fee parameters (10% platform fee)

Step 3: Configure PriceOracle
    - Set Chainlink feeds for Tier A/B tokens:
      WETH  -> 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70
      cbETH -> 0xd7818272B9e248357d13057AAb0B417aF31E817d
      DAI   -> 0x591e79239a7d679378eC8c847e5038150364C78F
      USDbC -> 0x7e860098F58bBFC8648a4311b374B1D669a2bc6B
      LINK  -> 0x17CAb8FE31E32f08326e5E27412894e49B0f9D65
    - Set initial TWAP prices for all tokens without Chainlink feeds

Step 4: Whitelist Tokens in TokenValidator
    - whitelistToken() for each of the 21 collateral tokens

Step 5: Configure Risk Params in RiskEngine
    - setTokenRiskParams(token, ltvBps, liqBps, maxExposure)
    - Per-tier configuration (see collateral-tokens.md)

Step 6: Configure DEX Routers with Timelock
    - LiquidationEngine.setPrimaryRouter(uniswapV3Router)
    - Configure Aerodrome adapters as fallback
```

### Phase 3: Governance Migration

```
Step 7: Migrate Governance to Safe
    Run: SAFE_ADDRESS=0x362D...DB87 BOT_ADDRESS=0x... \
         node scripts/migrate-to-multisig.js --execute

    Phase 1: Audit all current roles across 10 contracts
    Phase 2: Grant bot wallet PRICE_UPDATER_ROLE + LIQUIDATOR_ROLE
    Phase 3: Grant Safe all admin roles, then revoke deployer
    Phase 4: Post-migration verification

Step 8: Revoke Deployer Roles
    - renounceRole() for all admin roles on all contracts
    - Verify deployer has zero protocol powers
    - Deployer wallet becomes a regular EOA
```

### Phase 4: Frontend & Infrastructure

```
Step 9: Deploy Frontend on Vercel
    - Push frontend/ to Git repository
    - Connect to Vercel project
    - Set environment variables:
      NEXT_PUBLIC_WC_PROJECT_ID
      NEXT_PUBLIC_BASE_RPC_URL

Step 10: Configure nomolend.com Domain
    - Add custom domain in Vercel dashboard
    - Configure DNS records

Step 11: Configure Vercel Crons
    vercel.json defines:
    - /api/bot/update-prices   -> every 5 min
    - /api/bot/scan-loans      -> every 2 min
    - /api/bot/monitor         -> every 5 min

Step 12: Start PM2 Bots
    pm2 start bots/ecosystem.config.cjs
    - Price Updater (5 min intervals)
    - Health Monitor (1 min intervals)
    - Liquidation Bot (2 min intervals)
    - Monitor Bot (2 min intervals)

Step 13: Configure Firebase
    - Set FIREBASE_SERVICE_ACCOUNT_KEY for event logging

Step 14: Configure Telegram Alerts
    - Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
    - Alerts for: liquidations, stale prices, health warnings
```

---

## Migration Script Details

The `migrate-to-multisig.js` script handles 10 contracts with the following role matrix:

| Contract | Admin Roles | Bot Roles |
|----------|------------|-----------|
| ProtocolConfig | DEFAULT_ADMIN, ADMIN, RISK_MANAGER | — |
| TokenValidator | DEFAULT_ADMIN, RISK_MANAGER | — |
| PriceOracle | DEFAULT_ADMIN, ADMIN | PRICE_UPDATER |
| RiskEngine | DEFAULT_ADMIN, RISK_MANAGER | — |
| CollateralManager | DEFAULT_ADMIN | — |
| LiquidationEngine | DEFAULT_ADMIN, ADMIN | — |
| OrderBook | DEFAULT_ADMIN | — |
| LoanManager | DEFAULT_ADMIN, ADMIN | LIQUIDATOR |
| ReserveFund | DEFAULT_ADMIN, GOVERNANCE | — |
| RiskGuardian | DEFAULT_ADMIN, RISK_GUARDIAN | — |

**Safety features:**
- Dry run mode by default (read-only audit)
- 10-second countdown before execution
- Verifies Safe holds role before revoking deployer
- Post-migration verification pass
- Full summary report

---

## Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `DEPLOYER_PRIVATE_KEY` | Hardhat | Deployer wallet key (revoked post-migration) |
| `BASE_RPC_URL` | Hardhat, Bots | Base RPC endpoint |
| `BOT_PRIVATE_KEY` | Bots | Bot wallet private key |
| `DRY_RUN` | Bots | Simulation mode flag |
| `SAFE_ADDRESS` | Migration | Gnosis Safe address |
| `BOT_ADDRESS` | Migration | Bot wallet address |
| `NEXT_PUBLIC_WC_PROJECT_ID` | Frontend | WalletConnect project ID |
| `NEXT_PUBLIC_BASE_RPC_URL` | Frontend | Custom RPC for frontend |
| `TELEGRAM_BOT_TOKEN` | Bots | Telegram alert bot token |
| `TELEGRAM_CHAT_ID` | Bots | Telegram alert chat ID |
| `DISCORD_WEBHOOK_URL` | Bots | Discord webhook for alerts |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | API Routes | Firebase service account path |
