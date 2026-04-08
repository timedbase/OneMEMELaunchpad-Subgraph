import { BigInt } from "@graphprotocol/graph-ts";
import {
  VestingAdded,
  Claimed,
  VestingVoided,
} from "../generated/VestingWallet/VestingWallet";
import { VestingSchedule, VestingClaim } from "../generated/schema";

// VestingSchedule ID = token address + beneficiary address (40 bytes total).
function scheduleId(token: Uint8Array, beneficiary: Uint8Array): Uint8Array {
  const id = new Uint8Array(40);
  for (let i = 0; i < 20; i++) id[i]      = token[i];
  for (let i = 0; i < 20; i++) id[20 + i] = beneficiary[i];
  return id;
}

export function handleVestingAdded(event: VestingAdded): void {
  const id = event.params.token.concat(event.params.beneficiary);

  let schedule = VestingSchedule.load(id);
  if (schedule == null) {
    schedule = new VestingSchedule(id);
  }
  schedule.token       = event.params.token;
  schedule.beneficiary = event.params.beneficiary;
  schedule.amount      = event.params.amount;
  schedule.claimed     = BigInt.fromI32(0);
  schedule.voided      = false;
  schedule.createdAtTimestamp   = event.block.timestamp;
  schedule.createdAtBlockNumber = event.block.number;
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

  schedule.voided      = true;
  schedule.burnedOnVoid = event.params.burned;
  schedule.save();
}
