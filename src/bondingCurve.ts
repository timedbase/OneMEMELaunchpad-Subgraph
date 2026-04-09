import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  TokenBought,
  TokenSold,
  TokenMigrated,
  FeesUpdated,
  FeeRecipientUpdated,
  CharityWalletUpdated,
  RouterUpdated,
} from "../generated/BondingCurve/BondingCurve";
import { Token, Trade, Migration, TokenSnapshot } from "../generated/schema";
import { getOrCreateFactory } from "./utils";

// ─── Snapshot helper ─────────────────────────────────────────────────────────

/**
 * Upserts a per-block OHLCV snapshot for TradingView charts.
 * Must be called BEFORE token.raisedBNB is mutated so that preTradeRaisedBNB
 * correctly captures the opening value for the block.
 */
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
    snapshot.token         = tokenAddr;
    snapshot.blockNumber   = blockNumber;
    snapshot.timestamp     = timestamp;
    snapshot.openRaisedBNB = preTradeRaisedBNB; // first trade in block sets the open
    snapshot.volumeBNB     = BigInt.fromI32(0);
    snapshot.buyCount      = 0;
    snapshot.sellCount     = 0;
    snapshot.closeRaisedBNB = preTradeRaisedBNB;
  }
  snapshot.closeRaisedBNB = postTradeRaisedBNB;  // each trade updates the close
  snapshot.volumeBNB = snapshot.volumeBNB.plus(bnbAmount);
  if (isBuy) snapshot.buyCount  = snapshot.buyCount  + 1;
  else        snapshot.sellCount = snapshot.sellCount + 1;
  snapshot.save();
}

// ─── Event handlers ───────────────────────────────────────────────────────────

export function handleTokenBought(event: TokenBought): void {
  const token = Token.load(event.params.token);
  // Guard: token should already exist from the LaunchpadFactory TokenCreated event.
  if (token == null) return;

  // Snapshot — called before token.raisedBNB is updated so openRaisedBNB is correct.
  upsertSnapshot(
    event.params.token,
    event.block.number,
    event.block.timestamp,
    token.raisedBNB,        // pre-trade (open for new snapshots)
    event.params.raisedBNB, // post-trade (close)
    event.params.bnbIn,
    true
  );

  // Persist the trade.
  const tradeId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const trade   = new Trade(tradeId);
  trade.token        = event.params.token;
  trade.trader       = event.params.buyer;
  trade.type         = "BUY";
  trade.bnbAmount    = event.params.bnbIn;
  trade.tokenAmount  = event.params.tokensOut;
  trade.tokensToDead = event.params.tokensToDead;
  trade.raisedBNBAfter = event.params.raisedBNB;
  trade.timestamp    = event.block.timestamp;
  trade.blockNumber  = event.block.number;
  trade.txHash       = event.transaction.hash;
  trade.save();

  // Update token state.
  token.raisedBNB         = event.params.raisedBNB;
  token.buysCount         = token.buysCount.plus(BigInt.fromI32(1));
  token.totalVolumeBNBBuy = token.totalVolumeBNBBuy.plus(event.params.bnbIn);
  token.save();

  // Update global factory stats.
  const factory = getOrCreateFactory();
  factory.totalBuys = factory.totalBuys.plus(BigInt.fromI32(1));
  factory.save();
}

export function handleTokenSold(event: TokenSold): void {
  const token = Token.load(event.params.token);
  if (token == null) return;

  // Snapshot — called before token.raisedBNB is updated.
  upsertSnapshot(
    event.params.token,
    event.block.number,
    event.block.timestamp,
    token.raisedBNB,
    event.params.raisedBNB,
    event.params.bnbOut,
    false
  );

  const tradeId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const trade   = new Trade(tradeId);
  trade.token        = event.params.token;
  trade.trader       = event.params.seller;
  trade.type         = "SELL";
  trade.bnbAmount    = event.params.bnbOut;
  trade.tokenAmount  = event.params.tokensIn;
  trade.tokensToDead = BigInt.fromI32(0); // antibot only applies to buys
  trade.raisedBNBAfter = event.params.raisedBNB;
  trade.timestamp    = event.block.timestamp;
  trade.blockNumber  = event.block.number;
  trade.txHash       = event.transaction.hash;
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

  // Mark token as migrated.
  token.migrated                 = true;
  token.pair                     = event.params.pair;
  token.migrationBNB             = event.params.liquidityBNB;
  token.migrationLiquidityTokens = event.params.liquidityTokens;
  token.migratedAtTimestamp      = event.block.timestamp;
  token.migratedAtBlockNumber    = event.block.number;
  // raisedBNB is reset to 0 inside the contract after migration.
  token.raisedBNB = BigInt.fromI32(0);
  token.save();

  // Create a Migration record.
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

// Config events — no complex state needed, kept for future dashboards.
export function handleFeesUpdated(_event: FeesUpdated): void {
  // No-op — fees are not persisted in the subgraph schema (query on-chain as needed).
}

export function handleFeeRecipientUpdated(_event: FeeRecipientUpdated): void {
  // No-op
}

export function handleCharityWalletUpdated(_event: CharityWalletUpdated): void {
  // No-op
}

export function handleRouterUpdated(_event: RouterUpdated): void {
  // No-op
}
