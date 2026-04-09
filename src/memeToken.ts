import { BigInt } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/templates/MemeToken/MemeToken";
import { Holder, Token } from "../generated/schema";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function handleTransfer(event: Transfer): void {
  // event.address is the token contract that emitted the event.
  const tokenAddr = event.address;

  // Stop tracking after migration to avoid indexing high-volume DEX swap traffic.
  const token = Token.load(tokenAddr);
  if (token == null || token.migrated) return;

  const from  = event.params.from;
  const to    = event.params.to;
  const value = event.params.value;

  // Deduct from sender — skip zero address (mint has no sender to debit).
  if (from.toHexString() != ZERO_ADDRESS) {
    const senderId = tokenAddr.concat(from);
    const sender   = Holder.load(senderId);
    if (sender != null) {
      sender.balance = sender.balance.minus(value);
      sender.lastUpdatedBlock     = event.block.number;
      sender.lastUpdatedTimestamp = event.block.timestamp;
      sender.save();
    }
  }

  // Credit receiver — skip zero address (burn has no receiver to credit).
  if (to.toHexString() != ZERO_ADDRESS) {
    const receiverId = tokenAddr.concat(to);
    let receiver     = Holder.load(receiverId);
    if (receiver == null) {
      receiver         = new Holder(receiverId);
      receiver.token   = tokenAddr;
      receiver.address = to;
      receiver.balance = BigInt.fromI32(0);
    }
    receiver.balance = receiver.balance.plus(value);
    receiver.lastUpdatedBlock     = event.block.number;
    receiver.lastUpdatedTimestamp = event.block.timestamp;
    receiver.save();
  }
}
