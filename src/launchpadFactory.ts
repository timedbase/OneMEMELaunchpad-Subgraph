import { BigInt, Bytes, ipfs, json, JSONValueKind, log } from "@graphprotocol/graph-ts";
import { Token as TokenContract } from "../generated/LaunchpadFactory/Token";
import { MemeToken } from "../generated/templates";
import {
  TokenCreated,
  DefaultParamsUpdated,
  CreationFeeUpdated,
  OwnershipTransferred,
  ManagerAdded,
  ManagerRemoved,
  TimelockQueued,
  TimelockExecuted,
  TimelockCancelled,
} from "../generated/LaunchpadFactory/LaunchpadFactory";
import { Token, TimelockAction } from "../generated/schema";
import { getOrCreateFactory, detectTokenType } from "./utils";

function loadIpfsMetadata(token: Token, uri: string): void {
  let cid = uri;
  if (uri.startsWith("ipfs://"))    cid = uri.slice(7);
  else if (uri.startsWith("ipfs/")) cid = uri.slice(5);
  const data = ipfs.cat(cid);
  if (data) {
    const result = json.try_fromBytes(data as Bytes);
    if (!result.isError) {
      if (result.value.kind == JSONValueKind.OBJECT) {
        const obj = result.value.toObject();
        const desc = obj.get("description");
        if (desc) {
          if (desc.kind == JSONValueKind.STRING) token.description = desc.toString();
        }
        const img = obj.get("image");
        if (img) {
          if (img.kind == JSONValueKind.STRING) token.image = img.toString();
        }
        const web = obj.get("website");
        if (web) {
          if (web.kind == JSONValueKind.STRING) token.website = web.toString();
        }
        const socialsVal = obj.get("socials");
        if (socialsVal) {
          if (socialsVal.kind == JSONValueKind.OBJECT) {
            const socials = socialsVal.toObject();
            const tw = socials.get("twitter");
            if (tw) {
              if (tw.kind == JSONValueKind.STRING) token.twitter = tw.toString();
            }
            const tg = socials.get("telegram");
            if (tg) {
              if (tg.kind == JSONValueKind.STRING) token.telegram = tg.toString();
            }
          }
        }
      }
    }
  }
}

export function handleTokenCreated(event: TokenCreated): void {
  const tokenType = detectTokenType(event.transaction.input);

  const token = new Token(event.params.token);
  token.creator         = event.params.creator;
  token.totalSupply     = event.params.totalSupply;
  token.tokenType       = tokenType;
  token.virtualBNB      = event.params.virtualBNB;
  token.migrationTarget = event.params.migrationTarget;
  token.antibotEnabled  = event.params.antibotEnabled;
  token.tradingBlock    = event.params.tradingBlock;
  token.raisedBNB       = BigInt.fromI32(0);
  token.migrated        = false;
  token.buysCount       = BigInt.fromI32(0);
  token.sellsCount      = BigInt.fromI32(0);
  token.totalVolumeBNBBuy  = BigInt.fromI32(0);
  token.totalVolumeBNBSell = BigInt.fromI32(0);
  token.createdAtTimestamp   = event.block.timestamp;
  token.createdAtBlockNumber = event.block.number;
  token.txHash = event.transaction.hash;

  const tokenContract = TokenContract.bind(event.params.token);
  const nameResult    = tokenContract.try_name();
  const symbolResult  = tokenContract.try_symbol();
  if (!nameResult.reverted)   token.name   = nameResult.value;
  if (!symbolResult.reverted) token.symbol = symbolResult.value;

  const metaResult = tokenContract.try_metaURI();
  if (!metaResult.reverted) {
    const uri = metaResult.value;
    if (uri.length > 0) {
      token.metaUri = uri;
      loadIpfsMetadata(token, uri);
    }
  }

  token.save();
  MemeToken.create(event.params.token);

  const factory = getOrCreateFactory();
  factory.totalTokensCreated = factory.totalTokensCreated.plus(BigInt.fromI32(1));
  if (tokenType == "STANDARD")    factory.totalStandardTokens   = factory.totalStandardTokens.plus(BigInt.fromI32(1));
  else if (tokenType == "TAX")    factory.totalTaxTokens        = factory.totalTaxTokens.plus(BigInt.fromI32(1));
  else if (tokenType == "REFLECTION") factory.totalReflectionTokens = factory.totalReflectionTokens.plus(BigInt.fromI32(1));
  factory.save();
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

export function handleManagerAdded(_event: ManagerAdded): void {}
export function handleManagerRemoved(_event: ManagerRemoved): void {}

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
  action.save();
}

export function handleTimelockCancelled(event: TimelockCancelled): void {
  const action = TimelockAction.load(event.params.actionId);
  if (action == null) return;
  action.cancelled = true;
  action.save();
}
