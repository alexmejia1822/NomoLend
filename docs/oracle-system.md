# Oracle System

NomoLend uses a **dual-oracle architecture** combining Chainlink price feeds (primary) with off-chain TWAP prices (fallback), managed by the **PriceOracle** contract. All prices are normalized to USDC with 6 decimal precision.

---

## Architecture Overview

```
                          +------------------+
                          |   PriceOracle    |
                          |   (on-chain)     |
                          +--------+---------+
                                   |
                    +--------------+--------------+
                    |                             |
            +-------v--------+          +---------v-------+
            | Chainlink Feed |          |  TWAP Price     |
            | (primary)      |          |  (fallback)     |
            | 8 decimals     |          |  6 decimals     |
            | on-chain       |          |  off-chain      |
            +-------+--------+          |  keeper bot     |
                    |                   +---------+-------+
                    |                             |
            latestRoundData()           updateTwapPrice()
            (automatic)                 (keeper tx)
```

---

## Price Sources

### 1. Chainlink (Primary)

Chainlink feeds provide decentralized, tamper-resistant price data directly on-chain. When available, Chainlink is always preferred.

| Parameter               | Value          |
|-------------------------|----------------|
| Feed decimals           | 8 (typical)    |
| Staleness threshold     | 25 hours       |
| Output normalization    | 6 decimals     |
| Round completeness      | Verified       |

**Validation checks** on every read:
- `answeredInRound >= roundId` (round completeness)
- `block.timestamp - updatedAt <= 25 hours` (staleness)
- `answer > 0` (positive price)

If any check fails, the Chainlink price returns 0 and the system falls back to TWAP.

### 2. TWAP via CoinGecko (Fallback)

For tokens without Chainlink feeds, an off-chain keeper bot fetches time-weighted average prices from CoinGecko and submits them on-chain. This covers the majority of supported tokens (16 out of 21).

| Parameter               | Value          |
|-------------------------|----------------|
| Price decimals          | 6 (USDC)      |
| Updated by              | Keeper bot     |
| Staleness threshold     | 25 hours       |

---

## Chainlink Feed Assignments

The following tokens have dedicated Chainlink price feeds on Base:

| Token  | Chainlink Feed Address                         | Tier |
|--------|-------------------------------------------------|------|
| WETH   | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70`  | A    |
| cbETH  | `0xd7818272B9e248357d13057AAb0B417aF31E817d`  | A    |
| DAI    | `0x591e79239a7d679378eC8c847e5038150364C78F`  | A    |
| USDbC  | `0x7e860098F58bBFC8648a4311b374B1D669a2bc6B`  | A    |
| LINK   | `0x17CAb8FE31E32f08326e5E27412894e49B0f9D65`  | B    |

All other tokens (ZRO, MOCA, UNI, VIRTUAL, GHST, AVAIL, TIG, CYPR, REI, AVNT, VFY, BID, MAMO, GIZA, KTA, BRETT) rely exclusively on TWAP prices.

---

## Manipulation Protection (3 Layers)

### Layer 1 — TWAP Update Cooldown

```
require(block.timestamp >= lastTwapUpdate + 5 minutes)
```

| Parameter            | Default    | Configurable Range |
|----------------------|------------|--------------------|
| `twapUpdateCooldown` | 5 minutes  | 1 min - 1 hour    |

Prevents a compromised keeper from submitting rapid-fire price updates. A minimum of 5 minutes must elapse between consecutive TWAP updates for any given token.

### Layer 2 — Maximum Price Change Per Update

```
diff = |newPrice - lastPrice|
maxChange = lastPrice * 10%

if diff > maxChange:
    reject update (silently, to allow batch to continue)
```

| Parameter          | Default | Configurable Range |
|--------------------|---------|---------------------|
| `maxTwapChangeBps` | 10%     | 1% - 50%           |

If a TWAP update exceeds the maximum allowed change from the previous price, the update is **rejected silently** (no revert). This design allows batch updates to continue even if one price is anomalous — a `TwapPriceRejected` event is emitted for monitoring.

### Layer 3 — Staleness Threshold

```
if block.timestamp - lastTwapUpdate > 25 hours:
    return 0 (price treated as unavailable)
```

| Parameter            | Default   | Configurable Range |
|----------------------|-----------|--------------------|
| `maxPriceStaleness`  | 25 hours  | 1h - 48h          |

Stale prices are not used. The 25-hour default covers a 24-hour Chainlink heartbeat plus a 1-hour buffer for network delays.

---

## Deviation Check

When both Chainlink and TWAP prices are available for a token, the oracle performs a cross-source deviation check:

```
deviation = |chainlinkPrice - twapPrice| / average(chainlinkPrice, twapPrice)

if deviation > 5%:
    confidence = false
```

| Parameter                     | Default | Configurable Range |
|-------------------------------|---------|---------------------|
| `priceDeviationThresholdBps`  | 5%      | 0.01% - 20%        |

When confidence is `false`:
- `getPrice()` still returns the Chainlink price but with `confidence = false`
- `getValueInUsdc()` **reverts** with `"Price not confident"` — this blocks new loan creation and health factor calculations until prices reconverge

---

## How `getPrice()` Works

```
getPrice(token)
   |
   +-- Is feed active?
   |   No  --> return (lastTwapPrice, confidence=false)
   |   Yes --> continue
   |
   +-- Read Chainlink price
   |   (latestRoundData, check staleness & round)
   |
   +-- Read TWAP price
   |   (check staleness)
   |
   +-- Both available?
   |   Yes --> Check deviation
   |           Return (chainlinkPrice, deviationOK?)
   |
   +-- Only Chainlink?
   |   Return (chainlinkPrice, true)
   |
   +-- Only TWAP?
   |   Return (twapPrice, true)
   |
   +-- Neither?
       Revert "No price available"
```

### Price Flow for a Dual-Source Token (e.g., WETH)

```
  Chainlink Feed                PriceOracle              Consumer
  (on-chain)                        |                      |
       |                            |                      |
       |-- latestRoundData() ------>|                      |
       |   answer: 320000000000     |                      |
       |   (3200.00 USD, 8 dec)     |                      |
       |                            |                      |
       |   Normalize to 6 dec:      |                      |
       |   3200000000 (3200.00 USDC)|                      |
       |                            |                      |
  Keeper Bot                        |                      |
  (off-chain)                       |                      |
       |                            |                      |
       |-- updateTwapPrice() ------>|                      |
       |   price: 3185000000        |                      |
       |   (3185.00 USDC, 6 dec)    |                      |
       |                            |                      |
       |   Deviation check:         |                      |
       |   |3200 - 3185| / 3192.5   |                      |
       |   = 0.47% < 5%             |                      |
       |   confidence = true        |                      |
       |                            |                      |
       |                            |<-- getPrice(WETH) ---|
       |                            |                      |
       |                            |--- (3200000000,   -->|
       |                            |     true)            |
```

### Price Flow for a TWAP-Only Token (e.g., CYPR)

```
  Keeper Bot                   PriceOracle              Consumer
  (off-chain)                      |                      |
       |                           |                      |
       |-- updateTwapPrice() ----->|                      |
       |   token: CYPR             |                      |
       |   price: 1250000          |                      |
       |   (1.25 USDC)             |                      |
       |                           |                      |
       |   Chainlink: none (0x0)   |                      |
       |   TWAP: 1250000           |                      |
       |                           |                      |
       |                           |<-- getPrice(CYPR) ---|
       |                           |                      |
       |                           |--- (1250000, true) ->|
```

---

## Value Calculation

`getValueInUsdc(token, amount)` converts a raw token amount to its USDC value:

```
value = (amount * pricePerWholeToken) / (10 ^ tokenDecimals)
```

This function requires `confidence == true`. If the oracle sources disagree beyond the 5% threshold, the call reverts, effectively blocking any operation that depends on accurate pricing (loan creation, health factor checks).

---

## Operational Considerations

### Keeper Bot Responsibilities

The TWAP keeper bot (holding `PRICE_UPDATER_ROLE`) is responsible for:
1. Fetching prices from CoinGecko or equivalent source
2. Calling `batchUpdateTwapPrices()` at regular intervals (well within the 25-hour staleness window)
3. Monitoring for `TwapPriceRejected` events that indicate anomalous price movements

### Graceful Degradation

| Scenario                          | Behavior                                          |
|-----------------------------------|---------------------------------------------------|
| Chainlink feed goes stale         | Falls back to TWAP price with `confidence = true` |
| TWAP goes stale                   | Uses Chainlink only with `confidence = true`      |
| Both sources go stale             | `getPrice()` reverts — all operations blocked     |
| Feed deactivated by admin         | Returns last TWAP with `confidence = false`        |
| Sources disagree > 5%             | Returns Chainlink price, `confidence = false`      |
| `getValueInUsdc()` with low conf  | Reverts — blocks loan creation & health checks    |

### Feed Reconfiguration

When a price feed is reconfigured (e.g., updating the Chainlink address), existing TWAP data is **preserved**. This prevents a reconfiguration from temporarily bricking the oracle for tokens that rely on TWAP.
