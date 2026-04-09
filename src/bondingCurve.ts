import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  TokenBought,
  TokenSold,
  TokenMigrated,
  FeesUpdated,
  FeeRecipientUpdated,
  CharityWalletUpdated,
  RouterUpdated,
} from "../generated/BondingCurve/BondingCurve";
import { Token, Trade, Migration, TokenSnapshot, TokenPeriodStats } from "../generated/schema";
import { getOrCreateFactory } from "./utils";

function upsertOnePeriodStat(
  tokenAddr: Address,
  period: string,
  duration: i32,
  timestamp: BigInt,
  preRaisedBNB: BigInt,
  postRaisedBNB: BigInt,
  bnbAmount: BigInt,
  isBuy: boolean
): void {
  const bucketId = timestamp.div(BigInt.fromI32(duration)).toI32();
  const id = tokenAddr.concat(Bytes.fromUTF8(period)).concatI32(bucketId);

  let stats = TokenPeriodStats.load(id);
  if (stats == null) {
    stats = new TokenPeriodStats(id);
    stats.token         = tokenAddr;
    stats.period        = period;
    stats.bucketId      = BigInt.fromI32(bucketId);
    stats.periodStart   = BigInt.fromI32(bucketId).times(BigInt.fromI32(duration));
    stats.buyVolumeBNB  = BigInt.fromI32(0);
    stats.sellVolumeBNB = BigInt.fromI32(0);
    stats.volumeBNB     = BigInt.fromI32(0);
    stats.buysCount     = BigInt.fromI32(0);
    stats.sellsCount    = BigInt.fromI32(0);
    stats.openRaisedBNB  = preRaisedBNB;
    stats.closeRaisedBNB = preRaisedBNB;
  }
  stats.closeRaisedBNB = postRaisedBNB;
  stats.volumeBNB      = stats.volumeBNB.plus(bnbAmount);
  if (isBuy) {
    stats.buyVolumeBNB = stats.buyVolumeBNB.plus(bnbAmount);
    stats.buysCount    = stats.buysCount.plus(BigInt.fromI32(1));
  } else {
    stats.sellVolumeBNB = stats.sellVolumeBNB.plus(bnbAmount);
    stats.sellsCount    = stats.sellsCount.plus(BigInt.fromI32(1));
  }
  stats.save();
}

// Must be called BEFORE token.raisedBNB is updated so openRaisedBNB is correct.
function upsertAllPeriodStats(
  tokenAddr: Address,
  timestamp: BigInt,
  preRaisedBNB: BigInt,
  postRaisedBNB: BigInt,
  bnbAmount: BigInt,
  isBuy: boolean
): void {
  upsertOnePeriodStat(tokenAddr, "5m",  300,    timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy);
  upsertOnePeriodStat(tokenAddr, "45m", 2700,   timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy);
  upsertOnePeriodStat(tokenAddr, "1h",  3600,   timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy);
  upsertOnePeriodStat(tokenAddr, "1d",  86400,  timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy);
  upsertOnePeriodStat(tokenAddr, "7d",  604800, timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy);
}

// Must be called BEFORE token.raisedBNB is updated so openRaisedBNB is correct.
function upsertSnapshot(
  tokenAddr: Address,
  blockNumber: BigInt,
  timestamp: BigInt,
  preTradeRaisedBNB: BigInt,
  postTradeRaisedBNB: BigInt,
  bnbAmount: BigInt,
  isBuy: boolean
): void {
  const snapshotId = tokenAddr.concatI32(blockNumber.toI32());
  let snapshot = TokenSnapshot.load(snapshotId);
  if (snapshot == null) {
    snapshot = new TokenSnapshot(snapshotId);
    snapshot.token          = tokenAddr;
    snapshot.blockNumber    = blockNumber;
    snapshot.timestamp      = timestamp;
    snapshot.openRaisedBNB  = preTradeRaisedBNB;
    snapshot.closeRaisedBNB = preTradeRaisedBNB;
    snapshot.volumeBNB      = BigInt.fromI32(0);
    snapshot.buyCount       = 0;
    snapshot.sellCount      = 0;
  }
  snapshot.closeRaisedBNB = postTradeRaisedBNB;
  snapshot.volumeBNB = snapshot.volumeBNB.plus(bnbAmount);
  if (isBuy) snapshot.buyCount  = snapshot.buyCount  + 1;
  else        snapshot.sellCount = snapshot.sellCount + 1;
  snapshot.save();
}

export function handleTokenBought(event: TokenBought): void {
  const token = Token.load(event.params.token);
  if (token == null) return;

  upsertSnapshot(
    event.params.token,
    event.block.number,
    event.block.timestamp,
    token.raisedBNB,
    event.params.raisedBNB,
    event.params.bnbIn,
    true
  );
  upsertAllPeriodStats(
    event.params.token,
    event.block.timestamp,
    token.raisedBNB,
    event.params.raisedBNB,
    event.params.bnbIn,
    true
  );

  const tradeId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const trade   = new Trade(tradeId);
  trade.token          = event.params.token;
  trade.trader         = event.params.buyer;
  trade.type           = "BUY";
  trade.bnbAmount      = event.params.bnbIn;
  trade.tokenAmount    = event.params.tokensOut;
  trade.tokensToDead   = event.params.tokensToDead;
  trade.raisedBNBAfter = event.params.raisedBNB;
  trade.timestamp      = event.block.timestamp;
  trade.blockNumber    = event.block.number;
  trade.txHash         = event.transaction.hash;
  trade.save();

  token.raisedBNB         = event.params.raisedBNB;
  token.buysCount         = token.buysCount.plus(BigInt.fromI32(1));
  token.totalVolumeBNBBuy = token.totalVolumeBNBBuy.plus(event.params.bnbIn);
  token.save();

  const factory = getOrCreateFactory();
  factory.totalBuys = factory.totalBuys.plus(BigInt.fromI32(1));
  factory.save();
}

export function handleTokenSold(event: TokenSold): void {
  const token = Token.load(event.params.token);
  if (token == null) return;

  upsertSnapshot(
    event.params.token,
    event.block.number,
    event.block.timestamp,
    token.raisedBNB,
    event.params.raisedBNB,
    event.params.bnbOut,
    false
  );
  upsertAllPeriodStats(
    event.params.token,
    event.block.timestamp,
    token.raisedBNB,
    event.params.raisedBNB,
    event.params.bnbOut,
    false
  );

  const tradeId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const trade   = new Trade(tradeId);
  trade.token          = event.params.token;
  trade.trader         = event.params.seller;
  trade.type           = "SELL";
  trade.bnbAmount      = event.params.bnbOut;
  trade.tokenAmount    = event.params.tokensIn;
  trade.tokensToDead   = BigInt.fromI32(0); // antibot only applies to buys
  trade.raisedBNBAfter = event.params.raisedBNB;
  trade.timestamp      = event.block.timestamp;
  trade.blockNumber    = event.block.number;
  trade.txHash         = event.transaction.hash;
  trade.save();

  token.raisedBNB          = event.params.raisedBNB;
  token.sellsCount         = token.sellsCount.plus(BigInt.fromI32(1));
  token.totalVolumeBNBSell = token.totalVolumeBNBSell.plus(event.params.bnbOut);
  token.save();

  const factory = getOrCreateFactory();
  factory.totalSells = factory.totalSells.plus(BigInt.fromI32(1));
  factory.save();
}

export function handleTokenMigrated(event: TokenMigrated): void {
  const token = Token.load(event.params.token);
  if (token == null) return;

  token.migrated                 = true;
  token.pair                     = event.params.pair;
  token.migrationBNB             = event.params.liquidityBNB;
  token.migrationLiquidityTokens = event.params.liquidityTokens;
  token.migratedAtTimestamp      = event.block.timestamp;
  token.migratedAtBlockNumber    = event.block.number;
  token.raisedBNB                = BigInt.fromI32(0); // contract resets pool after migration
  token.save();

  const migrationId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const migration   = new Migration(migrationId);
  migration.token           = event.params.token;
  migration.pair            = event.params.pair;
  migration.liquidityBNB    = event.params.liquidityBNB;
  migration.liquidityTokens = event.params.liquidityTokens;
  migration.timestamp       = event.block.timestamp;
  migration.blockNumber     = event.block.number;
  migration.txHash          = event.transaction.hash;
  migration.save();

  const factory = getOrCreateFactory();
  factory.totalMigrations = factory.totalMigrations.plus(BigInt.fromI32(1));
  factory.save();
}

export function handleFeesUpdated(_event: FeesUpdated): void {}
export function handleFeeRecipientUpdated(_event: FeeRecipientUpdated): void {}
export function handleCharityWalletUpdated(_event: CharityWalletUpdated): void {}
export function handleRouterUpdated(_event: RouterUpdated): void {}
