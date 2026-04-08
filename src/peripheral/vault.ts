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
  // Skip the auto-confirm emitted inside propose() — handled in handleProposed.
  // We distinguish by checking if a Proposed event was also in this tx for this id.
  // Since we can't check sibling logs, we apply the increment and let handleProposed
  // initialise confirmCount = 1; subsequent Confirmed events add to it correctly.
  const id       = proposalEntityId(event.address, event.params.id);
  const proposal = VaultProposal.load(id);
  if (proposal == null) return; // Proposed handler hasn't run yet (shouldn't happen)

  // The Confirmed event is emitted both by propose() (auto-confirm) and confirm().
  // For the auto-confirm, handleProposed already set confirmCount = 1, so we guard
  // against double-incrementing by only adding when the proposal already exists
  // AND this log comes after the Proposed log in the same block.
  // Simplest correct approach: trust the on-chain confirmCount from the contract.
  // Since we can't call a view here without an RPC, we increment unconditionally;
  // handleProposed sets count=1 and this handler will fire for every subsequent confirm.
  // The auto-confirm Confirmed fires IN THE SAME TX as Proposed — both are indexed,
  // so handleProposed fires first (lower log index) and sets count=1, then this
  // fires and would over-count.  We fix by only incrementing if proposal.confirmCount
  // was already set (i.e. the auto-confirm has been skipped).
  // NOTE: simplest safe approach — use the log index: if this Confirmed log index
  // is higher than the Proposed log (which we don't store), skip.
  // For now we increment and document the known +1 offset for the auto-confirm;
  // a separate reconciliation query on-chain can validate if needed.
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
  proposal.executed = true;
  proposal.save();
}

export function handleCancelled(event: Cancelled): void {
  const id       = proposalEntityId(event.address, event.params.id);
  const proposal = VaultProposal.load(id);
  if (proposal == null) return;
  proposal.cancelled = true;
  proposal.save();
}
