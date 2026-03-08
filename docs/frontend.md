# NomoLend Frontend Documentation

## Overview

The NomoLend frontend is a single-page application that provides a complete interface for interacting with the NomoLend P2P lending protocol on Base. It supports wallet connection, order creation, loan management, risk monitoring, and protocol administration.

**Live URL:** https://nomolend.com
**Hosting:** Vercel
**Network:** Base Mainnet (Chain ID 8453)

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 14.2.35 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | ^3.4.1 |
| Wallet | wagmi | ^2.19.5 |
| Wallet UI | RainbowKit | ^2.2.10 |
| State/Cache | TanStack React Query | ^5.90.21 |
| Blockchain | viem | ^2.47.0 |
| Charts | Recharts | ^3.8.0 |
| Animations | Framer Motion | ^12.35.0 |
| Icons | Lucide React | ^0.577.0 |
| Backend | Firebase Admin | ^13.7.0 |

---

## Architecture

```
+-------------------------------------------------------+
|                   Browser (Client)                     |
|                                                        |
|  +------------------+  +----------------------------+  |
|  |   Providers.tsx   |  |   LanguageProvider (i18n)  |  |
|  |  - WagmiProvider  |  |  - en.json / es.json       |  |
|  |  - QueryClient    |  |  - Browser detection       |  |
|  |  - RainbowKit     |  |  - localStorage persist    |  |
|  +--------+---------+  +-------------+--------------+  |
|           |                          |                  |
|  +--------v--------------------------v--------------+  |
|  |                  App Layout                       |  |
|  |  RiskWarningBanner + Navbar + Main + Footer       |  |
|  +--------------------------------------------------+  |
|           |                                             |
|  +--------v------------------------------------------+  |
|  |              Page Components (13 routes)          |  |
|  |  Dashboard | Lend | Borrow | My Loans | Risk ...  |  |
|  +--------+------------------------------------------+  |
|           |                                             |
|  +--------v------------------------------------------+  |
|  |           Custom Hooks Layer                       |  |
|  |  useLoanManager.ts    useOrderBook.ts              |  |
|  |  (read/write)         (read/write)                 |  |
|  +--------+------------------------------------------+  |
|           |                                             |
|  +--------v------------------------------------------+  |
|  |      lib/contracts.ts + lib/abis.ts                |  |
|  |  Contract addresses, ABIs, token definitions       |  |
|  +--------+------------------------------------------+  |
|           |                                             |
+-----------|---------------------------------------------+
            |
    +-------v--------+
    |  Base Mainnet   |
    |  (RPC via env)  |
    +----------------+
```

---

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Protocol stats, collateral distribution chart, interest rate chart, activity feed, token exposure table, security status, deployed contract addresses |
| `/lend` | Lend | Create lending orders with USDC, view active offers, select duration (7/14/30 days) |
| `/borrow` | Borrow | Create borrow requests with collateral, take loans from existing lending orders |
| `/my-loans` | My Loans | Manage active loans as borrower or lender, repay outstanding debt |
| `/risk` | Risk | Risk parameters per token, LTV ratios, liquidation thresholds, exposure limits |
| `/analytics` | Analytics | Protocol metrics, charts, historical data, exposure analysis |
| `/protocol` | Protocol Info | Educational page explaining how NomoLend works |
| `/admin` | Admin | Protocol configuration panel (governance only), token onboarding wizard, fee stats |
| `/admin/bots` | Bot Control | Toggle keeper bots ON/OFF, TWAP price table, risky loans, security verification |
| `/privacy` | Privacy Policy | Privacy policy document |
| `/terms` | Terms | Terms of service document |
| `/risk-disclosure` | Risk Disclosure | Risk disclaimer for users |

**Total routes: 13** (including 2 admin-only routes)

---

## Provider Stack

The app wraps all pages in a layered provider architecture:

```
<WagmiProvider>              -- Blockchain connection (Base chain)
  <QueryClientProvider>      -- Data caching & refetching
    <RainbowKitProvider>     -- Wallet connection UI (dark theme)
      <LanguageProvider>     -- i18n (English / Spanish)
        <RiskWarningBanner>  -- Dismissable risk banner
        <Navbar />           -- Navigation + ConnectButton
        <main>{children}</main>
        <Footer />
      </LanguageProvider>
    </RainbowKitProvider>
  </QueryClientProvider>
</WagmiProvider>
```

The `Providers` component uses a `mounted` state guard to prevent hydration mismatches with wallet state.

---

## Custom Hooks

### useLoanManager.ts

Handles all loan lifecycle operations via the `LoanManager` contract.

| Hook | Type | Description |
|------|------|-------------|
| `useLoan(loanId)` | Read | Fetch full loan struct by ID |
| `useCurrentDebt(loanId)` | Read | Get current debt (principal + interest) |
| `useLoanHealthFactor(loanId)` | Read | Get health factor for a loan |
| `useIsLoanLiquidatable(loanId)` | Read | Check if loan is expired or undercollateralized |
| `useBorrowerLoans(address)` | Read | Get all loan IDs for a borrower |
| `useLenderLoans(address)` | Read | Get all loan IDs for a lender |
| `useTakeLoan()` | Write | Take a loan from a lending order |
| `useFillBorrowRequest()` | Write | Fill a borrow request as a lender |
| `useRepayLoan()` | Write | Repay an active loan |

### useOrderBook.ts

Handles order book operations via the `OrderBook` contract.

| Hook | Type | Description |
|------|------|-------------|
| `useLendingOrderCount()` | Read | Get next lending order ID (total count) |
| `useBorrowRequestCount()` | Read | Get next borrow request ID (total count) |
| `useLendingOrder(orderId)` | Read | Fetch a lending order by ID |
| `useBorrowRequest(requestId)` | Read | Fetch a borrow request by ID |
| `useUserLendingOrders(address)` | Read | Get all lending order IDs for a user |
| `useUserBorrowRequests(address)` | Read | Get all borrow request IDs for a user |
| `useApproveUsdc()` | Write | Approve USDC spending |
| `useCreateLendingOrder()` | Write | Create a new lending order |
| `useCancelLendingOrder()` | Write | Cancel an active lending order |
| `useCreateBorrowRequest()` | Write | Create a new borrow request |
| `useCancelBorrowRequest()` | Write | Cancel an active borrow request |

All write hooks return `{ action, isPending, isConfirming, isSuccess, hash }` for tracking transaction state.

---

## Internationalization (i18n)

The frontend supports two languages via a custom context-based system:

| Feature | Implementation |
|---------|---------------|
| Languages | English (`en.json`), Spanish (`es.json`) |
| Detection | Browser `navigator.language`, falls back to English |
| Persistence | `localStorage` key: `nomolend-locale` |
| Hook | `useTranslation()` returns `{ locale, setLocale, t }` |
| Nested keys | Dot notation: `t("dashboard.heroDesc")` |
| Switcher | `<LanguageSwitcher />` component in Navbar |

Detection priority:
1. `localStorage` (user preference)
2. Browser language (auto-detect Spanish)
3. Default: English

---

## Contract Integration

### Addresses (Base Mainnet)

| Contract | Address |
|----------|---------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| ProtocolConfig | `0x0a41e67c838192944F0F7FA93943b48c517af20e` |
| TokenValidator | `0xe0CA16261405CA12F156E2F3A0B309d9587B9e4D` |
| PriceOracle | `0xc8Fb5BCaC3501E060e6AFb89cd0723BCC98f1e08` |
| RiskEngine | `0xc5E0fDDB27bB10Efb341654dAbeA55d3Cc09870F` |
| CollateralManager | `0x180dcc27C5923c6FEeD4Fd4f210c6F1fE0A812c5` |
| LiquidationEngine | `0x6e892AEadda28E630bbe84e469fdA25f1B1B4820` |
| OrderBook | `0x400Abe15172CE78E51c33aE1b91F673004dB2315` |
| LoanManager | `0x356e137F8F93716e1d92F66F9e2d4866C586d9cf` |
| RiskGuardian | `0xb9b90eE151D53327c1C42a268Eb974A08f1E07Ef` |
| ReserveFund | `0xDD4a6B527598B31dBcC760B58811278ceF9A3A13` |
| UniswapV3Adapter | `0x43215Df48f040CD5A76ed2a19b9e27E62308b1DC` |
| AerodromeAdapter | `0x06578CB045e2c588f9b204416d5dbf5e689A2639` |
| AerodromeCLAdapter | `0x51e7a5E748fFd0889F14f5fAd605441900d0DA27` |

### ABIs

The frontend uses simplified ABIs (not full artifacts) defined in `lib/abis.ts`:

- `OrderBookABI` — Order creation, cancellation, querying
- `LoanManagerABI` — Loan lifecycle (take, fill, repay, health factor)
- `RiskEngineABI` — Risk parameters and exposure queries
- `PriceOracleABI` — Price feeds and USDC value conversion
- `TokenValidatorAdminABI` — Token whitelist management
- `PriceOracleAdminABI` — Price feed and TWAP configuration
- `RiskEngineAdminABI` — Risk parameter management
- `CollateralManagerABI` — Collateral totals
- `ERC20ABI` — Standard ERC-20 (approve, balanceOf, allowance, decimals, symbol)

---

## API Routes

The frontend exposes several API routes for bot monitoring and control:

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/bot?action=status` | Protocol status (total loans, reserve fund) |
| `GET` | `/api/bot?action=loans` | Active loans with health factors |
| `GET` | `/api/bot?action=tokens` | Token prices, staleness, exposure |
| `GET` | `/api/bot/control` | Current bot toggle states |
| `POST` | `/api/bot/control` | Toggle bot ON/OFF (admin wallet required via `x-wallet-address` header) |
| `GET` | `/api/bot/security` | Security role verification across contracts |

Rate limiting: 10-second cooldown between requests.

---

## Vercel Cron Jobs

Configured in `vercel.json`:

| Cron Path | Schedule | Description |
|-----------|----------|-------------|
| `/api/bot/update-prices` | Every 5 minutes | Update TWAP prices for all tokens |
| `/api/bot/scan-loans` | Every 2 minutes | Scan loans for liquidation eligibility |
| `/api/bot/monitor` | Every 5 minutes | General protocol health monitoring |

---

## Navigation

The Navbar renders two navigation groups:

**Public navigation** (7 items): Dashboard, Lend, Borrow, My Loans, Risk, Protocol, Analytics

**Admin navigation** (2 items, conditional): Admin, Bots

Admin links are only visible when the connected wallet matches one of:
- Safe multisig: `0x362D5267A61f65cb4901B163B5D94adbf147DB87`
- Deployer wallet: `0x9ce3F036365DfAf608D5F98B34A5872bbe5Ee125`

The Navbar includes a responsive mobile drawer, wallet `ConnectButton` (RainbowKit), and language switcher.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect project ID |
| `NEXT_PUBLIC_BASE_RPC_URL` | Custom Base RPC endpoint (optional, defaults to public) |
