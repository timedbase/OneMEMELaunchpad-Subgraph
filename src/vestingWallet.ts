import { BigInt } from "@graphprotocol/graph-ts";
import {
  VestingAdded,
  Claimed,
  VestingVoided,
} from "../generated/VestingWallet/VestingWallet";
import { VestingSchedule, VestingClaim } from "../generated/schema";

export function handleVestingAdded(event: VestingAdded): void {
  const id = event.params.token.concat(event.params.beneficiary);

  let schedule = VestingSchedule.load(id);
  if (schedule == null) {
    schedule = new VestingSchedule(id);
  }
  // VestingAdded always represents a fresh on-chain schedule (the contract reverts if one already
  // exists and the previous one must have been voided first, which zeros s.claimed on-chain).
  // Always reset claimed here so a re-created schedule doesn't carry over stale claim history.
  schedule.claimed = BigInt.fromI32(0);
  schedule.token       = event.params.token;
  schedule.beneficiary = event.params.beneficiary;
  schedule.amount      = event.params.amount;
  schedule.voided       = false;
  schedule.burnedOnVoid = null;
  schedule.voidedTxHash = null;
  schedule.createdAtTimestamp   = event.block.timestamp;
  schedule.createdAtBlockNumber = event.block.number;
  schedule.txHash               = event.transaction.hash;
  schedule.save();
}

export function handleClaimed(event: Claimed): void {
  const id = event.params.token.concat(event.params.beneficiary);

  const schedule = VestingSchedule.load(id);
  if (schedule == null) return;

  schedule.claimed = schedule.claimed.plus(event.params.amount);
  schedule.save();

  const claimId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const claim   = new VestingClaim(claimId);
  claim.schedule    = id;
  claim.amount      = event.params.amount;
  claim.timestamp   = event.block.timestamp;
  claim.blockNumber = event.block.number;
  claim.txHash      = event.transaction.hash;
  claim.save();
}

export function handleVestingVoided(event: VestingVoided): void {
  const id = event.params.token.concat(event.params.beneficiary);

  const schedule = VestingSchedule.load(id);
  if (schedule == null) return;

  schedule.voided       = true;
  schedule.burnedOnVoid = event.params.burned;
  schedule.voidedTxHash = event.transaction.hash;
  schedule.save();
}
