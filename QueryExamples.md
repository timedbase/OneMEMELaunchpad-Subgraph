# Query Examples

GraphQL query reference for the OneMEME Launchpad subgraph.  
All fields are verified against [`schema.graphql`](schema.graphql).  
Replace placeholder addresses (`0xTOKEN_ADDRESS`, etc.) with real checksummed hex.

---

## Table of contents

1. [Factory](#factory)
2. [Tokens](#tokens)
3. [Trades](#trades)
4. [Migrations](#migrations)
5. [Vesting](#vesting)
6. [Governance — Timelock actions](#governance--timelock-actions)
7. [Peripheral — BuyBack](#peripheral--buyback)
8. [Peripheral — Collector](#peripheral--collector)
9. [Peripheral — Vault](#peripheral--vault)
10. [Token Snapshots (OHLCV)](#token-snapshots-ohlcv)
11. [Holders](#holders)
12. [Analytics & combined queries](#analytics--combined-queries)
13. [Pagination](#pagination)

---

## Factory

The `Factory` entity is a singleton. Query it as a list and take the first result, or by its fixed `id`.

### Global stats

```graphql
{
  factories {
    totalTokensCreated
    totalStandardTokens
    totalTaxTokens
    totalReflectionTokens
    totalBuys
    totalSells
    totalMigrations
    creationFee
    defaultVirtualBNB
    defaultMigrationTarget
    owner
  }
}
```

### Factory with pending governance actions

```graphql
{
  factories {
    totalTokensCreated
    totalBuys
    totalSells
    totalMigrations
    creationFee
    defaultVirtualBNB
    defaultMigrationTarget
    timelockActions(where: { executed: false, cancelled: false }) {
      id
      executeAfter
      queuedAtTimestamp
    }
  }
}
```

---

## Tokens

### All tokens — newest first

```graphql
{
  tokens(orderBy: createdAtTimestamp, orderDirection: desc, first: 20) {
    id
    name
    symbol
    tokenType
    creator
    totalSupply
    raisedBNB
    migrationTarget
    migrated
    buysCount
    sellsCount
    createdAtTimestamp
  }
}
```

### Single token — full detail

```graphql
{
  token(id: "0xTOKEN_ADDRESS") {
    id
    name
    symbol
    tokenType
    creator
    totalSupply
    virtualBNB
    migrationTarget
    antibotEnabled
    tradingBlock
    raisedBNB
    migrated
    pair
    migrationBNB
    migrationLiquidityTokens
    migratedAtTimestamp
    migratedAtBlockNumber
    buysCount
    sellsCount
    totalVolumeBNBBuy
    totalVolumeBNBSell
    createdAtTimestamp
    createdAtBlockNumber
    txHash
  }
}
```

### Tokens by creator

```graphql
{
  tokens(
    where: { creator: "0xCREATOR_ADDRESS" }
    orderBy: createdAtTimestamp
    orderDirection: desc
  ) {
    id
    name
    symbol
    tokenType
    raisedBNB
    migrationTarget
    migrated
    pair
    buysCount
    sellsCount
    totalVolumeBNBBuy
    totalVolumeBNBSell
    createdAtTimestamp
  }
}
```

### Tokens still on the bonding curve (not yet migrated)

```graphql
{
  tokens(where: { migrated: false }, orderBy: raisedBNB, orderDirection: desc) {
    id
    name
    symbol
    tokenType
    raisedBNB
    migrationTarget
    antibotEnabled
    tradingBlock
    buysCount
    sellsCount
    creator
    createdAtTimestamp
  }
}
```

### Tokens that have migrated to DEX

```graphql
{
  tokens(where: { migrated: true }, orderBy: migratedAtTimestamp, orderDirection: desc) {
    id
    name
    symbol
    tokenType
    pair
    migrationBNB
    migrationLiquidityTokens
    migratedAtTimestamp
    totalVolumeBNBBuy
    totalVolumeBNBSell
    buysCount
    sellsCount
  }
}
```

### Tokens by type

```graphql
# tokenType: STANDARD | TAX | REFLECTION | UNKNOWN
{
  tokens(
    where: { tokenType: "TAX" }
    orderBy: createdAtTimestamp
    orderDirection: desc
  ) {
    id
    name
    symbol
    raisedBNB
    migrated
    creator
    createdAtTimestamp
  }
}
```

### Tokens near migration threshold (≥ 80 % filled)

Returns tokens whose `raisedBNB` is at least 80 % of `migrationTarget`.  
Since The Graph cannot compute ratios in a filter, the pattern is to filter by a known minimum `raisedBNB` value and sort descending — or use a client-side ratio check on results.

```graphql
# Fetch active tokens sorted by raisedBNB desc; filter client-side for raisedBNB / migrationTarget >= 0.8
{
  tokens(
    where: { migrated: false }
    orderBy: raisedBNB
    orderDirection: desc
    first: 50
  ) {
    id
    name
    symbol
    raisedBNB
    migrationTarget
    buysCount
  }
}
```

### Fresh launches — tokens with zero trades yet

```graphql
{
  tokens(where: { buysCount: 0, migrated: false }, orderBy: createdAtTimestamp, orderDirection: desc) {
    id
    name
    symbol
    tokenType
    creator
    createdAtTimestamp
    txHash
  }
}
```

### Tokens with antibot enabled

```graphql
{
  tokens(where: { antibotEnabled: true }, orderBy: createdAtTimestamp, orderDirection: desc) {
    id
    name
    symbol
    tradingBlock
    createdAtBlockNumber
    raisedBNB
    migrated
  }
}
```

### Tokens created within a time range

```graphql
# Unix timestamps: 1700000000 to 1710000000
{
  tokens(
    where: {
      createdAtTimestamp_gte: "1700000000"
      createdAtTimestamp_lte: "1710000000"
    }
    orderBy: createdAtTimestamp
    orderDirection: asc
  ) {
    id
    name
    symbol
    tokenType
    creator
    createdAtTimestamp
  }
}
```

---

## Trades

### Recent trades across all tokens

```graphql
{
  trades(orderBy: timestamp, orderDirection: desc, first: 50) {
    id
    token { id name symbol }
    trader
    type
    bnbAmount
    tokenAmount
    tokensToDead
    raisedBNBAfter
    timestamp
    blockNumber
    txHash
  }
}
```

### Trades on a specific token

```graphql
{
  trades(
    where: { token: "0xTOKEN_ADDRESS" }
    orderBy: timestamp
    orderDirection: desc
    first: 100
  ) {
    type
    trader
    bnbAmount
    tokenAmount
    tokensToDead
    raisedBNBAfter
    timestamp
    blockNumber
    txHash
  }
}
```

### All trades by a specific wallet

```graphql
{
  trades(
    where: { trader: "0xTRADER_ADDRESS" }
    orderBy: timestamp
    orderDirection: desc
  ) {
    type
    token { id name symbol tokenType }
    bnbAmount
    tokenAmount
    tokensToDead
    raisedBNBAfter
    timestamp
    txHash
  }
}
```

### Buys only — sorted by BNB spent (largest first)

```graphql
{
  trades(
    where: { type: "BUY" }
    orderBy: bnbAmount
    orderDirection: desc
    first: 20
  ) {
    token { id name symbol }
    trader
    bnbAmount
    tokenAmount
    tokensToDead
    raisedBNBAfter
    timestamp
    txHash
  }
}
```

### Sells only — sorted by BNB received (largest first)

```graphql
{
  trades(
    where: { type: "SELL" }
    orderBy: bnbAmount
    orderDirection: desc
    first: 20
  ) {
    token { id name symbol }
    trader
    bnbAmount
    tokenAmount
    raisedBNBAfter
    timestamp
    txHash
  }
}
```

### Large trades — whale filter (buys > 0.5 BNB)

`bnbAmount` is stored in wei (1 BNB = 1e18).

```graphql
{
  trades(
    where: { type: "BUY", bnbAmount_gt: "500000000000000000" }
    orderBy: bnbAmount
    orderDirection: desc
  ) {
    token { id name symbol }
    trader
    bnbAmount
    tokenAmount
    timestamp
    txHash
  }
}
```

### Trades with antibot penalty applied (tokensToDead > 0)

```graphql
{
  trades(
    where: { tokensToDead_gt: "0" }
    orderBy: timestamp
    orderDirection: desc
  ) {
    token { id name symbol }
    trader
    tokenAmount
    tokensToDead
    bnbAmount
    timestamp
    txHash
  }
}
```

### Trades within a time range

```graphql
{
  trades(
    where: {
      timestamp_gte: "1700000000"
      timestamp_lte: "1710000000"
    }
    orderBy: timestamp
    orderDirection: asc
  ) {
    type
    token { id name symbol }
    trader
    bnbAmount
    tokenAmount
    timestamp
  }
}
```

---

## Migrations

### All migrations — newest first

```graphql
{
  migrations(orderBy: timestamp, orderDirection: desc) {
    id
    token { id name symbol tokenType creator }
    pair
    liquidityBNB
    liquidityTokens
    timestamp
    blockNumber
    txHash
  }
}
```

### Migration for a specific token

```graphql
{
  migrations(where: { token: "0xTOKEN_ADDRESS" }) {
    pair
    liquidityBNB
    liquidityTokens
    timestamp
    blockNumber
    txHash
  }
}
```

### Migrations sorted by liquidity BNB (largest first)

```graphql
{
  migrations(orderBy: liquidityBNB, orderDirection: desc, first: 20) {
    token { id name symbol tokenType }
    pair
    liquidityBNB
    liquidityTokens
    timestamp
  }
}
```

---

## Vesting

### All active vesting schedules (not voided)

```graphql
{
  vestingSchedules(where: { voided: false }) {
    id
    token { id name symbol }
    beneficiary
    amount
    claimed
    createdAtTimestamp
    createdAtBlockNumber
    txHash
  }
}
```

### Schedules for a specific beneficiary

```graphql
{
  vestingSchedules(where: { beneficiary: "0xBENEFICIARY_ADDRESS" }) {
    token { id name symbol tokenType }
    amount
    claimed
    voided
    burnedOnVoid
    createdAtTimestamp
    txHash
  }
}
```

### Schedules for a specific token

```graphql
{
  vestingSchedules(where: { token: "0xTOKEN_ADDRESS" }) {
    beneficiary
    amount
    claimed
    voided
    burnedOnVoid
    createdAtTimestamp
  }
}
```

### Claim history for a beneficiary

```graphql
{
  vestingClaims(
    where: { schedule_: { beneficiary: "0xBENEFICIARY_ADDRESS" } }
    orderBy: timestamp
    orderDirection: desc
  ) {
    schedule { token { id name symbol } amount claimed }
    amount
    timestamp
    blockNumber
    txHash
  }
}
```

### All claims on a specific token

```graphql
{
  vestingClaims(
    where: { schedule_: { token: "0xTOKEN_ADDRESS" } }
    orderBy: timestamp
    orderDirection: desc
  ) {
    schedule { beneficiary amount claimed }
    amount
    timestamp
    txHash
  }
}
```

### Voided schedules

```graphql
{
  vestingSchedules(where: { voided: true }) {
    token { id name symbol }
    beneficiary
    amount
    claimed
    burnedOnVoid
    createdAtTimestamp
  }
}
```

### Schedules with unclaimed balance (not voided, claimed < amount)

```graphql
# Fetches non-voided schedules where something has been claimed but not fully vested yet.
# Filter claimed_lt cannot express "claimed < amount" dynamically — fetch all and compute client-side.
{
  vestingSchedules(
    where: { voided: false }
    orderBy: amount
    orderDirection: desc
  ) {
    token { id name symbol }
    beneficiary
    amount
    claimed
    createdAtTimestamp
  }
}
```

---

## Governance — Timelock actions

### Pending actions (queued, not yet executed or cancelled)

```graphql
{
  timelockActions(
    where: { executed: false, cancelled: false }
    orderBy: executeAfter
    orderDirection: asc
  ) {
    id
    executeAfter
    queuedAtTimestamp
    queuedAtBlockNumber
    queuedTxHash
  }
}
```

### Full timelock history — newest first

```graphql
{
  timelockActions(orderBy: queuedAtTimestamp, orderDirection: desc) {
    id
    executed
    cancelled
    executeAfter
    queuedAtTimestamp
    queuedAtBlockNumber
    queuedTxHash
  }
}
```

### Executed actions only

```graphql
{
  timelockActions(where: { executed: true }, orderBy: queuedAtTimestamp, orderDirection: desc) {
    id
    executeAfter
    queuedAtTimestamp
    queuedTxHash
  }
}
```

### Cancelled actions only

```graphql
{
  timelockActions(where: { cancelled: true }, orderBy: queuedAtTimestamp, orderDirection: desc) {
    id
    executeAfter
    queuedAtTimestamp
    queuedTxHash
  }
}
```

---

## Peripheral — BuyBack

> Requires `subgraph.full.yaml` deployment.

### BuyBack contract state

```graphql
{
  buyBacks {
    id
    owner
    router
    buyToken
    cooldown
    lastBuyAt
    totalBNBSpent
    buybackCount
  }
}
```

### BuyBack state with full event history

```graphql
{
  buyBacks {
    id
    owner
    router
    buyToken
    cooldown
    lastBuyAt
    totalBNBSpent
    buybackCount
    events(orderBy: timestamp, orderDirection: desc, first: 20) {
      bnbSpent
      balanceBefore
      timestamp
      txHash
    }
  }
}
```

### Recent buyback events

```graphql
{
  buyBackEvents(orderBy: timestamp, orderDirection: desc, first: 20) {
    buyback { id buyToken }
    bnbSpent
    balanceBefore
    timestamp
    blockNumber
    txHash
  }
}
```

### Largest buybacks by BNB spent

```graphql
{
  buyBackEvents(orderBy: bnbSpent, orderDirection: desc, first: 10) {
    buyback { id buyToken }
    bnbSpent
    balanceBefore
    timestamp
    txHash
  }
}
```

---

## Peripheral — Collector

> Requires `subgraph.full.yaml` deployment.

### Collector state

```graphql
{
  collectors {
    id
    owner
    cr8
    mtn
    bb
    tw
    hk
    kjc
    totalDispersed
    disperseCount
  }
}
```

### Collector state with disperse history

```graphql
{
  collectors {
    id
    owner
    totalDispersed
    disperseCount
    disperses(orderBy: timestamp, orderDirection: desc, first: 20) {
      total
      timestamp
      txHash
    }
  }
}
```

### All disperse events — newest first

```graphql
{
  disperseEvents(orderBy: timestamp, orderDirection: desc) {
    collector { id }
    total
    timestamp
    blockNumber
    txHash
  }
}
```

### Largest disperse events

```graphql
{
  disperseEvents(orderBy: total, orderDirection: desc, first: 10) {
    collector { id }
    total
    timestamp
    txHash
  }
}
```

---

## Peripheral — Vault

> Requires `subgraph.full.yaml` deployment.

### Vault state

```graphql
{
  vaultContracts {
    id
    proposalCount
  }
}
```

### All proposals — newest first

```graphql
{
  vaultProposals(orderBy: createdAtTimestamp, orderDirection: desc) {
    id
    vault { id }
    proposalId
    to
    value
    data
    proposer
    confirmCount
    executed
    cancelled
    createdAtTimestamp
    createdAtBlockNumber
    txHash
  }
}
```

### Proposals awaiting execution (2-of-3 threshold met, not yet executed)

```graphql
{
  vaultProposals(
    where: { executed: false, cancelled: false, confirmCount_gte: 2 }
    orderBy: createdAtTimestamp
    orderDirection: desc
  ) {
    proposalId
    to
    value
    data
    proposer
    confirmCount
    createdAtTimestamp
    txHash
  }
}
```

### Proposals still collecting signatures (threshold not yet met)

```graphql
{
  vaultProposals(
    where: { executed: false, cancelled: false, confirmCount_lt: 2 }
    orderBy: createdAtTimestamp
    orderDirection: desc
  ) {
    proposalId
    to
    value
    proposer
    confirmCount
    createdAtTimestamp
  }
}
```

### Executed proposals

```graphql
{
  vaultProposals(
    where: { executed: true }
    orderBy: createdAtTimestamp
    orderDirection: desc
  ) {
    proposalId
    to
    value
    data
    proposer
    createdAtTimestamp
    txHash
  }
}
```

### Cancelled proposals

```graphql
{
  vaultProposals(
    where: { cancelled: true }
    orderBy: createdAtTimestamp
    orderDirection: desc
  ) {
    proposalId
    to
    value
    proposer
    createdAtTimestamp
    txHash
  }
}
```

---

## Token Snapshots (OHLCV)

Per-block price/volume snapshots recorded each time a buy or sell occurs. One `TokenSnapshot` entity per (token, block) pair. `openRaisedBNB` / `closeRaisedBNB` represent the bonding-curve `raisedBNB` value before and after the first/last trade in the block.

### Recent snapshots for a token

```graphql
{
  tokenSnapshots(
    where: { token: "0xTOKEN_ADDRESS" }
    orderBy: blockNumber
    orderDirection: desc
    first: 50
  ) {
    id
    blockNumber
    timestamp
    openRaisedBNB
    closeRaisedBNB
    volumeBNB
    buyCount
    sellCount
  }
}
```

### Snapshots in a block range

```graphql
{
  tokenSnapshots(
    where: {
      token: "0xTOKEN_ADDRESS"
      blockNumber_gte: "30000000"
      blockNumber_lte: "30001000"
    }
    orderBy: blockNumber
    orderDirection: asc
    first: 1000
  ) {
    blockNumber
    timestamp
    openRaisedBNB
    closeRaisedBNB
    volumeBNB
    buyCount
    sellCount
  }
}
```

### High-volume blocks — snapshots with most BNB traded

```graphql
{
  tokenSnapshots(
    where: { token: "0xTOKEN_ADDRESS" }
    orderBy: volumeBNB
    orderDirection: desc
    first: 10
  ) {
    blockNumber
    timestamp
    volumeBNB
    buyCount
    sellCount
    openRaisedBNB
    closeRaisedBNB
  }
}
```

### Latest snapshot (current price proxy)

```graphql
{
  tokenSnapshots(
    where: { token: "0xTOKEN_ADDRESS" }
    orderBy: blockNumber
    orderDirection: desc
    first: 1
  ) {
    blockNumber
    timestamp
    closeRaisedBNB
    volumeBNB
  }
}
```

### All snapshots across all tokens in a time window

```graphql
{
  tokenSnapshots(
    where: {
      timestamp_gte: "1700000000"
      timestamp_lte: "1700086400"
    }
    orderBy: volumeBNB
    orderDirection: desc
    first: 100
  ) {
    token { id name symbol }
    blockNumber
    timestamp
    volumeBNB
    buyCount
    sellCount
  }
}
```

---

## Holders

`Holder` entities track the current ERC-20 balance of every address that has ever received a token while it is on the bonding curve. Tracking stops once the token migrates to a DEX (to avoid indexing high-volume swap traffic).

### All holders of a token — sorted by balance

```graphql
{
  holders(
    where: { token: "0xTOKEN_ADDRESS" }
    orderBy: balance
    orderDirection: desc
    first: 100
  ) {
    id
    address
    balance
    lastUpdatedBlock
    lastUpdatedTimestamp
  }
}
```

### Top 10 holders (whale list)

```graphql
{
  holders(
    where: { token: "0xTOKEN_ADDRESS" }
    orderBy: balance
    orderDirection: desc
    first: 10
  ) {
    address
    balance
    lastUpdatedBlock
  }
}
```

### Holder count for a token (via token entity)

```graphql
{
  token(id: "0xTOKEN_ADDRESS") {
    id
    name
    symbol
    holders {
      id
    }
  }
}
```

### Single wallet — all tokens held (pre-migration positions)

```graphql
{
  holders(
    where: { address: "0xWALLET_ADDRESS" }
    orderBy: balance
    orderDirection: desc
    first: 50
  ) {
    token { id name symbol raisedBNB migrated }
    balance
    lastUpdatedBlock
    lastUpdatedTimestamp
  }
}
```

### Holders updated in last N blocks

```graphql
{
  holders(
    where: {
      token: "0xTOKEN_ADDRESS"
      lastUpdatedBlock_gte: "30000000"
    }
    orderBy: lastUpdatedBlock
    orderDirection: desc
    first: 50
  ) {
    address
    balance
    lastUpdatedBlock
    lastUpdatedTimestamp
  }
}
```

### Token with snapshot and holder data combined

```graphql
{
  token(id: "0xTOKEN_ADDRESS") {
    id
    name
    symbol
    raisedBNB
    migrated
    metaUri
    description
    image
    website
    twitter
    telegram
    snapshots(orderBy: blockNumber, orderDirection: desc, first: 20) {
      blockNumber
      timestamp
      openRaisedBNB
      closeRaisedBNB
      volumeBNB
      buyCount
      sellCount
    }
    holders(orderBy: balance, orderDirection: desc, first: 20) {
      address
      balance
      lastUpdatedBlock
    }
  }
}
```

---

## Analytics & combined queries

### Token with full trade, vesting, and migration detail

```graphql
{
  token(id: "0xTOKEN_ADDRESS") {
    name
    symbol
    tokenType
    creator
    totalSupply
    raisedBNB
    migrationTarget
    migrated
    pair
    migrationBNB
    migrationLiquidityTokens
    migratedAtTimestamp
    buysCount
    sellsCount
    totalVolumeBNBBuy
    totalVolumeBNBSell
    createdAtTimestamp
    trades(orderBy: timestamp, orderDirection: desc, first: 50) {
      type
      trader
      bnbAmount
      tokenAmount
      tokensToDead
      raisedBNBAfter
      timestamp
      txHash
    }
    vestingSchedules {
      beneficiary
      amount
      claimed
      voided
      burnedOnVoid
    }
    migrations {
      pair
      liquidityBNB
      liquidityTokens
      timestamp
      txHash
    }
  }
}
```

### Creator portfolio — all tokens with volume stats

```graphql
{
  tokens(
    where: { creator: "0xCREATOR_ADDRESS" }
    orderBy: totalVolumeBNBBuy
    orderDirection: desc
  ) {
    id
    name
    symbol
    tokenType
    raisedBNB
    migrationTarget
    migrated
    pair
    buysCount
    sellsCount
    totalVolumeBNBBuy
    totalVolumeBNBSell
    createdAtTimestamp
    vestingSchedules {
      beneficiary
      amount
      claimed
      voided
    }
  }
}
```

### Top 10 tokens by total BNB buy volume

```graphql
{
  tokens(orderBy: totalVolumeBNBBuy, orderDirection: desc, first: 10) {
    id
    name
    symbol
    tokenType
    totalVolumeBNBBuy
    totalVolumeBNBSell
    buysCount
    sellsCount
    migrated
    creator
  }
}
```

### Top 10 tokens by trade count (most active)

```graphql
{
  tokens(orderBy: buysCount, orderDirection: desc, first: 10) {
    id
    name
    symbol
    tokenType
    buysCount
    sellsCount
    totalVolumeBNBBuy
    raisedBNB
    migrated
  }
}
```

### Activity leaderboard — top traders by trade count

```graphql
# The Graph does not aggregate across entities natively.
# Fetch all trades for a token and aggregate trader counts client-side.
{
  trades(
    where: { token: "0xTOKEN_ADDRESS" }
    orderBy: timestamp
    orderDirection: desc
    first: 1000
  ) {
    trader
    type
    bnbAmount
    tokenAmount
    timestamp
  }
}
```

### Migration pipeline — factory overview

```graphql
{
  factories {
    totalTokensCreated
    totalMigrations
  }
  activeBonding: tokens(where: { migrated: false }, orderBy: raisedBNB, orderDirection: desc, first: 10) {
    id
    name
    symbol
    raisedBNB
    migrationTarget
    buysCount
  }
  recentMigrations: migrations(orderBy: timestamp, orderDirection: desc, first: 5) {
    token { id name symbol }
    pair
    liquidityBNB
    timestamp
  }
}
```

### Governance dashboard — factory config and pending actions

```graphql
{
  factories {
    creationFee
    defaultVirtualBNB
    defaultMigrationTarget
    owner
    timelockActions(where: { executed: false, cancelled: false }) {
      id
      executeAfter
      queuedAtTimestamp
      queuedTxHash
    }
  }
}
```

---

## Pagination

The Graph uses `first` (page size) and `skip` (offset) for pagination, or cursor-based pagination via `id_gt` / `timestamp_gt` filters (preferred for large datasets).

### Offset-based (simple, avoid for > 5 000 results)

```graphql
# Page 1
{
  trades(orderBy: timestamp, orderDirection: desc, first: 50, skip: 0) {
    id type trader bnbAmount timestamp
  }
}

# Page 2
{
  trades(orderBy: timestamp, orderDirection: desc, first: 50, skip: 50) {
    id type trader bnbAmount timestamp
  }
}
```

### Cursor-based (scalable — use for large result sets)

Use the last returned `id` or `timestamp` as the cursor for the next page.

```graphql
# First page
{
  trades(orderBy: timestamp, orderDirection: desc, first: 50) {
    id
    type
    trader
    bnbAmount
    timestamp
  }
}

# Next page — pass the timestamp of the last result as the cursor
{
  trades(
    where: { timestamp_lt: "LAST_TIMESTAMP" }
    orderBy: timestamp
    orderDirection: desc
    first: 50
  ) {
    id
    type
    trader
    bnbAmount
    timestamp
  }
}
```

### Cursor-based pagination for tokens

```graphql
# First page
{
  tokens(orderBy: createdAtTimestamp, orderDirection: desc, first: 20) {
    id name symbol raisedBNB migrated createdAtTimestamp
  }
}

# Next page
{
  tokens(
    where: { createdAtTimestamp_lt: "LAST_TIMESTAMP" }
    orderBy: createdAtTimestamp
    orderDirection: desc
    first: 20
  ) {
    id name symbol raisedBNB migrated createdAtTimestamp
  }
}
```
