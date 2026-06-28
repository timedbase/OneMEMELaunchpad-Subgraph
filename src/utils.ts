import { BigInt, Bytes, ipfs, json, JSONValueKind } from "@graphprotocol/graph-ts";
import { Factory, Token } from "../generated/schema";

// getSpotPrice() returns type(uint256).max when bcTokensPool == 0 (token fully migrated).
// Any real bonding-curve price will be far below this sentinel value.
export const MAX_SPOT_PRICE = BigInt.fromString("1000000000000000000000000000000000000"); // 1e36

// Singleton ID for the Factory entity — not an actual address, just a stable key.
export const FACTORY_ID = Bytes.fromUTF8("factory");

// Function selectors for the new Launchpad contract.
// createToken((string,string,uint256,uint256,uint256,uint256,uint256,uint256,bool,uint256,uint256,string,bytes32))
export const SELECTOR_CREATE_TOKEN = "9c3ec1f1"; // createToken (STANDARD)
// createTT((string,string,string,uint256,uint256,uint256,uint256,uint256,uint256,bool,uint256,uint256,bytes32))
export const SELECTOR_CREATE_TT    = "49fa14cf"; // createTT    (TAX)
// createRFL((string,string,string,uint256,uint256,uint256,uint256,uint256,uint256,bool,uint256,uint256,bytes32))
export const SELECTOR_CREATE_RFL   = "782ef0a7"; // createRFL   (REFLECTION)

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
    factory.owner                 = Bytes.empty();
    factory.platformFeeBps        = BigInt.fromI32(0);
    factory.charityFeeBps         = BigInt.fromI32(0);
    factory.feeRecipient          = null;
    factory.charityWallet         = null;
    factory.router                = null;
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

export function loadIpfsMetadata(token: Token, uri: string): void {
  const path = uri.startsWith("ipfs://") ? uri.slice(7) : uri;
  const data = ipfs.cat(path);
  if (!data) return;

  const result = json.try_fromBytes(data as Bytes);
  if (result.isError) return;

  const obj = result.value.toObject();

  const descVal = obj.get("description");
  if (descVal && descVal.kind == JSONValueKind.STRING) token.description = descVal.toString();

  const imageVal = obj.get("image");
  if (imageVal && imageVal.kind == JSONValueKind.STRING) {
    let img = imageVal.toString();
    if (img.startsWith("ipfs://")) img = img.slice(7);
    token.image = img;
  }

  const websiteVal = obj.get("website");
  if (websiteVal && websiteVal.kind == JSONValueKind.STRING) token.website = websiteVal.toString();

  const twitterVal = obj.get("twitter");
  if (twitterVal && twitterVal.kind == JSONValueKind.STRING) token.twitter = twitterVal.toString();

  const telegramVal = obj.get("telegram");
  if (telegramVal && telegramVal.kind == JSONValueKind.STRING) token.telegram = telegramVal.toString();

  const socialsVal = obj.get("socials");
  if (socialsVal && socialsVal.kind == JSONValueKind.OBJECT) {
    const socials = socialsVal.toObject();
    if (!token.website) {
      const v = socials.get("website");
      if (v && v.kind == JSONValueKind.STRING) token.website = v.toString();
    }
    if (!token.twitter) {
      const v = socials.get("twitter");
      if (v && v.kind == JSONValueKind.STRING) token.twitter = v.toString();
    }
    if (!token.telegram) {
      const v = socials.get("telegram");
      if (v && v.kind == JSONValueKind.STRING) token.telegram = v.toString();
    }
  }
}
