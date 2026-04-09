import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  Proposed,
  Confirmed,
  Revoked,
  Executed,
  Cancelled,
} from "../../generated/Vault/Vault";
import { VaultContract, VaultProposal } from "../../generated/schema";

function getOrCreateVault(address: Bytes): VaultContract {
  let vault = VaultContract.load(address);
  if (vault == null) {
    vault = new VaultContract(address);
    vault.proposalCount = BigInt.fromI32(0);
    vault.save();
  }
  return vault as VaultContract;
}

// Proposal ID = vault address (20 bytes) + proposalId (32 bytes big-endian).
function proposalEntityId(vaultAddress: Bytes, proposalId: BigInt): Bytes {
  return vaultAddress.concat(Bytes.fromByteArray(Bytes.fromBigInt(proposalId)));
}

export function handleProposed(event: Proposed): void {
  const vault = getOrCreateVault(event.address);
  vault.proposalCount = vault.proposalCount.plus(BigInt.fromI32(1));
  vault.save();

  const id       = proposalEntityId(event.address, event.params.id);
  const proposal = new VaultProposal(id);
  proposal.vault              = event.address;
  proposal.proposalId         = event.params.id;
  proposal.to                 = event.params.to;
  proposal.value              = event.params.value;
  proposal.data               = event.params.data;
  proposal.proposer           = event.params.proposer;
  proposal.confirmCount       = 1; // proposer auto-confirms on creation
  proposal.executed           = false;
  proposal.cancelled          = false;
  proposal.createdAtTimestamp   = event.block.timestamp;
  proposal.createdAtBlockNumber = event.block.number;
  proposal.txHash             = event.transaction.hash;
  proposal.save();
}

export function handleConfirmed(event: Confirmed): void {
  const id       = proposalEntityId(event.address, event.params.id);
  const proposal = VaultProposal.load(id);
  if (proposal == null) return;

  // propose() emits Confirmed in the same tx as Proposed (proposer auto-confirm).
  // handleProposed already initialises confirmCount = 1 for that confirm, so we
  // skip this event when it originates from the same transaction to avoid
  // double-counting.
  // Note: Bytes == Bytes is a pointer comparison in AS — must compare hex strings.
  if (event.transaction.hash.toHexString() == proposal.txHash.toHexString()) return;

  proposal.confirmCount = proposal.confirmCount + 1;
  proposal.save();
}

export function handleRevoked(event: Revoked): void {
  const id       = proposalEntityId(event.address, event.params.id);
  const proposal = VaultProposal.load(id);
  if (proposal == null) return;
  if (proposal.confirmCount > 0) proposal.confirmCount = proposal.confirmCount - 1;
  proposal.save();
}

export function handleExecuted(event: Executed): void {
  const id       = proposalEntityId(event.address, event.params.id);
  const proposal = VaultProposal.load(id);
  if (proposal == null) return;
  proposal.executed        = true;
  proposal.executedTxHash  = event.transaction.hash;
  proposal.save();
}

export function handleCancelled(event: Cancelled): void {
  const id       = proposalEntityId(event.address, event.params.id);
  const proposal = VaultProposal.load(id);
  if (proposal == null) return;
  proposal.cancelled       = true;
  proposal.cancelledTxHash = event.transaction.hash;
  proposal.save();
}
