# OneMEME Launchpad — Subgraph

[![Network: BSC](https://img.shields.io/badge/Network-BNB%20Smart%20Chain-yellow)](https://www.bnbchain.org/)
[![The Graph](https://img.shields.io/badge/The%20Graph-Subgraph-blue)](https://thegraph.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

The Graph subgraph for the [OneMEME Launchpad](https://github.com/timedbase/OneMEMELaunchpad-Core) on BNB Smart Chain. Indexes token launches, bonding-curve trades, DEX migrations, creator vesting, and the optional peripheral contracts (BuyBack, Collector, Vault).

---

## Repository layout

```
abis/
├── BondingCurve.json
├── LaunchpadFactory.json
├── MemeToken.json              Transfer event ABI for the dynamic template
├── Token.json                  minimal ERC-20 (name / symbol / metaURI view calls)
├── VestingWallet.json
└── peripheral/
    ├── Collector.json
    ├── OneMEMEBB.json
    └── Vault.json
src/
├── bondingCurve.ts             buy / sell / migrate handlers + per-block OHLCV snapshots
├── launchpadFactory.ts         token creation, governance, timelock handlers
├── memeToken.ts                Transfer handler for MemeToken dynamic template (Holder tracking)
├── utils.ts                    Factory singleton + token-type detection
├── vestingWallet.ts            vesting schedule + claim handlers
└── peripheral/
    ├── collector.ts            disperse + recipient handlers
    ├── oneMEMEBB.ts            buyback event handlers
    └── vault.ts                multisig proposal lifecycle handlers
schema.graphql                  all GraphQL entities
subgraph.yaml                   core manifest  (3 data sources)
subgraph.full.yaml              full manifest  (6 data sources, includes peripheral)
```

---

## Manifests

Two manifests let you deploy with or without the peripheral contracts.

| Manifest | Data sources | Use when |
|---|---|---|
| `subgraph.yaml` | LaunchpadFactory · BondingCurve · VestingWallet | Default — core indexing only |
| `subgraph.full.yaml` | + OneMEMEBB · Collector · Vault | When you also want peripheral contracts indexed |

---

## Setup

### 1 — Install

```bash
npm install
```

### 2 — Fill in contract addresses

Open **`subgraph.yaml`** (and `subgraph.full.yaml` if using peripheral) and replace every placeholder address and start block:

```yaml
source:
  address: "0x0000000000000000000000000000000000000000"  # ← deployed contract address
  startBlock: 0                                          # ← deployment block number
```

Contracts to configure:

| Field | Contract |
|---|---|
| `LaunchpadFactory` | `LaunchpadFactory.sol` |
| `BondingCurve` | `BondingCurve.sol` |
| `VestingWallet` | `VestingWallet.sol` |
| `OneMEMEBB` *(full only)* | `1MEMEBB.sol` |
| `Collector` *(full only)* | `Collector.sol` |
| `Vault` *(full only)* | `Vault.sol` |

### 3 — Build & deploy

```bash
# Core only
npm run build
npm run deploy

# Core + peripheral
npm run build:full
npm run deploy:full

# Local Graph node
npm run create-local
npm run deploy-local          # core
npm run deploy-local:full     # core + peripheral
```

---

## Schema

### Core entities

| Entity | Description |
|---|---|
| `Factory` | Singleton. Global stats (`totalTokensCreated`, per-type counters, `totalBuys/Sells/Migrations`) and current factory settings (creation fee, default params, owner). |
| `Token` | One per launched token. ERC-20 metadata (`name`, `symbol`, `metaUri`), bonding-curve params, live `raisedBNB`, trade counts, migration state. |
| `Trade` | One per `TokenBought` or `TokenSold` event. `type` is `BUY` or `SELL`. |
| `Migration` | One per `TokenMigrated` event. Stores the PancakeSwap pair address and liquidity amounts. |
| `VestingSchedule` | One per token × beneficiary. Tracks `amount`, `claimed`, `voided`, `burnedOnVoid`, and `voidedTxHash`. |
| `VestingClaim` | One per `Claimed` event. Linked to its `VestingSchedule`. |
| `TimelockAction` | One per timelocked governance action. `id` is the `bytes32 actionId`. Stores `queuedTxHash`, `executedTxHash`, and `cancelledTxHash` for full provenance. Re-queuing resets `executed`/`cancelled`. |
| `TokenSnapshot` | One per token × block. Per-block OHLCV: `openRaisedBNB`, `closeRaisedBNB`, `volumeBNB`, `buyCount`, `sellCount`. Updated on every trade in the block. |
| `Holder` | One per token × address. ERC-20 balance tracked via `Transfer` events while the token is in the bonding-curve phase (`migrated = false`). |

### Peripheral entities *(subgraph.full.yaml only)*

| Entity | Description |
|---|---|
| `BuyBack` | Singleton per contract. Tracks `router`, `buyToken`, `cooldown`, cumulative BNB spent, and `lastBuyAt` (nullable — null until first buyback). |
| `BuyBackEvent` | One per `BoughtBack` event. |
| `Collector` | Singleton per contract. Tracks six recipient addresses and cumulative BNB dispersed. |
| `DisperseEvent` | One per `Dispersed` event. |
| `VaultContract` | Singleton per contract. Tracks proposal count. |
| `VaultProposal` | One per `Proposed` event. Tracks `confirmCount`, `executed`, `cancelled`, `executedTxHash`, and `cancelledTxHash`. The proposer's auto-confirm is counted once in `handleProposed`; the duplicate `Confirmed` event in the same transaction is skipped. |

---

## Token type detection

The factory exposes three creation functions (`createToken`, `createTT`, `createRFL`) that all emit the same `TokenCreated` event. The subgraph recovers the token type by reading the first 4 bytes of `event.transaction.input` (the ABI function selector):

| Selector | Function | `tokenType` |
|---|---|---|
| `0xbc54d40e` | `createToken` | `STANDARD` |
| `0x9d2b1e37` | `createTT` | `TAX` |
| `0x101d747c` | `createRFL` | `REFLECTION` |

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
