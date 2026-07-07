import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { Launchpad as LaunchpadContract } from "../generated/Launchpad/Launchpad";
import { Token as TokenContract } from "../generated/Launchpad/Token";
import { PancakePair as PancakePairContract } from "../generated/Launchpad/PancakePair";
import { MemeToken, PancakePair } from "../generated/templates";
import {
  TokenCreated,
  TokenRegistered,
  TokenBought,
  TokenSold,
  TokenMigrated,
  EmergencyMigrated,
  MigrationFailed,
  AllocationBoundsUpdated,
  SupplyBoundsUpdated,
  ImplUpdated,
  CreationFeeUpdated,
  FeesUpdated,
  FeeRecipientUpdated,
  CharityWalletUpdated,
  CreatorVaultUpdated,
  RouterUpdated,
  OwnershipTransferred,
  OwnershipTransferProposed,
  TimelockQueued,
  TimelockExecuted,
  TimelockCancelled,
} from "../generated/Launchpad/Launchpad";
import { Token, Trade, Migration, TimelockAction, CreatorVaultPosition, LaunchpadPair } from "../generated/schema";
import {
  getOrCreateFactory,
  detectTokenType,
  loadIpfsMetadata,
  MAX_SPOT_PRICE,
  ZERO,
  computePrice,
  computeMarketCap,
  seedLaunchChartData,
  upsertSnapshot,
  upsertAllPeriodStats,
  applyUsdPricing,
} from "./utils";

// TokenRegistered fires first (during _registerToken), then TokenCreated fires at end
// of createToken/createTT/createRFL — so we create the entity here and let
// handleTokenCreated fill in antibotEnabled + tradingBlock.
export function handleTokenRegistered(event: TokenRegistered): void {
  let token = Token.load(event.params.token);

  if (token == null) {
    token = new Token(event.params.token);
    token.creator            = event.params.creator;
    token.totalSupply        = event.params.totalSupply;
    token.virtualBNB         = event.params.virtualBNB;
    token.migrationTarget    = event.params.migrationTarget;
    token.tokenType          = detectTokenType(event.transaction.input);
    token.antibotEnabled     = false;
    token.tradingBlock       = ZERO;
    token.raisedBNB          = ZERO;
    token.migrated           = false;
    token.migrationFailed        = false;
    token.emergencyMigrated      = false;
    token.buysCount          = ZERO;
    token.sellsCount         = ZERO;
    token.totalVolumeBNBBuy  = ZERO;
    token.totalVolumeBNBSell = ZERO;
    token.bcTokensPool       = ZERO;
    token.lastKnownPrice     = ZERO;
    token.marketCap          = ZERO;
    token.priceUSD           = null;
    token.marketCapUSD       = null;
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

    // Seed pool size and initial price from the Launchpad's current token balance.
    const balanceResult = tc.try_balanceOf(event.address);
    if (!balanceResult.reverted && balanceResult.value.gt(ZERO)) {
      token.bcTokensPool   = balanceResult.value;
      token.lastKnownPrice = computePrice(event.params.virtualBNB, ZERO, balanceResult.value);
      token.marketCap      = computeMarketCap(token.lastKnownPrice, token.totalSupply);
      applyUsdPricing(token, token.lastKnownPrice);
    }

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
    // Both events come from the same contract in the same tx. If TokenRegistered somehow
    // arrives after TokenCreated (shouldn't happen) just re-seed the pool if still zero.
    if (token.bcTokensPool.equals(ZERO)) {
      const tc2 = TokenContract.bind(event.params.token);
      const bal = tc2.try_balanceOf(event.address);
      if (!bal.reverted && bal.value.gt(ZERO)) {
        token.bcTokensPool   = bal.value;
        token.lastKnownPrice = computePrice(event.params.virtualBNB, ZERO, bal.value);
        token.marketCap      = computeMarketCap(token.lastKnownPrice, token.totalSupply);
        applyUsdPricing(token, token.lastKnownPrice);
      }
    }
    token.save();
  }
}

export function handleTokenCreated(event: TokenCreated): void {
  const tokenType = detectTokenType(event.transaction.input);

  const existing = Token.load(event.params.token);
  const isNew = existing === null;
  const token: Token = existing !== null ? existing : new Token(event.params.token);

  token.creator         = event.params.creator;
  token.totalSupply     = event.params.totalSupply;
  token.tokenType       = tokenType;
  token.virtualBNB      = event.params.virtualBNB;
  token.migrationTarget = event.params.migrationTarget;
  token.antibotEnabled  = event.params.antibotEnabled;
  token.tradingBlock    = event.params.tradingBlock;

  if (isNew) {
    token.raisedBNB              = ZERO;
    token.migrated               = false;
    token.migrationFailed        = false;
    token.emergencyMigrated      = false;
    token.buysCount              = ZERO;
    token.sellsCount             = ZERO;
    token.totalVolumeBNBBuy      = ZERO;
    token.totalVolumeBNBSell     = ZERO;
    token.bcTokensPool           = ZERO;
    token.lastKnownPrice         = ZERO;
    token.marketCap              = ZERO;
    token.priceUSD               = null;
    token.marketCapUSD           = null;
    token.createdAtTimestamp     = event.block.timestamp;
    token.createdAtBlockNumber   = event.block.number;
    token.txHash                 = event.transaction.hash;
  }

  // Fetch ERC-20 metadata if not already populated.
  if (token.name == null || token.symbol == null) {
    const tc = TokenContract.bind(event.params.token);
    const nameResult   = tc.try_name();
    const symbolResult = tc.try_symbol();
    if (!nameResult.reverted)   token.name   = nameResult.value;
    if (!symbolResult.reverted) token.symbol = symbolResult.value;

    const metaResult = tc.try_metaURI();
    if (!metaResult.reverted && metaResult.value.length > 0) {
      const uri = metaResult.value;
      token.metaUri = uri;
      loadIpfsMetadata(token, uri);
    }
  }

  // Seed / refresh spot price from the Launchpad directly (it IS the bonding curve now).
  const launchpad = LaunchpadContract.bind(event.address);
  const priceResult = launchpad.try_getSpotPrice(event.params.token);
  if (!priceResult.reverted && priceResult.value.lt(MAX_SPOT_PRICE)) {
    token.lastKnownPrice = priceResult.value;
  }
  token.marketCap = computeMarketCap(token.lastKnownPrice, token.totalSupply);
  applyUsdPricing(token, token.lastKnownPrice);

  token.save();

  // Seed chart data so every token has at least a launch-price candle before any trades.
  if (token.lastKnownPrice.gt(ZERO)) {
    seedLaunchChartData(event.params.token, event.block.number, event.block.timestamp, token.lastKnownPrice);
  }

  if (isNew) {
    MemeToken.create(event.params.token);

    const factory = getOrCreateFactory();
    factory.totalTokensCreated = factory.totalTokensCreated.plus(BigInt.fromI32(1));
    if (tokenType == "STANDARD")        factory.totalStandardTokens   = factory.totalStandardTokens.plus(BigInt.fromI32(1));
    else if (tokenType == "TAX")        factory.totalTaxTokens        = factory.totalTaxTokens.plus(BigInt.fromI32(1));
    else if (tokenType == "REFLECTION") factory.totalReflectionTokens = factory.totalReflectionTokens.plus(BigInt.fromI32(1));
    else                                factory.totalUnknownTokens    = factory.totalUnknownTokens.plus(BigInt.fromI32(1));
    factory.save();
  }
}

export function handleTokenBought(event: TokenBought): void {
  const token = Token.load(event.params.token);
  if (token == null) return;

  const openPrice      = computePrice(token.virtualBNB, token.raisedBNB, token.bcTokensPool);
  const grossTokensOut = event.params.tokensOut.plus(event.params.tokensToDead);
  const newBcTokens    = token.bcTokensPool.gt(grossTokensOut)
    ? token.bcTokensPool.minus(grossTokensOut)
    : ZERO;
  const closePrice     = computePrice(token.virtualBNB, event.params.raisedBNB, newBcTokens);

  upsertSnapshot(
    event.params.token, event.block.number, event.block.timestamp,
    token.raisedBNB, event.params.raisedBNB, event.params.bnbIn, true, openPrice, closePrice
  );
  upsertAllPeriodStats(
    event.params.token, event.block.timestamp,
    token.raisedBNB, event.params.raisedBNB, event.params.bnbIn, true, openPrice, closePrice
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

  token.bcTokensPool      = newBcTokens;
  token.raisedBNB         = event.params.raisedBNB;
  token.buysCount         = token.buysCount.plus(BigInt.fromI32(1));
  token.totalVolumeBNBBuy = token.totalVolumeBNBBuy.plus(event.params.bnbIn);
  token.lastKnownPrice    = closePrice;
  token.marketCap         = computeMarketCap(closePrice, token.totalSupply);
  applyUsdPricing(token, closePrice);
  token.save();

  const factory = getOrCreateFactory();
  factory.totalBuys = factory.totalBuys.plus(BigInt.fromI32(1));
  factory.save();
}

export function handleTokenSold(event: TokenSold): void {
  const token = Token.load(event.params.token);
  if (token == null) return;

  const openPrice   = computePrice(token.virtualBNB, token.raisedBNB, token.bcTokensPool);
  const newBcTokens = token.bcTokensPool.plus(event.params.tokensIn);
  const closePrice  = computePrice(token.virtualBNB, event.params.raisedBNB, newBcTokens);

  upsertSnapshot(
    event.params.token, event.block.number, event.block.timestamp,
    token.raisedBNB, event.params.raisedBNB, event.params.bnbOut, false, openPrice, closePrice
  );
  upsertAllPeriodStats(
    event.params.token, event.block.timestamp,
    token.raisedBNB, event.params.raisedBNB, event.params.bnbOut, false, openPrice, closePrice
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

  token.bcTokensPool       = newBcTokens;
  token.raisedBNB          = event.params.raisedBNB;
  token.sellsCount         = token.sellsCount.plus(BigInt.fromI32(1));
  token.totalVolumeBNBSell = token.totalVolumeBNBSell.plus(event.params.bnbOut);
  token.lastKnownPrice     = closePrice;
  token.marketCap          = computeMarketCap(closePrice, token.totalSupply);
  applyUsdPricing(token, closePrice);
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
  token.raisedBNB                = ZERO;
  token.bcTokensPool             = ZERO;
  token.save();

  // STANDARD-token (V3) migrations already wired their pool from CreatorVault's
  // PositionRegistered handler (same tx, fires first — see creatorVault.ts). TokenMigrated.pair
  // is that same pool address in that case, so only wire a V2 pair here otherwise.
  if (CreatorVaultPosition.load(event.params.token) == null) {
    const pairContract = PancakePairContract.bind(event.params.pair);
    const token0Result = pairContract.try_token0();

    const pairLookup = new LaunchpadPair(event.params.pair);
    pairLookup.token         = event.params.token;
    pairLookup.tokenIsToken0 = !token0Result.reverted && token0Result.value.equals(event.params.token as Address);
    pairLookup.save();

    PancakePair.create(event.params.pair);
  }

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

export function handleCreationFeeUpdated(event: CreationFeeUpdated): void {
  const factory = getOrCreateFactory();
  factory.creationFee = event.params.newFee;
  factory.save();
}

export function handleFeesUpdated(event: FeesUpdated): void {
  const factory = getOrCreateFactory();
  factory.platformFeeBps = event.params.platformFee;
  factory.charityFeeBps  = event.params.charityFee;
  factory.save();
}

export function handleCreatorVaultUpdated(event: CreatorVaultUpdated): void {
  const factory = getOrCreateFactory();
  factory.creatorVault = event.params.next;
  factory.save();
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  const factory = getOrCreateFactory();
  factory.owner = event.params.next;
  factory.save();
}

export function handleOwnershipTransferProposed(event: OwnershipTransferProposed): void {
  const factory = getOrCreateFactory();
  factory.pendingOwner = event.params.proposed;
  factory.save();
}

export function handleTimelockQueued(event: TimelockQueued): void {
  const id = event.params.actionId;
  let action = TimelockAction.load(id);
  if (action == null) {
    action = new TimelockAction(id);
  }
  action.factory      = getOrCreateFactory().id;
  action.executeAfter = event.params.executeAfter;
  action.executed  = false;
  action.cancelled = false;
  action.queuedAtTimestamp   = event.block.timestamp;
  action.queuedAtBlockNumber = event.block.number;
  action.queuedTxHash        = event.transaction.hash;
  action.save();
}

export function handleTimelockExecuted(event: TimelockExecuted): void {
  const action = TimelockAction.load(event.params.actionId);
  if (action == null) return;
  action.executed = true;
  action.executedTxHash = event.transaction.hash;
  action.save();
}

export function handleTimelockCancelled(event: TimelockCancelled): void {
  const action = TimelockAction.load(event.params.actionId);
  if (action == null) return;
  action.cancelled = true;
  action.cancelledTxHash = event.transaction.hash;
  action.save();
}

export function handleFeeRecipientUpdated(event: FeeRecipientUpdated): void {
  const factory = getOrCreateFactory();
  factory.feeRecipient = event.params.recipient;
  factory.save();
}

export function handleCharityWalletUpdated(event: CharityWalletUpdated): void {
  const factory = getOrCreateFactory();
  factory.charityWallet = event.params.wallet;
  factory.save();
}

export function handleRouterUpdated(event: RouterUpdated): void {
  const factory = getOrCreateFactory();
  factory.router = event.params.newRouter;
  factory.save();
}

export function handleEmergencyMigrated(event: EmergencyMigrated): void {
  const token = Token.load(event.params.token);
  if (token == null) return;
  token.emergencyMigrated             = true;
  token.emergencyMigrationTo          = event.params.to;
  token.emergencyMigrationBnb         = event.params.bnbAmount;
  token.emergencyMigrationTokenAmount = event.params.tokenAmount;
  token.emergencyMigratedAtTimestamp  = event.block.timestamp;
  token.emergencyMigratedAtBlockNumber = event.block.number;
  token.save();
}

export function handleMigrationFailed(event: MigrationFailed): void {
  const token = Token.load(event.params.token);
  if (token == null) return;
  token.migrationFailed = true;
  token.save();
}

export function handleAllocationBoundsUpdated(event: AllocationBoundsUpdated): void {
  const factory = getOrCreateFactory();
  factory.minCurveBps     = event.params.minCurveBps;
  factory.minLiquidityBps = event.params.minLiquidityBps;
  factory.maxCreatorBps   = event.params.maxCreatorBps;
  factory.save();
}

export function handleSupplyBoundsUpdated(event: SupplyBoundsUpdated): void {
  const factory = getOrCreateFactory();
  factory.minSupply = event.params.minSupply;
  factory.maxSupply = event.params.maxSupply;
  factory.save();
}

export function handleImplUpdated(event: ImplUpdated): void {
  const factory = getOrCreateFactory();
  factory.latestImplType = event.params.implType;
  factory.latestImpl     = event.params.next;
  factory.save();
}
