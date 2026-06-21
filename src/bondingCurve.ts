import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { MAX_SPOT_PRICE, getOrCreateFactory, detectTokenType, loadIpfsMetadata } from "./utils";
import {
  TokenRegistered,
  TokenBought,
  TokenSold,
  TokenMigrated,
  FeesUpdated,
  FeeRecipientUpdated,
  CharityWalletUpdated,
  RouterUpdated,
} from "../generated/BondingCurve/BondingCurve";
import { BondingCurve } from "../generated/BondingCurve/BondingCurve";
import { Token as TokenContract } from "../generated/BondingCurve/Token";
import { MemeToken } from "../generated/templates";
import { Token, Trade, Migration, TokenSnapshot, TokenPeriodStats } from "../generated/schema";

const ZERO = BigInt.fromI32(0);

function bigIntMax(a: BigInt, b: BigInt): BigInt {
  return a.gt(b) ? a : b;
}

function bigIntMin(a: BigInt, b: BigInt): BigInt {
  return a.lt(b) ? a : b;
}

// Returns ZERO when the call reverts or the contract returns type(uint256).max
// (which happens when bcTokensPool == 0 after migration — the token is sold out).
function fetchSpotPrice(bcAddress: Address, token: Address): BigInt {
  const bc = BondingCurve.bind(bcAddress);
  const result = bc.try_getSpotPrice(token);
  if (result.reverted) return ZERO;
  return result.value.gt(MAX_SPOT_PRICE) ? ZERO : result.value;
}

function upsertOnePeriodStat(
  tokenAddr: Address,
  period: string,
  duration: i32,
  timestamp: BigInt,
  preRaisedBNB: BigInt,
  postRaisedBNB: BigInt,
  bnbAmount: BigInt,
  isBuy: boolean,
  openPrice: BigInt,
  closePrice: BigInt
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
    stats.buyVolumeBNB  = ZERO;
    stats.sellVolumeBNB = ZERO;
    stats.volumeBNB     = ZERO;
    stats.buysCount     = ZERO;
    stats.sellsCount    = ZERO;
    stats.openRaisedBNB  = preRaisedBNB;
    stats.closeRaisedBNB = preRaisedBNB;
    stats.openPrice  = openPrice;
    stats.highPrice  = bigIntMax(openPrice, closePrice);
    stats.lowPrice   = bigIntMin(openPrice, closePrice);
    stats.closePrice = closePrice;
  } else {
    stats.highPrice  = bigIntMax(stats.highPrice, closePrice);
    stats.lowPrice   = bigIntMin(stats.lowPrice, closePrice);
    stats.closePrice = closePrice;
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
  isBuy: boolean,
  openPrice: BigInt,
  closePrice: BigInt
): void {
  upsertOnePeriodStat(tokenAddr, "5m",  300,    timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy, openPrice, closePrice);
  upsertOnePeriodStat(tokenAddr, "45m", 2700,   timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy, openPrice, closePrice);
  upsertOnePeriodStat(tokenAddr, "1h",  3600,   timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy, openPrice, closePrice);
  upsertOnePeriodStat(tokenAddr, "1d",  86400,  timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy, openPrice, closePrice);
  upsertOnePeriodStat(tokenAddr, "7d",  604800, timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy, openPrice, closePrice);
}

// Must be called BEFORE token.raisedBNB is updated so openRaisedBNB is correct.
function upsertSnapshot(
  tokenAddr: Address,
  blockNumber: BigInt,
  timestamp: BigInt,
  preTradeRaisedBNB: BigInt,
  postTradeRaisedBNB: BigInt,
  bnbAmount: BigInt,
  isBuy: boolean,
  openPrice: BigInt,
  closePrice: BigInt
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
    snapshot.volumeBNB      = ZERO;
    snapshot.buyCount       = 0;
    snapshot.sellCount      = 0;
    snapshot.openPrice  = openPrice;
    snapshot.highPrice  = bigIntMax(openPrice, closePrice);
    snapshot.lowPrice   = bigIntMin(openPrice, closePrice);
    snapshot.closePrice = closePrice;
  } else {
    snapshot.highPrice  = bigIntMax(snapshot.highPrice, closePrice);
    snapshot.lowPrice   = bigIntMin(snapshot.lowPrice, closePrice);
    snapshot.closePrice = closePrice;
  }
  snapshot.closeRaisedBNB = postTradeRaisedBNB;
  snapshot.volumeBNB = snapshot.volumeBNB.plus(bnbAmount);
  if (isBuy) snapshot.buyCount  = snapshot.buyCount  + 1;
  else        snapshot.sellCount = snapshot.sellCount + 1;
  snapshot.save();
}

export function handleTokenRegistered(event: TokenRegistered): void {
  let token = Token.load(event.params.token);

  if (token == null) {
    // Token not yet created — either an old-factory token (TokenCreated never fires for it)
    // or a new-factory token where TokenRegistered fires in the same tx before TokenCreated.
    token = new Token(event.params.token);
    token.creator            = event.params.creator;
    token.totalSupply        = event.params.totalSupply;
    token.virtualBNB         = event.params.virtualBNB;
    token.migrationTarget    = event.params.migrationTarget;
    token.tokenType          = detectTokenType(event.transaction.input);
    // antibotEnabled and tradingBlock are not in this event; handleTokenCreated will overwrite
    // if the token came from the new indexed factory.
    token.antibotEnabled     = false;
    token.tradingBlock       = ZERO;
    token.raisedBNB          = ZERO;
    token.migrated           = false;
    token.buysCount          = ZERO;
    token.sellsCount         = ZERO;
    token.totalVolumeBNBBuy  = ZERO;
    token.totalVolumeBNBSell = ZERO;
    token.lastKnownPrice     = ZERO;
    token.createdAtTimestamp   = event.block.timestamp;
    token.createdAtBlockNumber = event.block.number;
    token.txHash               = event.transaction.hash;

    const tc = TokenContract.bind(event.params.token);
    const nameResult   = tc.try_name();
    const symbolResult = tc.try_symbol();
    if (!nameResult.reverted)   token.name   = nameResult.value;
    if (!symbolResult.reverted) token.symbol = symbolResult.value;

    const metaResult = tc.try_metaURI();
    if (!metaResult.reverted && metaResult.value.length > 0) {
      token.metaUri = metaResult.value;
      loadIpfsMetadata(token, metaResult.value);
    }

    // Seed initial spot price from this bonding curve.
    const price = fetchSpotPrice(event.address, event.params.token);
    if (!price.equals(ZERO)) token.lastKnownPrice = price;

    token.save();
    MemeToken.create(event.params.token);

    const factory = getOrCreateFactory();
    factory.totalTokensCreated = factory.totalTokensCreated.plus(BigInt.fromI32(1));
    const tt = token.tokenType;
    if (tt == "STANDARD")        factory.totalStandardTokens   = factory.totalStandardTokens.plus(BigInt.fromI32(1));
    else if (tt == "TAX")        factory.totalTaxTokens        = factory.totalTaxTokens.plus(BigInt.fromI32(1));
    else if (tt == "REFLECTION") factory.totalReflectionTokens = factory.totalReflectionTokens.plus(BigInt.fromI32(1));
    else                         factory.totalUnknownTokens    = factory.totalUnknownTokens.plus(BigInt.fromI32(1));
    factory.save();
  } else {
    // Token already exists (created by handleTokenCreated in a previous call — shouldn't normally
    // happen since TokenRegistered fires before TokenCreated in the same tx, but handle gracefully).
    const price = fetchSpotPrice(event.address, event.params.token);
    if (!price.equals(ZERO)) token.lastKnownPrice = price;
    token.save();
  }
}

export function handleTokenBought(event: TokenBought): void {
  const token = Token.load(event.params.token);
  if (token == null) return;

  const openPrice = token.lastKnownPrice;
  // fetchSpotPrice returns ZERO when the token is migrated (poolTokens == 0 → type(uint256).max sentinel).
  // Fall back to openPrice so the final candle closes at the last real price, not a corrupted value.
  const fetched   = fetchSpotPrice(event.address, event.params.token);
  const closePrice = fetched.equals(ZERO) ? openPrice : fetched;

  upsertSnapshot(
    event.params.token,
    event.block.number,
    event.block.timestamp,
    token.raisedBNB,
    event.params.raisedBNB,
    event.params.bnbIn,
    true,
    openPrice,
    closePrice
  );
  upsertAllPeriodStats(
    event.params.token,
    event.block.timestamp,
    token.raisedBNB,
    event.params.raisedBNB,
    event.params.bnbIn,
    true,
    openPrice,
    closePrice
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
  token.lastKnownPrice    = closePrice;
  token.save();

  const factory = getOrCreateFactory();
  factory.totalBuys = factory.totalBuys.plus(BigInt.fromI32(1));
  factory.save();
}

export function handleTokenSold(event: TokenSold): void {
  const token = Token.load(event.params.token);
  if (token == null) return;

  const openPrice  = token.lastKnownPrice;
  const fetched    = fetchSpotPrice(event.address, event.params.token);
  const closePrice = fetched.equals(ZERO) ? openPrice : fetched;

  upsertSnapshot(
    event.params.token,
    event.block.number,
    event.block.timestamp,
    token.raisedBNB,
    event.params.raisedBNB,
    event.params.bnbOut,
    false,
    openPrice,
    closePrice
  );
  upsertAllPeriodStats(
    event.params.token,
    event.block.timestamp,
    token.raisedBNB,
    event.params.raisedBNB,
    event.params.bnbOut,
    false,
    openPrice,
    closePrice
  );

  const tradeId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const trade   = new Trade(tradeId);
  trade.token          = event.params.token;
  trade.trader         = event.params.seller;
  trade.type           = "SELL";
  trade.bnbAmount      = event.params.bnbOut;
  trade.tokenAmount    = event.params.tokensIn;
  trade.tokensToDead   = ZERO;
  trade.raisedBNBAfter = event.params.raisedBNB;
  trade.timestamp      = event.block.timestamp;
  trade.blockNumber    = event.block.number;
  trade.txHash         = event.transaction.hash;
  trade.save();

  token.raisedBNB          = event.params.raisedBNB;
  token.sellsCount         = token.sellsCount.plus(BigInt.fromI32(1));
  token.totalVolumeBNBSell = token.totalVolumeBNBSell.plus(event.params.bnbOut);
  token.lastKnownPrice     = closePrice;
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
  token.raisedBNB                = ZERO; // contract resets pool after migration
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
