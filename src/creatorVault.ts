import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  VestingAdded,
  Claimed,
  VestingVoided,
  PositionRegistered,
  FeesClaimed,
  PlatformWalletSet,
  CharityWalletSet,
  FeeBpsUpdated,
  OwnershipTransferred,
  LaunchManagerUpdated,
} from "../generated/CreatorVault/CreatorVault";
import { VestingSchedule, VestingClaim, CreatorVaultPosition, CreatorVaultFeeClaim, CreatorVaultState } from "../generated/schema";

function getOrCreateVaultState(address: Bytes): CreatorVaultState {
  let state = CreatorVaultState.load(address);
  if (state == null) {
    state = new CreatorVaultState(address);
    state.save();
  }
  return state as CreatorVaultState;
}

export function handleVestingAdded(event: VestingAdded): void {
  const id = event.params.token.concat(event.params.beneficiary);

  let schedule = VestingSchedule.load(id);
  if (schedule == null) {
    schedule = new VestingSchedule(id);
  }
  schedule.claimed  = BigInt.fromI32(0);
  schedule.token       = event.params.token;
  schedule.beneficiary = event.params.beneficiary;
  schedule.amount      = event.params.amount;
  schedule.duration    = event.params.duration;
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

export function handlePositionRegistered(event: PositionRegistered): void {
  const id = event.params.token as Bytes;

  let pos = CreatorVaultPosition.load(id);
  if (pos != null) return; // already registered (shouldn't happen)

  pos = new CreatorVaultPosition(id);
  pos.token           = event.params.token;
  pos.tokenId         = event.params.tokenId;
  pos.feeWallet       = event.params.feeWallet;
  pos.pool            = event.params.pool;
  pos.positionManager = event.params.positionManager;

  pos.totalCreatorFees0  = BigInt.fromI32(0);
  pos.totalCreatorFees1  = BigInt.fromI32(0);
  pos.totalPlatformFees0 = BigInt.fromI32(0);
  pos.totalPlatformFees1 = BigInt.fromI32(0);
  pos.totalCharityFees0  = BigInt.fromI32(0);
  pos.totalCharityFees1  = BigInt.fromI32(0);
  pos.claimCount         = BigInt.fromI32(0);

  pos.registeredAtTimestamp   = event.block.timestamp;
  pos.registeredAtBlockNumber = event.block.number;
  pos.registeredTxHash        = event.transaction.hash;
  pos.save();
}

export function handleFeesClaimed(event: FeesClaimed): void {
  const id = event.params.token as Bytes;
  const pos = CreatorVaultPosition.load(id);
  if (pos == null) return;

  const claimId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const claim   = new CreatorVaultFeeClaim(claimId);
  claim.position  = id;
  claim.token     = event.params.token;
  claim.feeWallet = event.params.feeWallet;
  claim.creator0  = event.params.creator0;
  claim.creator1  = event.params.creator1;
  claim.platform0 = event.params.platform0;
  claim.platform1 = event.params.platform1;
  claim.charity0  = event.params.charity0;
  claim.charity1  = event.params.charity1;
  claim.timestamp   = event.block.timestamp;
  claim.blockNumber = event.block.number;
  claim.txHash      = event.transaction.hash;
  claim.save();

  pos.totalCreatorFees0  = pos.totalCreatorFees0.plus(event.params.creator0);
  pos.totalCreatorFees1  = pos.totalCreatorFees1.plus(event.params.creator1);
  pos.totalPlatformFees0 = pos.totalPlatformFees0.plus(event.params.platform0);
  pos.totalPlatformFees1 = pos.totalPlatformFees1.plus(event.params.platform1);
  pos.totalCharityFees0  = pos.totalCharityFees0.plus(event.params.charity0);
  pos.totalCharityFees1  = pos.totalCharityFees1.plus(event.params.charity1);
  pos.claimCount         = pos.claimCount.plus(BigInt.fromI32(1));
  pos.save();
}

export function handlePlatformWalletSet(event: PlatformWalletSet): void {
  const state = getOrCreateVaultState(event.address);
  state.platformWallet = event.params.wallet;
  state.save();
}

export function handleCharityWalletSet(event: CharityWalletSet): void {
  const state = getOrCreateVaultState(event.address);
  state.charityWallet = event.params.wallet;
  state.save();
}

export function handleFeeBpsUpdated(event: FeeBpsUpdated): void {
  const state = getOrCreateVaultState(event.address);
  state.creatorBps  = event.params.creatorBps;
  state.platformBps = event.params.platformBps;
  state.charityBps  = event.params.charityBps;
  state.save();
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  const state = getOrCreateVaultState(event.address);
  state.owner = event.params.next;
  state.save();
}

export function handleLaunchManagerUpdated(event: LaunchManagerUpdated): void {
  const state = getOrCreateVaultState(event.address);
  state.launchManager = event.params.next;
  state.save();
}
