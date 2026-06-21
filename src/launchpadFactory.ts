import { BigInt } from "@graphprotocol/graph-ts";
import { Token as TokenContract } from "../generated/LaunchpadFactory/Token";
import { LaunchpadFactory as LaunchpadFactoryContract } from "../generated/LaunchpadFactory/LaunchpadFactory";
import { BondingCurve } from "../generated/BondingCurve/BondingCurve";
import { MemeToken } from "../generated/templates";
import {
  TokenCreated,
  DefaultParamsUpdated,
  CreationFeeUpdated,
  OwnershipTransferred,
  OwnershipTransferProposed,
  PlatformFeeUpdated,
  CharityFeeUpdated,
  VestingWalletUpdated,
  TimelockQueued,
  TimelockExecuted,
  TimelockCancelled,
} from "../generated/LaunchpadFactory/LaunchpadFactory";
import { Token, TimelockAction } from "../generated/schema";
import { getOrCreateFactory, detectTokenType, loadIpfsMetadata, MAX_SPOT_PRICE } from "./utils";

export function handleTokenCreated(event: TokenCreated): void {
  const tokenType = detectTokenType(event.transaction.input);

  // Token may already exist: handleTokenRegistered on BondingCurve fires before
  // handleTokenCreated in the same tx and creates the entity with partial data.
  // Here we overwrite with the complete factory-event data (antibotEnabled, tradingBlock)
  // and do not double-count in factory stats.
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
    token.raisedBNB          = BigInt.fromI32(0);
    token.migrated           = false;
    token.buysCount          = BigInt.fromI32(0);
    token.sellsCount         = BigInt.fromI32(0);
    token.totalVolumeBNBBuy  = BigInt.fromI32(0);
    token.totalVolumeBNBSell = BigInt.fromI32(0);
    token.lastKnownPrice     = BigInt.fromI32(0);
    token.createdAtTimestamp   = event.block.timestamp;
    token.createdAtBlockNumber = event.block.number;
    token.txHash = event.transaction.hash;
  }

  const tokenContract = TokenContract.bind(event.params.token);
  const nameResult    = tokenContract.try_name();
  const symbolResult  = tokenContract.try_symbol();
  if (!nameResult.reverted)   token.name   = nameResult.value;
  if (!symbolResult.reverted) token.symbol = symbolResult.value;

  const metaResult = tokenContract.try_metaURI();
  if (!metaResult.reverted && metaResult.value.length > 0) {
    const uri = metaResult.value;
    token.metaUri = uri;
    loadIpfsMetadata(token, uri);
  }

  // Seed initial spot price from bonding curve (overrides the value set in handleTokenRegistered).
  const factoryContract = LaunchpadFactoryContract.bind(event.address);
  const migratorResult  = factoryContract.try_migrator();
  if (!migratorResult.reverted) {
    const priceResult = BondingCurve.bind(migratorResult.value).try_getSpotPrice(event.params.token);
    if (!priceResult.reverted && priceResult.value.lt(MAX_SPOT_PRICE)) {
      token.lastKnownPrice = priceResult.value;
    }
  }

  token.save();

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

export function handleDefaultParamsUpdated(event: DefaultParamsUpdated): void {
  const factory = getOrCreateFactory();
  factory.defaultVirtualBNB      = event.params.newVirtualBNB;
  factory.defaultMigrationTarget = event.params.newMigrationTarget;
  factory.save();
}

export function handleCreationFeeUpdated(event: CreationFeeUpdated): void {
  const factory = getOrCreateFactory();
  factory.creationFee = event.params.newFee;
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

export function handlePlatformFeeUpdated(event: PlatformFeeUpdated): void {
  const factory = getOrCreateFactory();
  factory.platformFeeBps = event.params.feeBps;
  factory.save();
}

export function handleCharityFeeUpdated(event: CharityFeeUpdated): void {
  const factory = getOrCreateFactory();
  factory.charityFeeBps = event.params.feeBps;
  factory.save();
}

export function handleVestingWalletUpdated(event: VestingWalletUpdated): void {
  const factory = getOrCreateFactory();
  factory.vestingWallet = event.params.next;
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
