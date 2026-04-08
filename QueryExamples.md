# Query Examples

GraphQL query reference for the OneMEME Launchpad subgraph.

---

## Factory

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

### Tokens by creator

```graphql
{
  tokens(
    where: { creator: "0xYOUR_ADDRESS" }
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
    creator
  }
}
```

### Tokens that have migrated

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

### Tokens by type

```graphql
# Replace STANDARD with TAX or REFLECTION as needed
{
  tokens(where: { tokenType: "STANDARD" }, orderBy: createdAtTimestamp, orderDirection: desc) {
    id
    name
    symbol
    raisedBNB
    migrated
    creator
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

### Trades by a specific wallet

```graphql
{
  trades(
    where: { trader: "0xTRADER_ADDRESS" }
    orderBy: timestamp
    orderDirection: desc
  ) {
    type
    token { id name symbol }
    bnbAmount
    tokenAmount
    raisedBNBAfter
    timestamp
    txHash
  }
}
```

### Buys only — sorted by BNB spent

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
    timestamp
  }
}
```

### Trades with antibot penalty (tokensToDead > 0)

```graphql
{
  trades(where: { tokensToDead_gt: "0" }, orderBy: timestamp, orderDirection: desc) {
    token { id name symbol }
    trader
    tokenAmount
    tokensToDead
    timestamp
    txHash
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
    token { id name symbol tokenType }
    pair
    liquidityBNB
    liquidityTokens
    timestamp
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
  }
}
```

### Schedules for a specific beneficiary

```graphql
{
  vestingSchedules(where: { beneficiary: "0xBENEFICIARY_ADDRESS" }) {
    token { id name symbol }
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
    schedule { token { id name symbol } }
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

---

## Governance — Timelock actions

### Pending timelock actions (queued, not yet executed or cancelled)

```graphql
{
  timelockActions(where: { executed: false, cancelled: false }) {
    id
    executeAfter
    queuedAtTimestamp
    queuedTxHash
  }
}
```

### Full timelock history

```graphql
{
  timelockActions(orderBy: queuedAtTimestamp, orderDirection: desc) {
    id
    executed
    cancelled
    executeAfter
    queuedAtTimestamp
    queuedTxHash
  }
}
```

---

## Peripheral — BuyBack *(subgraph.full.yaml only)*

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

### Recent buyback events

```graphql
{
  buyBackEvents(orderBy: timestamp, orderDirection: desc, first: 20) {
    buyback { id buyToken }
    bnbSpent
    balanceBefore
    timestamp
    txHash
  }
}
```

---

## Peripheral — Collector *(subgraph.full.yaml only)*

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

### Disperse history

```graphql
{
  disperseEvents(orderBy: timestamp, orderDirection: desc) {
    collector { id }
    total
    timestamp
    txHash
  }
}
```

---

## Peripheral — Vault *(subgraph.full.yaml only)*

### All proposals — newest first

```graphql
{
  vaultProposals(orderBy: createdAtTimestamp, orderDirection: desc) {
    id
    vault { id }
    proposalId
    to
    value
    proposer
    confirmCount
    executed
    cancelled
    createdAtTimestamp
    txHash
  }
}
```

### Proposals awaiting execution (threshold met, not yet executed)

```graphql
{
  vaultProposals(
    where: { executed: false, cancelled: false, confirmCount_gte: 2 }
  ) {
    proposalId
    to
    value
    data
    proposer
    confirmCount
    createdAtTimestamp
  }
}
```

### Executed proposals

```graphql
{
  vaultProposals(where: { executed: true }, orderBy: createdAtTimestamp, orderDirection: desc) {
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

---

## Combined queries

### Token with its full trade and vesting history

```graphql
{
  token(id: "0xTOKEN_ADDRESS") {
    name
    symbol
    tokenType
    creator
    raisedBNB
    migrated
    pair
    trades(orderBy: timestamp, orderDirection: desc, first: 50) {
      type
      trader
      bnbAmount
      tokenAmount
      tokensToDead
      timestamp
    }
    vestingSchedules {
      beneficiary
      amount
      claimed
      voided
    }
    migrations {
      pair
      liquidityBNB
      liquidityTokens
      timestamp
    }
  }
}
```

### Creator portfolio — tokens with trade volume

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
    migrated
    buysCount
    sellsCount
    totalVolumeBNBBuy
    totalVolumeBNBSell
    createdAtTimestamp
  }
}
```

### Factory stats with pending governance actions

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
    pendingTimelocks(where: { executed: false, cancelled: false }) {
      id
      executeAfter
    }
  }
}
```
