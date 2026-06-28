# Query Examples

GraphQL reference for the OneMEME Launchpad subgraph.  
All fields match [`schema.graphql`](schema.graphql).  
Replace placeholder addresses (`0xTOKEN`, `0xWALLET`, etc.) with real checksummed hex.

**Units:** BNB and token amounts are stored in **wei** — divide by `1e18` to get human-readable values.  
**Prices** (`openPrice`, `closePrice`, etc.) are spot prices scaled ×1e18: `(virtualBNB + raisedBNB) × 1e18 / bcTokensPool`.

---

## Table of Contents

1. [Factory](#1-factory)
2. [Tokens](#2-tokens)
3. [Trades](#3-trades)
4. [Migrations](#4-migrations)
5. [Vesting](#5-vesting)
6. [Creator Vault Positions](#6-creator-vault-positions)
6b. [Creator Vault Config](#6b-creator-vault-config)
7. [Governance — Timelock](#7-governance--timelock)
8. [Token Snapshots (OHLCV)](#8-token-snapshots-ohlcv)
9. [Trending — Period Stats](#9-trending--period-stats)
10. [Holders](#10-holders)
11. [OneCoinLocker](#11-onecoinlocker)
12. [Spark Launcher](#12-spark-launcher)
13. [Spark Tokens](#13-spark-tokens)
14. [Spark Trades](#14-spark-trades)
15. [Spark Fee Claims](#15-spark-fee-claims)
16. [Spark Holders](#16-spark-holders)
17. [Pagination](#17-pagination)
18. [Launchpad Charts](#18-launchpad-charts)

---

## 1. Factory

The `Factory` entity is a singleton — there is always exactly one. Its `id` is the fixed string `"factory"` encoded as bytes.

### Global stats and config

```graphql
{
  factories {
    totalTokensCreated
    totalStandardTokens
    totalTaxTokens
    totalReflectionTokens
    totalUnknownTokens
    totalBuys
    totalSells
    totalMigrations
    creationFee
    platformFeeBps
    charityFeeBps
    feeRecipient
    charityWallet
    router
    creatorVault
    owner
    pendingOwner
    minCurveBps
    minLiquidityBps
    maxCreatorBps
    minSupply
    maxSupply
    latestImplType
    latestImpl
  }
}
```

**Example response:**

```json
{
  "data": {
    "factories": [
      {
        "totalTokensCreated": "142",
        "totalStandardTokens": "89",
        "totalTaxTokens": "31",
        "totalReflectionTokens": "18",
        "totalUnknownTokens": "4",
        "totalBuys": "9871",
        "totalSells": "3204",
        "totalMigrations": "11",
        "creationFee": "100000000000000000",
        "platformFeeBps": "300",
        "charityFeeBps": "100",
        "feeRecipient": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "charityWallet": "0xaaabbbcccdddeeefffaaabbbcccdddeeefffaaab",
        "router": "0x10ed43c718714eb63d5aa57b78b54704e256024e",
        "creatorVault": "0x761697743314ce7233b5f826afefda50a13319f2",
        "owner": "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        "pendingOwner": null,
        "minCurveBps": "5000",
        "minLiquidityBps": "2000",
        "maxCreatorBps": "500",
        "minSupply": "100000000000000000000000000",
        "maxSupply": "1000000000000000000000000000",
        "latestImplType": "STANDARD",
        "latestImpl": "0xabc1234abc1234abc1234abc1234abc1234abc12"
      }
    ]
  }
}
```

### Factory with pending timelock actions

```graphql
{
  factories {
    totalTokensCreated
    totalBuys
    totalSells
    totalMigrations
    creationFee
    platformFeeBps
    charityFeeBps
    creatorVault
    owner
    pendingOwner
    timelockActions(
      where: { executed: false, cancelled: false }
      orderBy: executeAfter
      orderDirection: asc
    ) {
      id
      executeAfter
      queuedAtTimestamp
      queuedTxHash
    }
  }
}
```

**Example response:**

```json
{
  "data": {
    "factories": [
      {
        "totalTokensCreated": "142",
        "totalBuys": "9871",
        "totalSells": "3204",
        "totalMigrations": "11",
        "creationFee": "100000000000000000",
        "platformFeeBps": "300",
        "charityFeeBps": "100",
        "creatorVault": "0x761697743314ce7233b5f826afefda50a13319f2",
        "owner": "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        "pendingOwner": null,
        "timelockActions": [
          {
            "id": "0x1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d",
            "executeAfter": "1700172800",
            "queuedAtTimestamp": "1700086400",
            "queuedTxHash": "0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"
          }
        ]
      }
    ]
  }
}
```

---

## 2. Tokens

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
    lastKnownPrice
    createdAtTimestamp
  }
}
```

**Example response:**

```json
{
  "data": {
    "tokens": [
      {
        "id": "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        "name": "PepeMoon",
        "symbol": "PPEM",
        "tokenType": "STANDARD",
        "creator": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "totalSupply": "1000000000000000000000000000",
        "raisedBNB": "5200000000000000000",
        "migrationTarget": "20000000000000000000",
        "migrated": false,
        "buysCount": "84",
        "sellsCount": "21",
        "lastKnownPrice": "1086000000000000",
        "createdAtTimestamp": "1700086400"
      },
      {
        "id": "0x9988776655443322998877665544332299887766",
        "name": "DogeKing",
        "symbol": "DGKG",
        "tokenType": "TAX",
        "creator": "0xaaabbbcccdddeeefffaaabbbcccdddeeefffaaab",
        "totalSupply": "1000000000000000000000000000",
        "raisedBNB": "1800000000000000000",
        "migrationTarget": "20000000000000000000",
        "migrated": false,
        "buysCount": "33",
        "sellsCount": "7",
        "lastKnownPrice": "210000000000000",
        "createdAtTimestamp": "1700000000"
      }
    ]
  }
}
```

### Single token — full detail

```graphql
{
  token(id: "0xTOKEN") {
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
    bcTokensPool
    lastKnownPrice
    migrated
    pair
    migrationBNB
    migrationLiquidityTokens
    migratedAtTimestamp
    migratedAtBlockNumber
    migrationFailed
    emergencyMigrated
    emergencyMigrationTo
    emergencyMigrationBnb
    emergencyMigrationTokenAmount
    emergencyMigratedAtTimestamp
    emergencyMigratedAtBlockNumber
    buysCount
    sellsCount
    totalVolumeBNBBuy
    totalVolumeBNBSell
    metaUri
    description
    image
    website
    twitter
    telegram
    createdAtTimestamp
    createdAtBlockNumber
    txHash
  }
}
```

**Example response:**

```json
{
  "data": {
    "token": {
      "id": "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      "name": "PepeMoon",
      "symbol": "PPEM",
      "tokenType": "STANDARD",
      "creator": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
      "totalSupply": "1000000000000000000000000000",
      "virtualBNB": "1000000000000000000",
      "migrationTarget": "20000000000000000000",
      "antibotEnabled": true,
      "tradingBlock": "38120005",
      "raisedBNB": "5200000000000000000",
      "bcTokensPool": "790000000000000000000000000",
      "lastKnownPrice": "1086000000000000",
      "migrated": false,
      "pair": null,
      "migrationBNB": null,
      "migrationLiquidityTokens": null,
      "migratedAtTimestamp": null,
      "migratedAtBlockNumber": null,
      "migrationFailed": false,
      "emergencyMigrated": false,
      "emergencyMigrationTo": null,
      "emergencyMigrationBnb": null,
      "emergencyMigrationTokenAmount": null,
      "emergencyMigratedAtTimestamp": null,
      "emergencyMigratedAtBlockNumber": null,
      "buysCount": "84",
      "sellsCount": "21",
      "totalVolumeBNBBuy": "8400000000000000000",
      "totalVolumeBNBSell": "1050000000000000000",
      "metaUri": "ipfs://QmPepeMoonMetaXYZ",
      "description": "The moon-bound Pepe token on OneMEME.",
      "image": "QmPepeMoonImageXYZ",
      "website": "https://pepemoon.io",
      "twitter": "https://twitter.com/pepemoon",
      "telegram": "https://t.me/pepemoon",
      "createdAtTimestamp": "1700086400",
      "createdAtBlockNumber": "38120000",
      "txHash": "0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"
    }
  }
}
```

### Tokens still on the bonding curve — sorted by progress

```graphql
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
    tokenType
    raisedBNB
    migrationTarget
    lastKnownPrice
    buysCount
    sellsCount
    creator
    createdAtTimestamp
  }
}
```

**Example response:**

```json
{
  "data": {
    "tokens": [
      {
        "id": "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        "name": "PepeMoon",
        "symbol": "PPEM",
        "tokenType": "STANDARD",
        "raisedBNB": "17500000000000000000",
        "migrationTarget": "20000000000000000000",
        "lastKnownPrice": "8700000000000000",
        "buysCount": "210",
        "sellsCount": "47",
        "creator": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "createdAtTimestamp": "1700086400"
      }
    ]
  }
}
```

### Tokens that have migrated to DEX

```graphql
{
  tokens(
    where: { migrated: true }
    orderBy: migratedAtTimestamp
    orderDirection: desc
    first: 20
  ) {
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

**Example response:**

```json
{
  "data": {
    "tokens": [
      {
        "id": "0x1122334455667788112233445566778811223344",
        "name": "ShibaRocket",
        "symbol": "SHRKT",
        "tokenType": "STANDARD",
        "pair": "0xcafe1234cafe1234cafe1234cafe1234cafe1234",
        "migrationBNB": "20000000000000000000",
        "migrationLiquidityTokens": "500000000000000000000000000",
        "migratedAtTimestamp": "1699950000",
        "totalVolumeBNBBuy": "32000000000000000000",
        "totalVolumeBNBSell": "8500000000000000000",
        "buysCount": "312",
        "sellsCount": "97"
      }
    ]
  }
}
```

### Tokens by creator

```graphql
{
  tokens(
    where: { creator: "0xWALLET" }
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

### Tokens by type

```graphql
# tokenType: STANDARD | TAX | REFLECTION | UNKNOWN
{
  tokens(
    where: { tokenType: "TAX" }
    orderBy: createdAtTimestamp
    orderDirection: desc
    first: 50
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

### Tokens with antibot enabled

```graphql
{
  tokens(
    where: { antibotEnabled: true, migrated: false }
    orderBy: createdAtTimestamp
    orderDirection: desc
  ) {
    id
    name
    symbol
    tradingBlock
    createdAtBlockNumber
    raisedBNB
  }
}
```

### Tokens with IPFS metadata resolved

```graphql
{
  tokens(
    where: { website_not: null }
    orderBy: createdAtTimestamp
    orderDirection: desc
    first: 50
  ) {
    id
    name
    symbol
    metaUri
    description
    image
    website
    twitter
    telegram
    raisedBNB
    migrated
  }
}
```

### Fresh launches — no trades yet

```graphql
{
  tokens(
    where: { buysCount: 0, migrated: false }
    orderBy: createdAtTimestamp
    orderDirection: desc
    first: 20
  ) {
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

### Tokens created within a time range

```graphql
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

## 3. Trades

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

**Example response:**

```json
{
  "data": {
    "trades": [
      {
        "id": "0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd12340000",
        "token": {
          "id": "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
          "name": "PepeMoon",
          "symbol": "PPEM"
        },
        "trader": "0xccddee001122ccddee001122ccddee001122ccdd",
        "type": "BUY",
        "bnbAmount": "200000000000000000",
        "tokenAmount": "4850000000000000000000000",
        "tokensToDead": "0",
        "raisedBNBAfter": "5200000000000000000",
        "timestamp": "1700086500",
        "blockNumber": "38120050",
        "txHash": "0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"
      },
      {
        "id": "0xbeef5678beef5678beef5678beef5678beef5678beef5678beef5678beef56780001",
        "token": {
          "id": "0x9988776655443322998877665544332299887766",
          "name": "DogeKing",
          "symbol": "DGKG"
        },
        "trader": "0x1234567890abcdef1234567890abcdef12345678",
        "type": "SELL",
        "bnbAmount": "150000000000000000",
        "tokenAmount": "3600000000000000000000000",
        "tokensToDead": "0",
        "raisedBNBAfter": "1650000000000000000",
        "timestamp": "1700086450",
        "blockNumber": "38120040",
        "txHash": "0xbeef5678beef5678beef5678beef5678beef5678beef5678beef5678beef5678"
      }
    ]
  }
}
```

### Trades on a specific token

```graphql
{
  trades(
    where: { token: "0xTOKEN" }
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
    where: { trader: "0xWALLET" }
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

### Largest buys — whale filter

```graphql
# 500000000000000000 = 0.5 BNB in wei
{
  trades(
    where: { type: "BUY", bnbAmount_gt: "500000000000000000" }
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

**Example response:**

```json
{
  "data": {
    "trades": [
      {
        "token": {
          "id": "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
          "name": "PepeMoon",
          "symbol": "PPEM"
        },
        "trader": "0xccddee001122ccddee001122ccddee001122ccdd",
        "bnbAmount": "2000000000000000000",
        "tokenAmount": "47000000000000000000000000",
        "raisedBNBAfter": "12000000000000000000",
        "timestamp": "1700083200",
        "txHash": "0xface1234face1234face1234face1234face1234face1234face1234face1234"
      }
    ]
  }
}
```

### Buys on a specific token above a threshold

```graphql
{
  trades(
    where: {
      token: "0xTOKEN"
      type: "BUY"
      bnbAmount_gt: "100000000000000000"
    }
    orderBy: bnbAmount
    orderDirection: desc
  ) {
    trader
    bnbAmount
    tokenAmount
    timestamp
    txHash
  }
}
```

### Trades with antibot penalty (tokensToDead > 0)

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

## 4. Migrations

### All migrations — newest first

```graphql
{
  migrations(orderBy: timestamp, orderDirection: desc, first: 20) {
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

**Example response:**

```json
{
  "data": {
    "migrations": [
      {
        "id": "0xmigr1234migr1234migr1234migr1234migr1234migr1234migr1234migr12340000",
        "token": {
          "id": "0x1122334455667788112233445566778811223344",
          "name": "ShibaRocket",
          "symbol": "SHRKT",
          "tokenType": "STANDARD",
          "creator": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4"
        },
        "pair": "0xcafe1234cafe1234cafe1234cafe1234cafe1234",
        "liquidityBNB": "20000000000000000000",
        "liquidityTokens": "500000000000000000000000000",
        "timestamp": "1699950000",
        "blockNumber": "38100000",
        "txHash": "0xdead5678dead5678dead5678dead5678dead5678dead5678dead5678dead5678"
      }
    ]
  }
}
```

### Migration for a specific token

```graphql
{
  migrations(where: { token: "0xTOKEN" }) {
    pair
    liquidityBNB
    liquidityTokens
    timestamp
    blockNumber
    txHash
  }
}
```

### Migrations sorted by liquidity added

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

### Tokens where migration failed (reverted, back on curve)

```graphql
{
  tokens(where: { migrationFailed: true }) {
    id
    name
    symbol
    raisedBNB
    migrationTarget
    createdAtTimestamp
  }
}
```

### Tokens that were emergency-migrated

Emergency migration fires when an admin forcefully moves a stuck LP position and returns tokens/BNB to a recipient.

```graphql
{
  tokens(where: { emergencyMigrated: true }) {
    id
    name
    symbol
    emergencyMigrationTo
    emergencyMigrationBnb
    emergencyMigrationTokenAmount
    emergencyMigratedAtTimestamp
    emergencyMigratedAtBlockNumber
  }
}
```

---

## 5. Vesting

Creator vesting schedules are created in CreatorVault when a token migrates. One schedule exists per (token, beneficiary) pair.

### All active vesting schedules

```graphql
{
  vestingSchedules(
    where: { voided: false }
    orderBy: createdAtTimestamp
    orderDirection: desc
  ) {
    id
    token { id name symbol }
    beneficiary
    amount
    duration
    claimed
    createdAtTimestamp
    txHash
  }
}
```

**Example response:**

```json
{
  "data": {
    "vestingSchedules": [
      {
        "id": "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2f1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "token": {
          "id": "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
          "name": "PepeMoon",
          "symbol": "PPEM"
        },
        "beneficiary": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "amount": "50000000000000000000000000",
        "duration": "15552000",
        "claimed": "10000000000000000000000000",
        "createdAtTimestamp": "1700086400",
        "txHash": "0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"
      }
    ]
  }
}
```

### Schedules for a specific beneficiary

```graphql
{
  vestingSchedules(where: { beneficiary: "0xWALLET" }) {
    token { id name symbol tokenType }
    amount
    duration
    claimed
    voided
    burnedOnVoid
    voidedTxHash
    createdAtTimestamp
    txHash
  }
}
```

### Schedules for a specific token

```graphql
{
  vestingSchedules(where: { token: "0xTOKEN" }) {
    beneficiary
    amount
    duration
    claimed
    voided
    burnedOnVoid
    createdAtTimestamp
  }
}
```

### Voided schedules

```graphql
{
  vestingSchedules(
    where: { voided: true }
    orderBy: createdAtTimestamp
    orderDirection: desc
  ) {
    token { id name symbol }
    beneficiary
    amount
    claimed
    burnedOnVoid
    voidedTxHash
    createdAtTimestamp
  }
}
```

**Example response:**

```json
{
  "data": {
    "vestingSchedules": [
      {
        "token": {
          "id": "0x9988776655443322998877665544332299887766",
          "name": "DogeKing",
          "symbol": "DGKG"
        },
        "beneficiary": "0xaaabbbcccdddeeefffaaabbbcccdddeeefffaaab",
        "amount": "30000000000000000000000000",
        "claimed": "5000000000000000000000000",
        "burnedOnVoid": "25000000000000000000000000",
        "voidedTxHash": "0xvoid1234void1234void1234void1234void1234void1234void1234void1234",
        "createdAtTimestamp": "1700000000"
      }
    ]
  }
}
```

### Claim history for a beneficiary

```graphql
{
  vestingClaims(
    where: { schedule_: { beneficiary: "0xWALLET" } }
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

**Example response:**

```json
{
  "data": {
    "vestingClaims": [
      {
        "schedule": {
          "token": {
            "id": "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
            "name": "PepeMoon",
            "symbol": "PPEM"
          },
          "amount": "50000000000000000000000000",
          "claimed": "10000000000000000000000000"
        },
        "amount": "10000000000000000000000000",
        "timestamp": "1700200000",
        "blockNumber": "38160000",
        "txHash": "0xclaim123claim123claim123claim123claim123claim123claim123claim123"
      }
    ]
  }
}
```

### All claims on a specific token

```graphql
{
  vestingClaims(
    where: { schedule_: { token: "0xTOKEN" } }
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

---

## 6. Creator Vault Positions

`CreatorVaultPosition` tracks the Uniswap V3 LP NFT locked in CreatorVault when a `STANDARD` token migrates. The position `id` equals the token contract address — one position per token. `CreatorVaultFeeClaim` records every fee-collection call.

### All positions — newest first

```graphql
{
  creatorVaultPositions(orderBy: registeredAtTimestamp, orderDirection: desc, first: 20) {
    id
    tokenId
    token { id name symbol }
    feeWallet
    pool
    positionManager
    totalCreatorFees0
    totalCreatorFees1
    totalPlatformFees0
    totalPlatformFees1
    totalCharityFees0
    totalCharityFees1
    claimCount
    registeredAtTimestamp
    registeredAtBlockNumber
    registeredTxHash
  }
}
```

**Example response:**

```json
{
  "data": {
    "creatorVaultPositions": [
      {
        "id": "0x1122334455667788112233445566778811223344",
        "tokenId": "88421",
        "token": {
          "id": "0x1122334455667788112233445566778811223344",
          "name": "ShibaRocket",
          "symbol": "SHRKT"
        },
        "feeWallet": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "pool": "0xcafe1234cafe1234cafe1234cafe1234cafe1234",
        "positionManager": "0xc36442b4a4522e871399cd717abdd847ab11fe88",
        "totalCreatorFees0": "120000000000000000",
        "totalCreatorFees1": "240000000000000000",
        "totalPlatformFees0": "42000000000000000",
        "totalPlatformFees1": "84000000000000000",
        "totalCharityFees0": "8400000000000000",
        "totalCharityFees1": "16800000000000000",
        "claimCount": "2",
        "registeredAtTimestamp": "1699950000",
        "registeredAtBlockNumber": "38100000",
        "registeredTxHash": "0xdead5678dead5678dead5678dead5678dead5678dead5678dead5678dead5678"
      }
    ]
  }
}
```

### Position with fee claim history for a specific token

```graphql
{
  creatorVaultPosition(id: "0xTOKEN") {
    tokenId
    feeWallet
    pool
    positionManager
    totalCreatorFees0
    totalCreatorFees1
    totalPlatformFees0
    totalPlatformFees1
    totalCharityFees0
    totalCharityFees1
    claimCount
    registeredAtTimestamp
    feeClaims(orderBy: timestamp, orderDirection: desc, first: 20) {
      id
      feeWallet
      creator0
      creator1
      platform0
      platform1
      charity0
      charity1
      timestamp
      blockNumber
      txHash
    }
  }
}
```

**Example response:**

```json
{
  "data": {
    "creatorVaultPosition": {
      "tokenId": "88421",
      "feeWallet": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
      "pool": "0xcafe1234cafe1234cafe1234cafe1234cafe1234",
      "positionManager": "0xc36442b4a4522e871399cd717abdd847ab11fe88",
      "totalCreatorFees0": "120000000000000000",
      "totalCreatorFees1": "240000000000000000",
      "totalPlatformFees0": "42000000000000000",
      "totalPlatformFees1": "84000000000000000",
      "totalCharityFees0": "8400000000000000",
      "totalCharityFees1": "16800000000000000",
      "claimCount": "2",
      "registeredAtTimestamp": "1699950000",
      "feeClaims": [
        {
          "id": "0xfee1111fee1111fee1111fee1111fee1111fee1111fee1111fee1111fee111100",
          "feeWallet": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
          "creator0": "60000000000000000",
          "creator1": "120000000000000000",
          "platform0": "21000000000000000",
          "platform1": "42000000000000000",
          "charity0": "4200000000000000",
          "charity1": "8400000000000000",
          "timestamp": "1700200000",
          "blockNumber": "38160000",
          "txHash": "0xfee1111fee1111fee1111fee1111fee1111fee1111fee1111fee1111fee1111"
        }
      ]
    }
  }
}
```

### All vault fee claims — newest first

```graphql
{
  creatorVaultFeeClaims(orderBy: timestamp, orderDirection: desc, first: 50) {
    id
    position { id tokenId pool }
    token { id name symbol }
    feeWallet
    creator0
    creator1
    platform0
    platform1
    charity0
    charity1
    timestamp
    blockNumber
    txHash
  }
}
```

---

## 6b. Creator Vault Config

`CreatorVaultState` is a singleton per vault contract address. It tracks the mutable configuration — fee splits, wallets, ownership — updated by admin events.

### Current vault configuration

```graphql
{
  creatorVaultStates {
    id
    owner
    launchManager
    platformWallet
    charityWallet
    creatorBps
    platformBps
    charityBps
  }
}
```

**Example response:**

```json
{
  "data": {
    "creatorVaultStates": [
      {
        "id": "0x761697743314ce7233b5f826afefda50a13319f2",
        "owner": "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        "launchManager": "0x1234567890abcdef1234567890abcdef12345678",
        "platformWallet": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "charityWallet": "0xaaabbbcccdddeeefffaaabbbcccdddeeefffaaab",
        "creatorBps": "7000",
        "platformBps": "2000",
        "charityBps": "1000"
      }
    ]
  }
}
```

---

## 7. Governance — Timelock

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

**Example response:**

```json
{
  "data": {
    "timelockActions": [
      {
        "id": "0x1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d",
        "executeAfter": "1700172800",
        "queuedAtTimestamp": "1700086400",
        "queuedAtBlockNumber": "38120000",
        "queuedTxHash": "0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"
      }
    ]
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
    queuedAtBlockNumber
    queuedTxHash
    executedTxHash
    cancelledTxHash
  }
}
```

**Example response:**

```json
{
  "data": {
    "timelockActions": [
      {
        "id": "0x1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d1a2b3c4d",
        "executed": true,
        "cancelled": false,
        "executeAfter": "1700172800",
        "queuedAtTimestamp": "1700086400",
        "queuedAtBlockNumber": "38120000",
        "queuedTxHash": "0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
        "executedTxHash": "0xexec5678exec5678exec5678exec5678exec5678exec5678exec5678exec5678",
        "cancelledTxHash": null
      },
      {
        "id": "0x5e6f7a8b5e6f7a8b5e6f7a8b5e6f7a8b5e6f7a8b5e6f7a8b5e6f7a8b5e6f7a8b",
        "executed": false,
        "cancelled": true,
        "executeAfter": "1699900000",
        "queuedAtTimestamp": "1699800000",
        "queuedAtBlockNumber": "38000000",
        "queuedTxHash": "0xaaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111",
        "executedTxHash": null,
        "cancelledTxHash": "0xcanc9999canc9999canc9999canc9999canc9999canc9999canc9999canc9999"
      }
    ]
  }
}
```

### Executed actions only

```graphql
{
  timelockActions(
    where: { executed: true }
    orderBy: queuedAtTimestamp
    orderDirection: desc
  ) {
    id
    executeAfter
    queuedAtTimestamp
    queuedTxHash
    executedTxHash
  }
}
```

### Cancelled actions only

```graphql
{
  timelockActions(
    where: { cancelled: true }
    orderBy: queuedAtTimestamp
    orderDirection: desc
  ) {
    id
    executeAfter
    queuedAtTimestamp
    queuedTxHash
    cancelledTxHash
  }
}
```

---

## 8. Token Snapshots (OHLCV)

One `TokenSnapshot` is written per (token, block) each time a trade occurs. Use these for candlestick / TradingView charts while a token is on the bonding curve.

**Price fields** are in wei scaled ×1e18: `(virtualBNB + raisedBNB) × 1e18 / bcTokensPool`.

### Recent snapshots for a token

```graphql
{
  tokenSnapshots(
    where: { token: "0xTOKEN" }
    orderBy: blockNumber
    orderDirection: desc
    first: 100
  ) {
    blockNumber
    timestamp
    openPrice
    highPrice
    lowPrice
    closePrice
    openRaisedBNB
    closeRaisedBNB
    volumeBNB
    buyCount
    sellCount
  }
}
```

**Example response:**

```json
{
  "data": {
    "tokenSnapshots": [
      {
        "blockNumber": "38120080",
        "timestamp": "1700086740",
        "openPrice": "1042000000000000",
        "highPrice": "1086000000000000",
        "lowPrice": "1042000000000000",
        "closePrice": "1086000000000000",
        "openRaisedBNB": "5000000000000000000",
        "closeRaisedBNB": "5200000000000000000",
        "volumeBNB": "200000000000000000",
        "buyCount": 1,
        "sellCount": 0
      },
      {
        "blockNumber": "38120064",
        "timestamp": "1700086692",
        "openPrice": "1000000000000000",
        "highPrice": "1042000000000000",
        "lowPrice": "980000000000000",
        "closePrice": "1042000000000000",
        "openRaisedBNB": "4800000000000000000",
        "closeRaisedBNB": "5000000000000000000",
        "volumeBNB": "350000000000000000",
        "buyCount": 2,
        "sellCount": 1
      }
    ]
  }
}
```

### Snapshots in a block range

```graphql
{
  tokenSnapshots(
    where: {
      token: "0xTOKEN"
      blockNumber_gte: "38120000"
      blockNumber_lte: "38121000"
    }
    orderBy: blockNumber
    orderDirection: asc
    first: 1000
  ) {
    blockNumber
    timestamp
    openPrice
    closePrice
    openRaisedBNB
    closeRaisedBNB
    volumeBNB
    buyCount
    sellCount
  }
}
```

### Snapshots in a time range

```graphql
{
  tokenSnapshots(
    where: {
      token: "0xTOKEN"
      timestamp_gte: "1700000000"
      timestamp_lte: "1701000000"
    }
    orderBy: timestamp
    orderDirection: asc
    first: 1000
  ) {
    blockNumber
    timestamp
    openPrice
    highPrice
    lowPrice
    closePrice
    volumeBNB
    buyCount
    sellCount
  }
}
```

### Highest-volume blocks for a token

```graphql
{
  tokenSnapshots(
    where: { token: "0xTOKEN" }
    orderBy: volumeBNB
    orderDirection: desc
    first: 10
  ) {
    blockNumber
    timestamp
    volumeBNB
    buyCount
    sellCount
    openPrice
    closePrice
  }
}
```

---

## 9. Trending — Period Stats

`TokenPeriodStats` buckets volume and price by time window. Periods: `5m`, `45m`, `1h`, `1d`, `7d`.  
One entity per `(token, period, bucketId)` where `bucketId = floor(timestamp / windowSeconds)`.

### Current 1h candles — top tokens by volume

```graphql
{
  tokenPeriodStats(
    where: { period: "1h" }
    orderBy: volumeBNB
    orderDirection: desc
    first: 20
  ) {
    token { id name symbol }
    periodStart
    buyVolumeBNB
    sellVolumeBNB
    volumeBNB
    buysCount
    sellsCount
    openPrice
    highPrice
    lowPrice
    closePrice
  }
}
```

**Example response:**

```json
{
  "data": {
    "tokenPeriodStats": [
      {
        "token": {
          "id": "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
          "name": "PepeMoon",
          "symbol": "PPEM"
        },
        "periodStart": "1700085600",
        "buyVolumeBNB": "3200000000000000000",
        "sellVolumeBNB": "400000000000000000",
        "volumeBNB": "3600000000000000000",
        "buysCount": "18",
        "sellsCount": "4",
        "openPrice": "1000000000000000",
        "highPrice": "1086000000000000",
        "lowPrice": "995000000000000",
        "closePrice": "1086000000000000"
      }
    ]
  }
}
```

### 5-minute candles for a specific token

```graphql
{
  tokenPeriodStats(
    where: { token: "0xTOKEN", period: "5m" }
    orderBy: periodStart
    orderDirection: desc
    first: 50
  ) {
    periodStart
    bucketId
    buyVolumeBNB
    sellVolumeBNB
    volumeBNB
    buysCount
    sellsCount
    openPrice
    highPrice
    lowPrice
    closePrice
  }
}
```

### 1-day candles for a specific token

```graphql
{
  tokenPeriodStats(
    where: { token: "0xTOKEN", period: "1d" }
    orderBy: periodStart
    orderDirection: desc
    first: 30
  ) {
    periodStart
    buyVolumeBNB
    sellVolumeBNB
    volumeBNB
    buysCount
    sellsCount
    openPrice
    highPrice
    lowPrice
    closePrice
  }
}
```

### Trending tokens — most buys in the current 45-minute window

```graphql
{
  tokenPeriodStats(
    where: { period: "45m" }
    orderBy: buysCount
    orderDirection: desc
    first: 10
  ) {
    token { id name symbol tokenType raisedBNB migrationTarget migrated }
    periodStart
    buysCount
    sellsCount
    volumeBNB
    closePrice
  }
}
```

---

## 10. Holders

Holder balances are tracked via ERC-20 `Transfer` events while a token is on the bonding curve (`migrated = false`). Tracking stops at migration to avoid DEX swap noise.

### Top holders for a token

```graphql
{
  holders(
    where: { token: "0xTOKEN" }
    orderBy: balance
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

**Example response:**

```json
{
  "data": {
    "holders": [
      {
        "address": "0xccddee001122ccddee001122ccddee001122ccdd",
        "balance": "25000000000000000000000000",
        "lastUpdatedBlock": "38120050",
        "lastUpdatedTimestamp": "1700086500"
      },
      {
        "address": "0x1234567890abcdef1234567890abcdef12345678",
        "balance": "12000000000000000000000000",
        "lastUpdatedBlock": "38120030",
        "lastUpdatedTimestamp": "1700086440"
      }
    ]
  }
}
```

### All tokens held by a wallet (bonding-curve phase only)

```graphql
{
  holders(
    where: { address: "0xWALLET", balance_gt: "0" }
    orderBy: balance
    orderDirection: desc
  ) {
    token { id name symbol tokenType raisedBNB migrationTarget }
    balance
    lastUpdatedBlock
    lastUpdatedTimestamp
  }
}
```

### Holder count approximation

```graphql
{
  holders(
    where: { token: "0xTOKEN", balance_gt: "0" }
    orderBy: balance
    orderDirection: desc
    first: 1000
  ) {
    address
    balance
  }
}
```

---

## 11. OneCoinLocker

### Locker contract state

```graphql
{
  lockers {
    id
    totalLocks
    activeLocks
    fee
    totalFeesCollected
  }
}
```

**Example response:**

```json
{
  "data": {
    "lockers": [
      {
        "id": "0x6c6e9740753d9f6c1e5d61c8bc0f34e37590f6c5",
        "totalLocks": "84",
        "activeLocks": "71",
        "fee": "1000000000000000",
        "totalFeesCollected": "12500000000000000"
      }
    ]
  }
}
```

### All locks — newest first

```graphql
{
  locks(orderBy: createdAtTimestamp, orderDirection: desc, first: 20) {
    id
    lockId
    owner
    token
    amount
    withdrawn
    lockDate
    startTime
    endTime
    lockType
    isLP
    description
    renounced
    createdAtTimestamp
    txHash
  }
}
```

**Example response:**

```json
{
  "data": {
    "locks": [
      {
        "id": "0x6c6e9740753d9f6c1e5d61c8bc0f34e37590f6c500000054",
        "lockId": "84",
        "owner": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "token": "0xcafe1234cafe1234cafe1234cafe1234cafe1234",
        "amount": "1000000000000000000000000",
        "withdrawn": "0",
        "lockDate": "1700086400",
        "startTime": "0",
        "endTime": "1731622400",
        "lockType": "Cliff",
        "isLP": true,
        "description": "PepeMoon LP Lock",
        "renounced": false,
        "createdAtTimestamp": "1700086400",
        "txHash": "0xlock1234lock1234lock1234lock1234lock1234lock1234lock1234lock1234"
      }
    ]
  }
}
```

### Locks by owner

```graphql
{
  locks(
    where: { owner: "0xWALLET" }
    orderBy: endTime
    orderDirection: desc
  ) {
    id
    lockId
    token
    amount
    withdrawn
    lockDate
    startTime
    endTime
    lockType
    isLP
    description
    renounced
    createdAtTimestamp
    txHash
  }
}
```

### Locks for a specific token

```graphql
{
  locks(where: { token: "0xTOKEN" }) {
    id
    lockId
    owner
    amount
    withdrawn
    startTime
    endTime
    lockType
    isLP
    renounced
    createdAtTimestamp
  }
}
```

### Active LP locks (not renounced, not fully withdrawn)

```graphql
{
  locks(
    where: { isLP: true, renounced: false }
    orderBy: endTime
    orderDirection: desc
    first: 50
  ) {
    lockId
    owner
    token
    amount
    withdrawn
    endTime
    lockType
    description
    createdAtTimestamp
  }
}
```

### Lock with full withdrawal and transfer history

```graphql
{
  lock(id: "0xLOCKER_ADDR_CONCATTED_LOCKID") {
    lockId
    owner
    token
    amount
    withdrawn
    startTime
    endTime
    lockType
    isLP
    renounced
    description
    createdAtTimestamp
    withdrawals(orderBy: timestamp, orderDirection: desc) {
      owner
      amount
      nativeFee
      timestamp
      txHash
    }
    transfers(orderBy: timestamp, orderDirection: desc) {
      from
      to
      timestamp
      txHash
    }
  }
}
```

### Lock activity timeline

`LockActivity` captures every event that touches a lock as a unified, ordered feed. Use this instead of joining separate `withdrawals` and `transfers` queries when you need the full lifecycle.

Action values: `CREATED` | `EDITED` | `EXTENDED` | `DESCRIPTION_CHANGED` | `WITHDRAWN` | `TRANSFERRED` | `RENOUNCED`

```graphql
{
  lock(id: "0xLOCKER_ADDR_CONCATTED_LOCKID") {
    lockId
    owner
    token
    amount
    activities(orderBy: timestamp, orderDirection: asc) {
      action
      timestamp
      txHash
      newAmount
      newEndTime
      description
      withdrawnAmount
      nativeFee
      from
      to
    }
  }
}
```

**Example response:**

```json
{
  "data": {
    "lock": {
      "lockId": "42",
      "owner": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
      "token": "0xcafe1234cafe1234cafe1234cafe1234cafe1234",
      "amount": "1000000000000000000000000",
      "activities": [
        {
          "action": "CREATED",
          "timestamp": "1700086400",
          "txHash": "0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
          "newAmount": null,
          "newEndTime": null,
          "description": null,
          "withdrawnAmount": null,
          "nativeFee": null,
          "from": null,
          "to": null
        },
        {
          "action": "DESCRIPTION_CHANGED",
          "timestamp": "1700200000",
          "txHash": "0xdesc1234desc1234desc1234desc1234desc1234desc1234desc1234desc1234",
          "newAmount": null,
          "newEndTime": null,
          "description": "Team vesting — updated",
          "withdrawnAmount": null,
          "nativeFee": null,
          "from": null,
          "to": null
        },
        {
          "action": "WITHDRAWN",
          "timestamp": "1700500000",
          "txHash": "0xwith1234with1234with1234with1234with1234with1234with1234with1234",
          "newAmount": null,
          "newEndTime": null,
          "description": null,
          "withdrawnAmount": "200000000000000000000000",
          "nativeFee": "1000000000000000",
          "from": null,
          "to": null
        },
        {
          "action": "TRANSFERRED",
          "timestamp": "1700600000",
          "txHash": "0xtran1234tran1234tran1234tran1234tran1234tran1234tran1234tran1234",
          "newAmount": null,
          "newEndTime": null,
          "description": null,
          "withdrawnAmount": null,
          "nativeFee": null,
          "from": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
          "to": "0xaaabbbcccdddeeefffaaabbbcccdddeeefffaaab"
        }
      ]
    }
  }
}
```

### All lock activities across all locks — newest first

```graphql
{
  lockActivities(orderBy: timestamp, orderDirection: desc, first: 50) {
    action
    timestamp
    txHash
    lock { lockId token owner }
    withdrawnAmount
    nativeFee
    from
    to
    newEndTime
  }
}
```

### Activity for a specific token's locks

```graphql
{
  lockActivities(
    where: { lock_: { token: "0xTOKEN" } }
    orderBy: timestamp
    orderDirection: asc
  ) {
    action
    timestamp
    txHash
    lock { lockId }
    withdrawnAmount
    newEndTime
    from
    to
  }
}
```

**Example response:**

```json
{
  "data": {
    "lock": {
      "lockId": "84",
      "owner": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
      "token": "0xcafe1234cafe1234cafe1234cafe1234cafe1234",
      "amount": "1000000000000000000000000",
      "withdrawn": "200000000000000000000000",
      "startTime": "1700086400",
      "endTime": "1731622400",
      "lockType": "Linear",
      "isLP": false,
      "renounced": false,
      "description": "Team vesting",
      "createdAtTimestamp": "1700086400",
      "withdrawals": [
        {
          "owner": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
          "amount": "200000000000000000000000",
          "nativeFee": "1000000000000000",
          "timestamp": "1700500000",
          "txHash": "0xwith1234with1234with1234with1234with1234with1234with1234with1234"
        }
      ],
      "transfers": []
    }
  }
}
```

### Renounced locks

```graphql
{
  locks(
    where: { renounced: true }
    orderBy: createdAtTimestamp
    orderDirection: desc
  ) {
    lockId
    token
    amount
    endTime
    createdAtTimestamp
    txHash
  }
}
```

---

## 12. Spark Launcher

### Launcher fee state

```graphql
{
  sparkLauncherStates {
    id
    launchFee
    launchFeeWallet
    totalETHRescued
    totalERC20Rescued
  }
}
```

**Example response:**

```json
{
  "data": {
    "sparkLauncherStates": [
      {
        "id": "0xa7305c2bf7669cdd78bc76514a0238cbf2291d70",
        "launchFee": "100000000000000000",
        "launchFeeWallet": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "totalETHRescued": "0",
        "totalERC20Rescued": "0"
      }
    ]
  }
}
```

### Registered DEXes

```graphql
{
  sparkDexes {
    id
    positionManager
    router
    enabled
    addedAtTimestamp
    addedAtBlockNumber
  }
}
```

**Example response:**

```json
{
  "data": {
    "sparkDexes": [
      {
        "id": "0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865",
        "positionManager": "0x7b8a01b39d58278b5de7e48c8449c9f4f5170613",
        "router": "0x1b81d678ffb9c0263b24a97847620c99d213eb14",
        "enabled": true,
        "addedAtTimestamp": "1699950000",
        "addedAtBlockNumber": "38100000"
      }
    ]
  }
}
```

### Enabled quote tokens

```graphql
{
  sparkQuoteTokens(where: { enabled: true }) {
    id
    isNative
    marketCapRef
    wethPairFee
  }
}
```

**Example response:**

```json
{
  "data": {
    "sparkQuoteTokens": [
      {
        "id": "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
        "isNative": true,
        "marketCapRef": "5000000000000000000",
        "wethPairFee": 0
      },
      {
        "id": "0x55d398326f99059ff775485246999027b3197955",
        "isNative": false,
        "marketCapRef": "5000000000000000000",
        "wethPairFee": 500
      }
    ]
  }
}
```

### SparkLocker configuration state

```graphql
{
  sparkLockerStates {
    id
    owner
    launcher
    platformWallet
    charityWallet
    creatorBps
    platformBps
    charityBps
  }
}
```

**Example response:**

```json
{
  "data": {
    "sparkLockerStates": [
      {
        "id": "0x440be9bb601688cfbd088da287d5248d31630293",
        "owner": "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        "launcher": "0xa7305c2bf7669cdd78bc76514a0238cbf2291d70",
        "platformWallet": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "charityWallet": "0xaaabbbcccdddeeefffaaabbbcccdddeeefffaaab",
        "creatorBps": "7000",
        "platformBps": "2500",
        "charityBps": "500"
      }
    ]
  }
}
```

---

## 13. Spark Tokens

### All Spark tokens — newest first

```graphql
{
  sparkLaunchedTokens(orderBy: createdAtTimestamp, orderDirection: desc, first: 20) {
    id
    name
    symbol
    metaURI
    creator
    quoteToken
    pool
    tokenId
    token0
    token1
    tradeCount
    totalVolumeToken
    totalVolumeQuote
    claimCount
    lpWithdrawn
    createdAtTimestamp
    txHash
  }
}
```

**Example response:**

```json
{
  "data": {
    "sparkLaunchedTokens": [
      {
        "id": "0xaabb1234aabb1234aabb1234aabb1234aabb1234",
        "name": "SparkDoge",
        "symbol": "SDOGE",
        "metaURI": "ipfs://QmSparkDogeMetaXYZ",
        "creator": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "quoteToken": "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
        "pool": "0xpool1234pool1234pool1234pool1234pool1234",
        "tokenId": "112233",
        "token0": "0xaabb1234aabb1234aabb1234aabb1234aabb1234",
        "token1": "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
        "tradeCount": "47",
        "totalVolumeToken": "890000000000000000000000000",
        "totalVolumeQuote": "4200000000000000000",
        "claimCount": "1",
        "lpWithdrawn": false,
        "createdAtTimestamp": "1700100000",
        "txHash": "0xspark123spark123spark123spark123spark123spark123spark123spark123"
      }
    ]
  }
}
```

### Single Spark token — full detail with cumulative fees

```graphql
{
  sparkLaunchedToken(id: "0xTOKEN") {
    id
    name
    symbol
    metaURI
    creator
    factory
    positionManager
    quoteToken
    feeWallet
    pool
    token0
    token1
    tokenId
    lpWithdrawn
    totalCreatorFees0
    totalCreatorFees1
    totalPlatformFees0
    totalPlatformFees1
    totalCharityFees0
    totalCharityFees1
    claimCount
    tradeCount
    totalVolumeToken
    totalVolumeQuote
    createdAtTimestamp
    createdAtBlockNumber
    txHash
  }
}
```

### Spark tokens by creator

```graphql
{
  sparkLaunchedTokens(
    where: { creator: "0xWALLET" }
    orderBy: createdAtTimestamp
    orderDirection: desc
  ) {
    id
    name
    symbol
    quoteToken
    pool
    tradeCount
    totalVolumeQuote
    claimCount
    createdAtTimestamp
  }
}
```

### Most-traded Spark tokens

```graphql
{
  sparkLaunchedTokens(orderBy: tradeCount, orderDirection: desc, first: 10) {
    id
    name
    symbol
    tradeCount
    totalVolumeToken
    totalVolumeQuote
    claimCount
    createdAtTimestamp
  }
}
```

### Pool lookup — resolve token from pool address

```graphql
{
  sparkPool(id: "0xPOOL") {
    sparkIsToken0
    token {
      id
      name
      symbol
      creator
      quoteToken
      tradeCount
      totalVolumeQuote
    }
  }
}
```

**Example response:**

```json
{
  "data": {
    "sparkPool": {
      "sparkIsToken0": true,
      "token": {
        "id": "0xaabb1234aabb1234aabb1234aabb1234aabb1234",
        "name": "SparkDoge",
        "symbol": "SDOGE",
        "creator": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "quoteToken": "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
        "tradeCount": "47",
        "totalVolumeQuote": "4200000000000000000"
      }
    }
  }
}
```

---

## 14. Spark Trades

Spark trades are Uniswap V3 pool `Swap` events. `sparkAmount` and `quoteAmount` are absolute (unsigned) values. `isBuy = true` means the Spark token left the pool (user received it).

### Recent Spark trades across all tokens

```graphql
{
  sparkTrades(orderBy: timestamp, orderDirection: desc, first: 50) {
    id
    token { id name symbol }
    pool
    sender
    recipient
    isBuy
    sparkAmount
    quoteAmount
    sqrtPriceX96
    tick
    timestamp
    blockNumber
    txHash
  }
}
```

**Example response:**

```json
{
  "data": {
    "sparkTrades": [
      {
        "id": "0xswap1234swap1234swap1234swap1234swap1234swap1234swap1234swap12340000",
        "token": {
          "id": "0xaabb1234aabb1234aabb1234aabb1234aabb1234",
          "name": "SparkDoge",
          "symbol": "SDOGE"
        },
        "pool": "0xpool1234pool1234pool1234pool1234pool1234",
        "sender": "0xccddee001122ccddee001122ccddee001122ccdd",
        "recipient": "0xccddee001122ccddee001122ccddee001122ccdd",
        "isBuy": true,
        "sparkAmount": "18900000000000000000000000",
        "quoteAmount": "89000000000000000",
        "sqrtPriceX96": "7922816251426433759354395033600",
        "tick": "-92000",
        "timestamp": "1700100100",
        "blockNumber": "38125000",
        "txHash": "0xswap1234swap1234swap1234swap1234swap1234swap1234swap1234swap1234"
      }
    ]
  }
}
```

### Trades on a specific Spark token

```graphql
{
  sparkTrades(
    where: { token: "0xTOKEN" }
    orderBy: timestamp
    orderDirection: desc
    first: 100
  ) {
    isBuy
    sender
    recipient
    sparkAmount
    quoteAmount
    sqrtPriceX96
    tick
    timestamp
    blockNumber
    txHash
  }
}
```

### Buys only on a specific Spark token

```graphql
{
  sparkTrades(
    where: { token: "0xTOKEN", isBuy: true }
    orderBy: quoteAmount
    orderDirection: desc
    first: 20
  ) {
    sender
    recipient
    sparkAmount
    quoteAmount
    timestamp
    txHash
  }
}
```

### Largest Spark trades by quote amount

```graphql
{
  sparkTrades(
    orderBy: quoteAmount
    orderDirection: desc
    first: 20
  ) {
    token { id name symbol }
    isBuy
    sender
    recipient
    sparkAmount
    quoteAmount
    timestamp
    txHash
  }
}
```

### Trades by a specific wallet

```graphql
{
  sparkTrades(
    where: { sender: "0xWALLET" }
    orderBy: timestamp
    orderDirection: desc
  ) {
    token { id name symbol }
    isBuy
    sparkAmount
    quoteAmount
    timestamp
    txHash
  }
}
```

---

## 15. Spark Fee Claims

Fee claims record each time LP swap fees are collected and split between creator, platform, and charity. `token0`/`token1` correspond to the V3 pool's sorted token addresses — check `SparkLaunchedToken.token0` to map amounts to the correct asset.

### All fee claims — newest first

```graphql
{
  sparkFeeClaims(orderBy: timestamp, orderDirection: desc, first: 50) {
    id
    token { id name symbol }
    feeWallet
    creator0
    creator1
    platform0
    platform1
    charity0
    charity1
    timestamp
    blockNumber
    txHash
  }
}
```

**Example response:**

```json
{
  "data": {
    "sparkFeeClaims": [
      {
        "id": "0xfees123fees123fees123fees123fees123fees123fees123fees123fees1230000",
        "token": {
          "id": "0xaabb1234aabb1234aabb1234aabb1234aabb1234",
          "name": "SparkDoge",
          "symbol": "SDOGE"
        },
        "feeWallet": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "creator0": "700000000000000000",
        "creator1": "350000000000000000000000000",
        "platform0": "250000000000000000",
        "platform1": "125000000000000000000000000",
        "charity0": "50000000000000000",
        "charity1": "25000000000000000000000000",
        "timestamp": "1700200000",
        "blockNumber": "38160000",
        "txHash": "0xfees123fees123fees123fees123fees123fees123fees123fees123fees123"
      }
    ]
  }
}
```

### Fee claims for a specific Spark token

```graphql
{
  sparkFeeClaims(
    where: { token: "0xTOKEN" }
    orderBy: timestamp
    orderDirection: desc
  ) {
    feeWallet
    creator0
    creator1
    platform0
    platform1
    charity0
    charity1
    timestamp
    txHash
  }
}
```

### Fee claims for a specific fee wallet

```graphql
{
  sparkFeeClaims(
    where: { feeWallet: "0xWALLET" }
    orderBy: timestamp
    orderDirection: desc
    first: 50
  ) {
    token { id name symbol }
    creator0
    creator1
    platform0
    platform1
    charity0
    charity1
    timestamp
    txHash
  }
}
```

---

## 16. Spark Holders

Spark holder balances are tracked via ERC-20 `Transfer` events. Unlike bonding-curve holders, tracking continues indefinitely after the token is launched.

### Top holders for a Spark token

```graphql
{
  sparkHolders(
    where: { token: "0xTOKEN" }
    orderBy: balance
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

**Example response:**

```json
{
  "data": {
    "sparkHolders": [
      {
        "address": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "balance": "120000000000000000000000000",
        "lastUpdatedBlock": "38125000",
        "lastUpdatedTimestamp": "1700100100"
      },
      {
        "address": "0xccddee001122ccddee001122ccddee001122ccdd",
        "balance": "48000000000000000000000000",
        "lastUpdatedBlock": "38124900",
        "lastUpdatedTimestamp": "1700099800"
      }
    ]
  }
}
```

### All Spark tokens held by a wallet

```graphql
{
  sparkHolders(
    where: { address: "0xWALLET", balance_gt: "0" }
    orderBy: balance
    orderDirection: desc
  ) {
    token { id name symbol quoteToken totalVolumeQuote }
    balance
    lastUpdatedBlock
    lastUpdatedTimestamp
  }
}
```

---

## 17. Pagination

The Graph limits responses to **1,000 entities per query**. For larger datasets use `id_gt` cursor-based pagination.

### Paginating tokens

```graphql
# Page 1
{
  tokens(orderBy: id, orderDirection: asc, first: 1000) {
    id
    name
    symbol
    raisedBNB
    migrated
    createdAtTimestamp
  }
}
```

```graphql
# Page 2 — pass the last id from the previous page
{
  tokens(
    orderBy: id
    orderDirection: asc
    first: 1000
    where: { id_gt: "0xLAST_ID_FROM_PREVIOUS_PAGE" }
  ) {
    id
    name
    symbol
    raisedBNB
    migrated
    createdAtTimestamp
  }
}
```

### Paginating trades

```graphql
# Page 1
{
  trades(orderBy: id, orderDirection: asc, first: 1000) {
    id
    token { id }
    type
    trader
    bnbAmount
    timestamp
  }
}
```

```graphql
# Page 2
{
  trades(
    orderBy: id
    orderDirection: asc
    first: 1000
    where: { id_gt: "0xLAST_ID_FROM_PREVIOUS_PAGE" }
  ) {
    id
    token { id }
    type
    trader
    bnbAmount
    timestamp
  }
}
```

### Paginating Spark trades on a specific token

```graphql
{
  sparkTrades(
    where: { token: "0xTOKEN", id_gt: "0xLAST_ID" }
    orderBy: id
    orderDirection: asc
    first: 1000
  ) {
    id
    isBuy
    sparkAmount
    quoteAmount
    timestamp
  }
}
```

---

## 18. Launchpad Charts

These queries are designed for building frontend charts for bonding-curve tokens.  
All price values are in wei ×1e18 — divide by `1e18` client-side before rendering.

**Guaranteed data from launch:** Every token has its launch-price candle seeded into all five `TokenPeriodStats` windows at creation time, so charts always return at least one data point — even for brand-new tokens with zero trades.

**Client-side gap filling:** The subgraph only stores buckets where activity exists. For empty time windows between trades, carry the previous bucket's `closePrice` forward as `open = high = low = close` with `volumeBNB = 0`. Do this client-side; the subgraph does not store zero-volume phantom buckets.

---

### 18.1 Time-Weighted OHLCV — primary chart source

`TokenPeriodStats` is the primary chart entity. Buckets are fixed-width time windows so prices are naturally time-weighted across the activity in each window. The open price of every bucket is inherited from the price at the start of that window (or from the token's launch price for the very first bucket).

Available periods: `5m`, `45m`, `1h`, `1d`, `7d`.

**5-minute candles (last 100 buckets):**

```graphql
{
  tokenPeriodStats(
    where: { token: "0xTOKEN", period: "5m" }
    orderBy: periodStart
    orderDirection: desc
    first: 100
  ) {
    periodStart
    bucketId
    openPrice
    highPrice
    lowPrice
    closePrice
    buyVolumeBNB
    sellVolumeBNB
    volumeBNB
    buysCount
    sellsCount
  }
}
```

**1-hour candles (last 72 hours):**

```graphql
{
  tokenPeriodStats(
    where: { token: "0xTOKEN", period: "1h" }
    orderBy: periodStart
    orderDirection: desc
    first: 72
  ) {
    periodStart
    openPrice
    highPrice
    lowPrice
    closePrice
    buyVolumeBNB
    sellVolumeBNB
    volumeBNB
    buysCount
    sellsCount
  }
}
```

**1-day candles (last 30 days):**

```graphql
{
  tokenPeriodStats(
    where: { token: "0xTOKEN", period: "1d" }
    orderBy: periodStart
    orderDirection: desc
    first: 30
  ) {
    periodStart
    openPrice
    highPrice
    lowPrice
    closePrice
    buyVolumeBNB
    sellVolumeBNB
    volumeBNB
    buysCount
    sellsCount
  }
}
```

**Example response (1h candles):**

```json
{
  "data": {
    "tokenPeriodStats": [
      {
        "periodStart": "1700085600",
        "openPrice": "1000000000000000",
        "highPrice": "1350000000000000",
        "lowPrice": "980000000000000",
        "closePrice": "1320000000000000",
        "buyVolumeBNB": "4200000000000000000",
        "sellVolumeBNB": "800000000000000000",
        "volumeBNB": "5000000000000000000",
        "buysCount": "31",
        "sellsCount": "8"
      },
      {
        "periodStart": "1700082000",
        "openPrice": "800000000000000",
        "highPrice": "1020000000000000",
        "lowPrice": "790000000000000",
        "closePrice": "1000000000000000",
        "buyVolumeBNB": "2100000000000000000",
        "sellVolumeBNB": "300000000000000000",
        "volumeBNB": "2400000000000000000",
        "buysCount": "15",
        "sellsCount": "3"
      }
    ]
  }
}
```

**Querying the launch candle for a token with no trades:**

Every token has its launch-price bucket seeded at creation, so this query always returns at least one result:

```graphql
{
  tokenPeriodStats(
    where: { token: "0xTOKEN", period: "1h" }
    orderBy: periodStart
    orderDirection: asc
    first: 1
  ) {
    periodStart
    openPrice
    highPrice
    lowPrice
    closePrice
    volumeBNB
    buysCount
    sellsCount
  }
}
```

**Example response (token just created, zero trades):**

```json
{
  "data": {
    "tokenPeriodStats": [
      {
        "periodStart": "1700085600",
        "openPrice": "52631578947368",
        "highPrice": "52631578947368",
        "lowPrice": "52631578947368",
        "closePrice": "52631578947368",
        "volumeBNB": "0",
        "buysCount": "0",
        "sellsCount": "0"
      }
    ]
  }
}
```

`openPrice = highPrice = lowPrice = closePrice = launchPrice` with zero volume — this is the seed candle written when the token was created.

---

### 18.2 Per-Block Snapshots — secondary chart source

`TokenSnapshot` records one data point per block that contains at least one trade, plus a genesis snapshot at the token's creation block. Use this for maximum price resolution on active tokens; use `TokenPeriodStats` (18.1) for tokens with sparse trading or when a fixed-interval chart axis is required.

**Recent snapshots (most recent first):**

```graphql
{
  tokenSnapshots(
    where: { token: "0xTOKEN" }
    orderBy: blockNumber
    orderDirection: desc
    first: 500
  ) {
    blockNumber
    timestamp
    openPrice
    highPrice
    lowPrice
    closePrice
    openRaisedBNB
    closeRaisedBNB
    volumeBNB
    buyCount
    sellCount
  }
}
```

**Forward pagination from a known block:**

```graphql
{
  tokenSnapshots(
    where: {
      token: "0xTOKEN"
      blockNumber_gt: "38120000"
    }
    orderBy: blockNumber
    orderDirection: asc
    first: 1000
  ) {
    blockNumber
    timestamp
    openPrice
    highPrice
    lowPrice
    closePrice
    openRaisedBNB
    closeRaisedBNB
    volumeBNB
    buyCount
    sellCount
  }
}
```

**Example response (genesis snapshot — no trades yet):**

```json
{
  "data": {
    "tokenSnapshots": [
      {
        "blockNumber": "38120000",
        "timestamp": "1700086400",
        "openPrice": "52631578947368",
        "highPrice": "52631578947368",
        "lowPrice": "52631578947368",
        "closePrice": "52631578947368",
        "openRaisedBNB": "0",
        "closeRaisedBNB": "0",
        "volumeBNB": "0",
        "buyCount": 0,
        "sellCount": 0
      }
    ]
  }
}
```

---

### 18.3 Volume Bar Chart

**Hourly volume (buys vs sells separately):**

```graphql
{
  tokenPeriodStats(
    where: { token: "0xTOKEN", period: "1h" }
    orderBy: periodStart
    orderDirection: desc
    first: 48
  ) {
    periodStart
    buyVolumeBNB
    sellVolumeBNB
    volumeBNB
    buysCount
    sellsCount
  }
}
```

**Daily volume across all tokens (platform-wide):**

```graphql
{
  tokenPeriodStats(
    where: { period: "1d" }
    orderBy: volumeBNB
    orderDirection: desc
    first: 50
  ) {
    token { id name symbol }
    periodStart
    buyVolumeBNB
    sellVolumeBNB
    volumeBNB
    buysCount
    sellsCount
  }
}
```

**Example response:**

```json
{
  "data": {
    "tokenPeriodStats": [
      {
        "token": {
          "id": "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
          "name": "PepeMoon",
          "symbol": "PPEM"
        },
        "periodStart": "1700006400",
        "buyVolumeBNB": "18000000000000000000",
        "sellVolumeBNB": "3200000000000000000",
        "volumeBNB": "21200000000000000000",
        "buysCount": "142",
        "sellsCount": "37"
      }
    ]
  }
}
```

---

### 18.4 Bonding Curve Progress Chart

Track `raisedBNB` over time. Each `TokenSnapshot` records `openRaisedBNB` and `closeRaisedBNB` so you can plot the curve fill level per block.

**Pool depth over time:**

```graphql
{
  tokenSnapshots(
    where: { token: "0xTOKEN" }
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

**Current progress snapshot (single query):**

```graphql
{
  token(id: "0xTOKEN") {
    raisedBNB
    migrationTarget
    bcTokensPool
    totalSupply
    lastKnownPrice
    buysCount
    sellsCount
    totalVolumeBNBBuy
    totalVolumeBNBSell
    migrated
  }
}
```

**Example response:**

```json
{
  "data": {
    "token": {
      "raisedBNB": "17500000000000000000",
      "migrationTarget": "20000000000000000000",
      "bcTokensPool": "270000000000000000000000000",
      "totalSupply": "1000000000000000000000000000",
      "lastKnownPrice": "8700000000000000",
      "buysCount": "210",
      "sellsCount": "47",
      "totalVolumeBNBBuy": "24000000000000000000",
      "totalVolumeBNBSell": "4800000000000000000",
      "migrated": false
    }
  }
}
```

Client-side progress percentage:
```
progress = (raisedBNB / migrationTarget) * 100
         = (17.5 / 20.0) * 100 = 87.5%
```

---

### 18.5 Trade Activity Timeline

Plot buy/sell counts and BNB amounts over time to show trade velocity.

**Recent trades with buy/sell breakdown:**

```graphql
{
  trades(
    where: { token: "0xTOKEN" }
    orderBy: timestamp
    orderDirection: desc
    first: 200
  ) {
    type
    trader
    bnbAmount
    tokenAmount
    tokensToDead
    raisedBNBAfter
    timestamp
    blockNumber
  }
}
```

**Example response:**

```json
{
  "data": {
    "trades": [
      {
        "type": "BUY",
        "trader": "0xccddee001122ccddee001122ccddee001122ccdd",
        "bnbAmount": "500000000000000000",
        "tokenAmount": "4200000000000000000000000",
        "tokensToDead": "0",
        "raisedBNBAfter": "17500000000000000000",
        "timestamp": "1700090000",
        "blockNumber": "38121000"
      },
      {
        "type": "SELL",
        "trader": "0x1234567890abcdef1234567890abcdef12345678",
        "bnbAmount": "120000000000000000",
        "tokenAmount": "900000000000000000000000",
        "tokensToDead": "0",
        "raisedBNBAfter": "17000000000000000000",
        "timestamp": "1700089500",
        "blockNumber": "38120900"
      }
    ]
  }
}
```

**Buy pressure ratio (buys vs sells) using period stats:**

```graphql
{
  tokenPeriodStats(
    where: { token: "0xTOKEN", period: "1h" }
    orderBy: periodStart
    orderDirection: desc
    first: 24
  ) {
    periodStart
    buysCount
    sellsCount
    buyVolumeBNB
    sellVolumeBNB
  }
}
```

Client-side buy pressure ratio:
```
buyPressure = buyVolumeBNB / (buyVolumeBNB + sellVolumeBNB)
            > 0.5 = net buying, < 0.5 = net selling
```

---

### 18.6 Holder Growth Chart

Track unique holders over time via the `Holder` entity. Holder records are updated on every `Transfer` while `migrated = false`.

**Current top-20 holders with balance:**

```graphql
{
  holders(
    where: { token: "0xTOKEN", balance_gt: "0" }
    orderBy: balance
    orderDirection: desc
    first: 20
  ) {
    address
    balance
    lastUpdatedBlock
    lastUpdatedTimestamp
  }
}
```

**Holders updated after a specific block (new holders since snapshot):**

```graphql
{
  holders(
    where: {
      token: "0xTOKEN"
      lastUpdatedBlock_gt: "38120000"
      balance_gt: "0"
    }
    orderBy: lastUpdatedBlock
    orderDirection: asc
    first: 500
  ) {
    address
    balance
    lastUpdatedBlock
    lastUpdatedTimestamp
  }
}
```

**Example response:**

```json
{
  "data": {
    "holders": [
      {
        "address": "0xccddee001122ccddee001122ccddee001122ccdd",
        "balance": "25000000000000000000000000",
        "lastUpdatedBlock": "38121000",
        "lastUpdatedTimestamp": "1700090000"
      },
      {
        "address": "0x1234567890abcdef1234567890abcdef12345678",
        "balance": "12000000000000000000000000",
        "lastUpdatedBlock": "38120900",
        "lastUpdatedTimestamp": "1700089500"
      }
    ]
  }
}
```

---

### 18.7 Multi-Token Comparison Chart

Compare multiple tokens' price or volume in one query using the `in` filter.

**Current price and volume for a set of tokens:**

```graphql
{
  tokens(
    where: {
      id_in: [
        "0xTOKEN_A"
        "0xTOKEN_B"
        "0xTOKEN_C"
      ]
    }
  ) {
    id
    name
    symbol
    lastKnownPrice
    raisedBNB
    migrationTarget
    totalVolumeBNBBuy
    totalVolumeBNBSell
    buysCount
    sellsCount
    migrated
  }
}
```

**1h stats for a set of tokens:**

```graphql
{
  tokenPeriodStats(
    where: {
      period: "1h"
      token_in: [
        "0xTOKEN_A"
        "0xTOKEN_B"
        "0xTOKEN_C"
      ]
    }
    orderBy: volumeBNB
    orderDirection: desc
  ) {
    token { id name symbol }
    periodStart
    openPrice
    closePrice
    volumeBNB
    buysCount
    sellsCount
  }
}
```

---

### 18.8 Platform-Wide Launch Activity

Track new token creation over time for a "launches per day" bar chart.

**Tokens created in the last 7 days:**

```graphql
# Replace 1699344000 with (currentTimestamp - 604800)
{
  tokens(
    where: { createdAtTimestamp_gt: "1699344000" }
    orderBy: createdAtTimestamp
    orderDirection: asc
  ) {
    id
    name
    symbol
    tokenType
    creator
    raisedBNB
    migrated
    createdAtTimestamp
    createdAtBlockNumber
  }
}
```

**Example response:**

```json
{
  "data": {
    "tokens": [
      {
        "id": "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        "name": "PepeMoon",
        "symbol": "PPEM",
        "tokenType": "STANDARD",
        "creator": "0xf1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4",
        "raisedBNB": "17500000000000000000",
        "migrated": false,
        "createdAtTimestamp": "1700086400",
        "createdAtBlockNumber": "38120000"
      }
    ]
  }
}
```

**Platform lifetime stats (Factory singleton):**

```graphql
{
  factories {
    totalTokensCreated
    totalStandardTokens
    totalTaxTokens
    totalReflectionTokens
    totalUnknownTokens
    totalBuys
    totalSells
    totalMigrations
  }
}
```

**Example response:**

```json
{
  "data": {
    "factories": [
      {
        "totalTokensCreated": "142",
        "totalStandardTokens": "89",
        "totalTaxTokens": "31",
        "totalReflectionTokens": "18",
        "totalUnknownTokens": "4",
        "totalBuys": "9871",
        "totalSells": "3204",
        "totalMigrations": "11"
      }
    ]
  }
}
```

---

### 18.9 Migration Funnel Chart

Show how many tokens are at each stage of the bonding curve.

**Bucket tokens by progress band:**

```graphql
# Band 1: 0–25% (raisedBNB < migrationTarget * 0.25)
# Adjust the gte/lt thresholds to match your migrationTarget (usually 20 BNB = 20e18 wei)
{
  earlyStage: tokens(
    where: { migrated: false, raisedBNB_lt: "5000000000000000000" }
    orderBy: raisedBNB
    orderDirection: desc
  ) {
    id name symbol raisedBNB buysCount createdAtTimestamp
  }

  midStage: tokens(
    where: {
      migrated: false
      raisedBNB_gte: "5000000000000000000"
      raisedBNB_lt: "15000000000000000000"
    }
    orderBy: raisedBNB
    orderDirection: desc
  ) {
    id name symbol raisedBNB buysCount createdAtTimestamp
  }

  lateStage: tokens(
    where: {
      migrated: false
      raisedBNB_gte: "15000000000000000000"
    }
    orderBy: raisedBNB
    orderDirection: desc
  ) {
    id name symbol raisedBNB buysCount createdAtTimestamp
  }

  graduated: tokens(
    where: { migrated: true }
    orderBy: migratedAtTimestamp
    orderDirection: desc
    first: 20
  ) {
    id name symbol pair migratedAtTimestamp
  }
}
```

**Example response:**

```json
{
  "data": {
    "earlyStage": [
      {
        "id": "0x9988776655443322998877665544332299887766",
        "name": "DogeKing",
        "symbol": "DGKG",
        "raisedBNB": "1800000000000000000",
        "buysCount": "33",
        "createdAtTimestamp": "1700000000"
      }
    ],
    "midStage": [
      {
        "id": "0xaabbccddaabbccddaabbccddaabbccddaabbccdd",
        "name": "MoonCat",
        "symbol": "MCAT",
        "raisedBNB": "9500000000000000000",
        "buysCount": "87",
        "createdAtTimestamp": "1699900000"
      }
    ],
    "lateStage": [
      {
        "id": "0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        "name": "PepeMoon",
        "symbol": "PPEM",
        "raisedBNB": "17500000000000000000",
        "buysCount": "210",
        "createdAtTimestamp": "1700086400"
      }
    ],
    "graduated": [
      {
        "id": "0x1122334455667788112233445566778811223344",
        "name": "ShibaRocket",
        "symbol": "SHRKT",
        "pair": "0xcafe1234cafe1234cafe1234cafe1234cafe1234",
        "migratedAtTimestamp": "1699950000"
      }
    ]
  }
}
```
