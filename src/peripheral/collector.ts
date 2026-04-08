import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  Dispersed,
  RecipientsUpdated,
  OwnershipTransferred,
} from "../../generated/Collector/Collector";
import { Collector, DisperseEvent } from "../../generated/schema";

function getOrCreateCollector(address: Bytes): Collector {
  let c = Collector.load(address);
  if (c == null) {
    c = new Collector(address);
    c.owner          = Bytes.empty();
    c.totalDispersed = BigInt.fromI32(0);
    c.disperseCount  = BigInt.fromI32(0);
    c.save();
  }
  return c as Collector;
}

export function handleDispersed(event: Dispersed): void {
  const c = getOrCreateCollector(event.address);
  c.totalDispersed = c.totalDispersed.plus(event.params.total);
  c.disperseCount  = c.disperseCount.plus(BigInt.fromI32(1));
  c.save();

  const id = event.transaction.hash.concatI32(event.logIndex.toI32());
  const e  = new DisperseEvent(id);
  e.collector   = event.address;
  e.total       = event.params.total;
  e.timestamp   = event.block.timestamp;
  e.blockNumber = event.block.number;
  e.txHash      = event.transaction.hash;
  e.save();
}

export function handleRecipientsUpdated(event: RecipientsUpdated): void {
  const c = getOrCreateCollector(event.address);
  c.cr8 = event.params.cr8;
  c.mtn = event.params.mtn;
  c.bb  = event.params.bb;
  c.tw  = event.params.tw;
  c.hk  = event.params.hk;
  c.kjc = event.params.kjc;
  c.save();
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  const c = getOrCreateCollector(event.address);
  c.owner = event.params.newOwner;
  c.save();
}
