import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  BoughtBack,
  RouterUpdated,
  BuyTokenUpdated,
  CooldownUpdated,
  OwnershipTransferred,
} from "../../generated/OneMEMEBB/OneMEMEBB";
import { BuyBack, BuyBackEvent } from "../../generated/schema";

function getOrCreateBuyBack(address: Bytes): BuyBack {
  let bb = BuyBack.load(address);
  if (bb == null) {
    bb = new BuyBack(address);
    bb.owner         = Bytes.empty();
    bb.router        = Bytes.empty();
    bb.buyToken      = Bytes.empty();
    bb.cooldown      = BigInt.fromI32(3600); // default 1 hour
    bb.lastBuyAt     = BigInt.fromI32(0);
    bb.totalBNBSpent = BigInt.fromI32(0);
    bb.buybackCount  = BigInt.fromI32(0);
    bb.save();
  }
  return bb as BuyBack;
}

export function handleBoughtBack(event: BoughtBack): void {
  const bb = getOrCreateBuyBack(event.address);
  bb.lastBuyAt     = event.block.timestamp;
  bb.totalBNBSpent = bb.totalBNBSpent.plus(event.params.bnbSpent);
  bb.buybackCount  = bb.buybackCount.plus(BigInt.fromI32(1));
  bb.save();

  const id = event.transaction.hash.concatI32(event.logIndex.toI32());
  const e  = new BuyBackEvent(id);
  e.buyback       = event.address;
  e.bnbSpent      = event.params.bnbSpent;
  e.balanceBefore = event.params.balanceBefore;
  e.timestamp     = event.block.timestamp;
  e.blockNumber   = event.block.number;
  e.txHash        = event.transaction.hash;
  e.save();
}

export function handleRouterUpdated(event: RouterUpdated): void {
  const bb = getOrCreateBuyBack(event.address);
  bb.router = event.params.newRouter;
  bb.save();
}

export function handleBuyTokenUpdated(event: BuyTokenUpdated): void {
  const bb = getOrCreateBuyBack(event.address);
  bb.buyToken = event.params.newToken;
  bb.save();
}

export function handleCooldownUpdated(event: CooldownUpdated): void {
  const bb = getOrCreateBuyBack(event.address);
  bb.cooldown = event.params.newCooldown;
  bb.save();
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  const bb = getOrCreateBuyBack(event.address);
  bb.owner = event.params.newOwner;
  bb.save();
}
