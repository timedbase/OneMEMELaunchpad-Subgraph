import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { Factory } from "../generated/schema";

// Singleton ID for the Factory entity — not an actual address, just a stable key.
export const FACTORY_ID = Bytes.fromUTF8("factory");

// Function selectors — keccak256(sig).slice(0,4) for each token-creation method.
export const SELECTOR_CREATE_TOKEN = "bc54d40e"; // createToken(BaseParams)
export const SELECTOR_CREATE_TT    = "9d2b1e37"; // createTT(CreateTTParams)
export const SELECTOR_CREATE_RFL   = "101d747c"; // createRFL(CreateRFLParams)

export function getOrCreateFactory(): Factory {
  let factory = Factory.load(FACTORY_ID);
  if (factory == null) {
    factory = new Factory(FACTORY_ID);
    factory.totalTokensCreated    = BigInt.fromI32(0);
    factory.totalStandardTokens   = BigInt.fromI32(0);
    factory.totalTaxTokens        = BigInt.fromI32(0);
    factory.totalReflectionTokens = BigInt.fromI32(0);
    factory.totalUnknownTokens    = BigInt.fromI32(0);
    factory.totalBuys             = BigInt.fromI32(0);
    factory.totalSells            = BigInt.fromI32(0);
    factory.totalMigrations       = BigInt.fromI32(0);
    factory.creationFee           = BigInt.fromI32(0);
    factory.defaultVirtualBNB     = BigInt.fromI32(0);
    factory.defaultMigrationTarget= BigInt.fromI32(0);
    factory.owner                 = Bytes.empty();
    factory.save();
  }
  return factory as Factory;
}

export function detectTokenType(txInput: Bytes): string {
  if (txInput.length < 4) return "UNKNOWN";
  const selector = txInput.toHexString().slice(2, 10).toLowerCase();
  if (selector == SELECTOR_CREATE_TOKEN) return "STANDARD";
  if (selector == SELECTOR_CREATE_TT)   return "TAX";
  if (selector == SELECTOR_CREATE_RFL)  return "REFLECTION";
  return "UNKNOWN";
}
