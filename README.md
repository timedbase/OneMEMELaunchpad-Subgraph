# OneMEME Launchpad — Subgraph

[![Network: BSC](https://img.shields.io/badge/Network-BNB%20Smart%20Chain-yellow)](https://www.bnbchain.org/)
[![Network: Ethereum](https://img.shields.io/badge/Network-Ethereum-blue)](https://ethereum.org/)
[![The Graph](https://img.shields.io/badge/The%20Graph-Subgraph-blue)](https://thegraph.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

The Graph subgraph for the [OneMEME Launchpad](https://github.com/timedbase/OneMEMELaunchpad-Core) on BNB Smart Chain and Ethereum. Indexes token launches, bonding-curve trades, DEX migrations, creator vesting, token locking (OneCoinLocker), and the Spark V3-LP launch system.

---

## Repository layout

```
abis/
├── CreatorVault.json
├── Launchpad.json
├── MemeToken.json              Transfer event ABI for the MemeToken dynamic template
├── OneCoinLocker.json
├── PancakePair.json            V2 pair Swap/Sync/getReserves — post-migration TAX/REFLECTION trading
├── SparkLauncher.json
├── SparkLocker.json
├── SparkToken.json             name / symbol / metaURI / totalSupply view calls
├── Token.json                  minimal ERC-20 view calls
└── UniswapV3Pool.json          V3 pool Swap/slot0/token0 — Spark trading + post-migration STANDARD trading
src/
├── launchpad.ts                 token creation, bonding-curve trades, migration, governance, timelock, OHLCV
├── creatorVault.ts              vesting, V3 fee-claim positions; wires the LaunchpadV3Pool template on migration
├── launchpadPool.ts             post-migration Swap handler — STANDARD tokens' PancakeSwap V3 pool
├── launchpadPair.ts             post-migration Swap handler — TAX/REFLECTION tokens' PancakeSwap V2 pair
├── locker.ts                    OneCoinLocker lock/withdraw/transfer handlers
├── memeToken.ts                 Transfer handler for MemeToken dynamic template (holder tracking, full lifetime)
├── sparkLauncher.ts             SparkLauncher token launch + DEX/quote-token admin handlers
├── sparkLocker.ts               SparkLocker fee-claim + governance handlers
├── sparkPool.ts                 Spark's Uniswap V3 pool Swap handler (trades, price, OHLCV)
├── sparkToken.ts                Transfer handler for SparkToken dynamic template (holder tracking)
└── utils.ts                     Factory singleton, token-type detection, shared price/OHLCV/IPFS helpers
schema.graphql                   all GraphQL entities
subgraph.bsc.yaml                BSC manifest
subgraph.ethereum.yaml           Ethereum mainnet manifest
```

---

## Manifests

Two chain-specific manifests share the same schema and mappings.

| Manifest | Network | Notes |
|---|---|---|
| `subgraph.bsc.yaml` | BNB Smart Chain | default target |
| `subgraph.ethereum.yaml` | Ethereum mainnet | same data sources, different addresses |

Each manifest includes six contract data sources — `Launchpad` · `CreatorVault` · `NativeUsdOracle` · `OneCoinLocker` · `SparkLauncher` · `SparkLocker` — plus five dynamic-data-source templates: `MemeToken` (per-launched-token holder tracking), `SparkToken` (per-Spark-token holder tracking), `UniswapV3Pool` (Spark trading), `LaunchpadV3Pool` (post-migration trading for `STANDARD` tokens), and `PancakePair` (post-migration trading for `TAX`/`REFLECTION` tokens).

---

## USD pricing

`NativeUsdOracle` indexes the chain's USDC/native-token V2 pool — the same `usdQuotePair` the Launchpad contract itself uses to size USD-denominated launches (read live from the deployed contracts via `usdcToken()`/`usdQuotePair()`, not guessed):

| Chain | Pool | USDC decimals | startBlock |
|---|---|---|---|
| BSC | [`0xd99c7f6...2fc5b`](https://bscscan.com/address/0xd99c7f6c65857ac913a8f880a4cb84032ab2fc5b) — USDC/WBNB PancakeSwap V2 | 18 (Binance-Peg) | `100627321` |
| Ethereum | [`0xb4e16d0...c9dc`](https://etherscan.io/address/0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc) — USDC/WETH Uniswap V2 | 6 | `25182671` |

Both `startBlock`s match `OneCoinLocker`'s — the earliest `startBlock` among each chain's other data sources — so the oracle's history covers the full range of every other indexed event. USDC is treated as a fixed $1 peg (no external price feed); `NativeUsdPrice` (singleton) tracks the live rate from `Sync` event reserves, decimal-adjusted per chain, and `NativeUsdPriceSnapshot` keeps a per-block history of it. `Token.priceUSD`/`marketCapUSD` and `SparkLaunchedToken.priceUSD`/`marketCapUSD` (both nullable — null until the oracle produces its first rate) are derived from this at every price update, so they always reflect the oracle rate *at that block*, not today's rate — i.e. they're already historically exact as of when each trade happened, without needing a client-side join.

Spark tokens only get a `priceUSD` when their `quoteToken` actually is the wrapped native asset (`SparkQuoteToken.isNative`) — for any other quote token there's no oracle to convert from, so both fields stay null rather than reporting a misleading number.

---

## Post-migration DEX tracking

Trade/price/holder tracking does not stop when a token migrates off the bonding curve — it follows the token to its destination venue, which depends on `tokenType`:

| `tokenType` | Destination | Wired from | Trade entity |
|---|---|---|---|
| `STANDARD` | Fresh PancakeSwap **V3** 1% pool, LP locked in `CreatorVault` | `CreatorVault.PositionRegistered` (`creatorVault.ts`) | `DexTrade` (`venue: V3_POOL`) |
| `TAX` / `REFLECTION` | PancakeSwap **V2** pair, LP burned | `Launchpad.TokenMigrated` (`launchpad.ts`) | `DexTrade` (`venue: V2_PAIR`) |

Both paths keep `Token.lastKnownPrice`/`marketCap` and the `TokenSnapshot`/`TokenPeriodStats` OHLCV buckets updating using the same shared helpers the bonding-curve phase uses (`src/utils.ts`). Bonding-curve trades remain in `Trade`; post-migration swaps land in the separate `DexTrade` entity — query both (`Token.trades` + `Token.dexTrades`) for a token's complete history. `Holder` balances are tracked for the token's full lifetime, not just the bonding-curve phase.

For `STANDARD` migrations, `TokenMigrated.pair` and `CreatorVaultPosition.pool` are the same V3 pool address (`PositionRegistered` fires first, in the same transaction), so `launchpad.ts` only wires a V2 pair when no `CreatorVaultPosition` was already registered for that token.

---

## Setup

### 1 — Install

```bash
npm install
```

### 2 — Fill in contract addresses

The following contracts already have addresses in the manifests. Before deploying, verify them and fill in the two **TODO** Spark placeholders:

#### BSC (`subgraph.bsc.yaml`)

| Contract | Address | Status |
|---|---|---|
| `LaunchpadFactory` | `0xB9d4d353C53D83159758a3B5787e744B9F999463` | deployed |
| `BondingCurve` | `0xbB843b111639B9F19E575e3804b7c006eE1F80a9` | deployed |
| `VestingWallet` | `0x1fFBE03316743187fCEC8eA41fd76f8Ada74658C` | deployed |
| `OneCoinLocker` | `0x6C6e9740753d9F6C1E5D61C8bc0f34E37590f6C5` | deployed |
| `SparkLauncher` | `0x327A4d9360a96fe0d782235D35927A7Ea0a85b52` | deployed |
| `SparkLocker` | `0xae04d8C894162213dcDE6e9bA4f5a42eE00f5950` | deployed |

#### Ethereum (`subgraph.ethereum.yaml`)

| Contract | Address | Status |
|---|---|---|
| `LaunchpadFactory` | `0xe51D92fA3C1C78A9D3B11618fb0bEA319727e2eA` | deployed |
| `BondingCurve` | `0xA78df27496825B29CbdCD3778e6bc375a646Ae04` | deployed |
| `VestingWallet` | `0xe9F35abA5B0926258bE6EBbc17546B02704fB91C` | deployed |
| `OneCoinLocker` | `0xD7F53605d58057D8f96337dF606638c3e79B9867` | deployed |
| `SparkLauncher` | `0x058AC204CFbC39fBC1b21f417093a9AE6E238454` | deployed |
| `SparkLocker` | `0x0978D78dFBE7D76d06cB6267dEf2857685Aaa507` | deployed |


### 3 — Build & deploy

```bash
# BSC (default)
npm run codegen
npm run build
npm run deploy

# Ethereum
npm run codegen:ethereum
npm run build:ethereum
npm run deploy:ethereum

# Local Graph node
npm run create-local
npm run deploy-local
```

---

## Schema

### Core entities

| Entity | Description |
|---|---|
| `Factory` | Singleton. Global stats (`totalTokensCreated`, per-type counters, `totalBuys/Sells/Migrations`) and current factory settings (creation fee, default params, owner). |
| `Token` | One per launched token. ERC-20 metadata, bonding-curve params, live `raisedBNB`, trade counts, migration state, `lastKnownPrice` (current spot price in wei, updated after every bonding-curve trade **and** every post-migration DEX swap), `marketCap` (`lastKnownPrice × totalSupply / 1e18`), and `priceUSD`/`marketCapUSD` (via the `NativeUsdOracle`, nullable until the oracle has a rate). |
| `Trade` | One per `TokenBought` or `TokenSold` event (bonding-curve phase only). `type` is `BUY` or `SELL`. |
| `DexTrade` | One per post-migration swap, on either destination venue. `venue` is `V2_PAIR` or `V3_POOL`; `type` is `BUY` or `SELL`. |
| `LaunchpadPool` | Lookup: PancakeSwap V3 pool address → `Token`, for `STANDARD`-token migrations. |
| `LaunchpadPair` | Lookup: PancakeSwap V2 pair address → `Token`, for `TAX`/`REFLECTION`-token migrations. |
| `NativeUsdPrice` | Singleton. Live BNB/USD or ETH/USD rate derived from the `NativeUsdOracle` pool's reserves. |
| `NativeUsdPriceSnapshot` | One per block the oracle pool's reserves changed. Historical native/USD OHLC — see [USD pricing](#usd-pricing). |
| `Migration` | One per `TokenMigrated` event. Stores the PancakeSwap pair/pool address and liquidity amounts. |
| `VestingSchedule` | One per token × beneficiary. Tracks `amount`, `claimed`, `voided`, `burnedOnVoid`, and `voidedTxHash`. |
| `VestingClaim` | One per `Claimed` event. Linked to its `VestingSchedule`. |
| `TimelockAction` | One per timelocked governance action. Stores `queuedTxHash`, `executedTxHash`, and `cancelledTxHash` for full provenance. Re-queuing resets `executed`/`cancelled`. |
| `TokenSnapshot` | One per (token, block). Per-block OHLCV: `openPrice`, `highPrice`, `lowPrice`, `closePrice` (actual spot price in wei), plus `openRaisedBNB`, `closeRaisedBNB`, `volumeBNB`, `buyCount`, `sellCount`. Continues updating past migration. |
| `TokenPeriodStats` | Time-bucketed stats per (token, period, bucket). Five windows: `5m`, `45m`, `1h`, `1d`, `7d`. Includes the same OHLCV price fields as `TokenSnapshot`. Continues updating past migration. |
| `Holder` | One per (token, address). ERC-20 balance tracked via `Transfer` events for the token's full lifetime. |

### OneCoinLocker entities

| Entity | Description |
|---|---|
| `Locker` | Singleton per deployed contract. Tracks `totalLocks`, `activeLocks`, and current `fee`. |
| `Lock` | One per `LockCreated` event. Tracks owner, token, amount, lock type (`Cliff` / `Linear`), timeouts, and withdrawal progress. |
| `LockWithdrawal` | One per `Withdrawn` event. |
| `LockTransfer` | One per `LockTransferred` event. |

### Spark entities

| Entity | Description |
|---|---|
| `SparkLaunchedToken` | One per `TokenLaunched` event. Ownerless ERC-20 with a full-range Uniswap V3 LP permanently locked in SparkLocker. Stores ERC-20 metadata (name, symbol, `totalSupply`, IPFS-resolved description/image/website/twitter/telegram), pool/LP-NFT info, live `lastKnownPrice`/`marketCap`, `priceUSD`/`marketCapUSD` (only when `quoteToken` is the native asset — see [USD pricing](#usd-pricing)), and cumulative fee totals split across creator / platform / charity for both token0 and token1. |
| `SparkTokenSnapshot` | One per (Spark token, block). Per-block OHLCV, mirroring `TokenSnapshot` (`volumeQuote` instead of `volumeBNB` since the quote asset varies per token). |
| `SparkTokenPeriodStats` | Time-bucketed stats per (Spark token, period, bucket), mirroring `TokenPeriodStats`. Same five windows. |
| `SparkFeeClaim` | One per `FeesClaimed` event. Records the per-claim breakdown for all six fee buckets plus the `feeWallet` that triggered the claim. |
| `SparkLockerState` | Singleton per deployed SparkLocker contract. Initialized on the first event via contract calls; updated by governance events. Stores owner, wallets, and fee basis-points (default: creator 70 % / platform 25 % / charity 5 %). |
| `SparkDex` | One per `DexAdded` event (keyed by V3 factory address). Stores `positionManager`, `router`, and enabled state. |
| `SparkQuoteToken` | One per `QuoteTokenAdded` event. Stores `marketCapRef`, `wethPairFee`, and enabled state. |
| `SparkPool` | Lookup: Uniswap V3 pool address → `SparkLaunchedToken`, created at launch. |
| `SparkHolder` | One per (Spark token, address). ERC-20 balance tracked via `Transfer` events for the token's full lifetime. |

---

## OHLCV price implementation

`TokenSnapshot` and `TokenPeriodStats` (and their Spark equivalents, `SparkTokenSnapshot`/`SparkTokenPeriodStats`) expose four spot-price fields in addition to the raw pool/volume values:

| Field | Description |
|---|---|
| `openPrice` | Spot price at the start of the block/bucket — the `lastKnownPrice` persisted from the previous trade |
| `highPrice` | Running maximum spot price seen within the block/bucket |
| `lowPrice` | Running minimum spot price seen within the block/bucket |
| `closePrice` | Spot price after the last trade in the block/bucket |

Prices are wei-of-native/quote-asset per whole token, scaled ×1e18, computed per venue (`src/utils.ts`):

```
bonding curve (Launchpad):  price = (virtualBNB + raisedBNB) × 1e18 / bcTokensPool
V2 pair (post-migration):   price = quoteReserve × 1e18 / trackedReserve      (from a live getReserves() call)
V3 pool (Spark + post-migration STANDARD migrations):
                             price = (sqrtPriceX96² / 2^192) × 1e18, inverted if the tracked token is token1
```

`Token.lastKnownPrice` (and `SparkLaunchedToken.lastKnownPrice`) is seeded at creation/launch time and updated after every trade — bonding-curve, Spark, or post-migration DEX swap — so consecutive blocks always have a valid open price even without an inter-block snapshot. `marketCap` (`price × totalSupply / 1e18`) is kept in sync alongside it, and is intentionally not duplicated into every historical snapshot row — see the units note in [QueryExamples.md](QueryExamples.md).

---

## Token type detection

The factory exposes three creation functions (`createToken`, `createTT`, `createRFL`) that all emit the same `TokenCreated` event. The subgraph recovers the token type by reading the first 4 bytes of `event.transaction.input` (the ABI function selector):

| Selector | Function | `tokenType` |
|---|---|---|
| `0x6b948c92` | `createToken` | `STANDARD` |
| `0x917a6333` | `createTT` | `TAX` |
| `0x13b0f58a` | `createRFL` | `REFLECTION` |

Tokens created via a proxy or multicall that wraps the factory will produce `UNKNOWN`.

---

## Query examples

See [QueryExamples.md](QueryExamples.md) for the full query reference covering all entities, filter patterns, and combined queries.

---

## Core contract reference

See [OneMEMELaunchpad-Core](https://github.com/timedbase/OneMEMELaunchpad-Core) for full contract documentation, deployment instructions, and bonding-curve mechanics.

---

## License

[MIT](LICENSE)
