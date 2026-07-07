import { Address, BigDecimal, BigInt, Bytes, ipfs, json, JSONValueKind } from "@graphprotocol/graph-ts";
import { Factory, Token, TokenSnapshot, TokenPeriodStats, SparkLaunchedToken, SparkTokenSnapshot, SparkTokenPeriodStats, NativeUsdPrice } from "../generated/schema";

// getSpotPrice() returns type(uint256).max when bcTokensPool == 0 (token fully migrated).
// Any real bonding-curve price will be far below this sentinel value.
export const MAX_SPOT_PRICE = BigInt.fromString("1000000000000000000000000000000000000"); // 1e36

export const ZERO    = BigInt.fromI32(0);
export const ONE_E18 = BigInt.fromString("1000000000000000000");

// 2^192 — denominator for converting a Uniswap/PancakeSwap V3 sqrtPriceX96 into price1per0.
const Q192 = BigDecimal.fromString("6277101735386680763835789423207666416102355444464034512896");
const ONE_E18_DECIMAL = BigDecimal.fromString("1000000000000000000");

// Singleton ID for the Factory entity — not an actual address, just a stable key.
export const FACTORY_ID = Bytes.fromUTF8("factory");

// Singleton ID for the NativeUsdPrice entity — not an actual address, just a stable key.
export const NATIVE_USD_ID = Bytes.fromUTF8("native");

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
    factory.minCurveBps           = null;
    factory.minLiquidityBps       = null;
    factory.maxCreatorBps         = null;
    factory.minSupply             = null;
    factory.maxSupply             = null;
    factory.latestImplType        = null;
    factory.latestImpl            = null;
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

// ── Price / market cap math ──────────────────────────────────────────────────

export function bigIntMax(a: BigInt, b: BigInt): BigInt {
  return a.gt(b) ? a : b;
}

export function bigIntMin(a: BigInt, b: BigInt): BigInt {
  return a.lt(b) ? a : b;
}

// AMM spot price: (virtualBNB + raisedBNB) × 1e18 / bcTokensPool — bonding-curve phase only.
export function computePrice(virtualBNB: BigInt, raisedBNB: BigInt, bcTokensPool: BigInt): BigInt {
  if (bcTokensPool.equals(ZERO)) return ZERO;
  return virtualBNB.plus(raisedBNB).times(ONE_E18).div(bcTokensPool);
}

// price × totalSupply / 1e18 — same "wei, scaled ×1e18" convention as lastKnownPrice.
export function computeMarketCap(price: BigInt, totalSupply: BigInt): BigInt {
  return price.times(totalSupply).div(ONE_E18);
}

// Current native/USD rate (scaled ×1e18), or null before the oracle has seen its first swap.
export function getNativeUsdPrice(): BigInt | null {
  const oracle = NativeUsdPrice.load(NATIVE_USD_ID);
  return oracle === null ? null : oracle.price;
}

// nativePrice (wei-of-native per whole token, scaled ×1e18) → USD value, scaled ×1e18.
// Null whenever the oracle hasn't produced a rate yet.
export function computePriceUSD(nativePrice: BigInt): BigInt | null {
  const rate = getNativeUsdPrice();
  if (rate === null) return null;
  return nativePrice.times(rate as BigInt).div(ONE_E18);
}

// Sets priceUSD/marketCapUSD on a Token from the current native/USD oracle rate; both
// stay null until the oracle has processed at least one Sync event.
export function applyUsdPricing(token: Token, nativePrice: BigInt): void {
  const usd = computePriceUSD(nativePrice);
  token.priceUSD = usd;
  token.marketCapUSD = usd === null ? null : computeMarketCap(usd as BigInt, token.totalSupply);
}

// Same as applyUsdPricing() but for SparkLaunchedToken — distinct generated entity class,
// no shared base to generify over in AssemblyScript.
export function applySparkUsdPricing(token: SparkLaunchedToken, nativePrice: BigInt): void {
  const usd = computePriceUSD(nativePrice);
  token.priceUSD = usd;
  token.marketCapUSD = usd === null ? null : computeMarketCap(usd as BigInt, token.totalSupply);
}

// Converts a Uniswap/PancakeSwap V3 sqrtPriceX96 into a spot price scaled ×1e18,
// expressed as "quote-asset wei per whole tracked-token", matching the same
// convention as the bonding-curve computePrice() above.
export function sqrtPriceX96ToPrice(sqrtPriceX96: BigInt, trackedIsToken0: boolean): BigInt {
  if (sqrtPriceX96.equals(ZERO)) return ZERO;
  const sqrtP = sqrtPriceX96.toBigDecimal();
  const price1per0 = sqrtP.times(sqrtP).div(Q192); // token1 per token0
  if (price1per0.equals(BigDecimal.zero())) return ZERO;
  const priceQuotePerTracked = trackedIsToken0 ? price1per0 : BigDecimal.fromString("1").div(price1per0);
  const scaled = priceQuotePerTracked.times(ONE_E18_DECIMAL);
  return BigInt.fromString(scaled.truncate(0).toString());
}

// Reserve-ratio spot price for a standard (18-decimal on both sides) V2 pair,
// scaled ×1e18 — same convention as computePrice()/sqrtPriceX96ToPrice().
export function reservesToPrice(quoteReserve: BigInt, trackedReserve: BigInt): BigInt {
  if (trackedReserve.equals(ZERO)) return ZERO;
  return quoteReserve.times(ONE_E18).div(trackedReserve);
}

// ── OHLCV snapshot / period-bucket upserts (Token / Spark share the same shape;
// Token's use the generated TokenSnapshot/TokenPeriodStats entities directly) ──

// Seed one TokenPeriodStats bucket per period at token launch so charts always have a
// starting data point even when no trades have occurred yet.
export function seedLaunchChartData(tokenAddr: Address, blockNumber: BigInt, timestamp: BigInt, launchPrice: BigInt): void {
  // Genesis per-block snapshot — one data point at the creation block.
  const snapshotId = tokenAddr.concatI32(blockNumber.toI32());
  if (TokenSnapshot.load(snapshotId) == null) {
    const snap         = new TokenSnapshot(snapshotId);
    snap.token         = tokenAddr;
    snap.blockNumber   = blockNumber;
    snap.timestamp     = timestamp;
    snap.openRaisedBNB  = ZERO;
    snap.closeRaisedBNB = ZERO;
    snap.openPrice  = launchPrice;
    snap.highPrice  = launchPrice;
    snap.lowPrice   = launchPrice;
    snap.closePrice = launchPrice;
    snap.volumeBNB  = ZERO;
    snap.buyCount   = 0;
    snap.sellCount  = 0;
    snap.save();
  }

  // One seed bucket per time window so time-weighted charts have data immediately.
  const periods:   string[] = ["5m",  "45m",  "1h",   "1d",    "7d"];
  const durations: i32[]    = [300,   2700,   3600,   86400,   604800];
  for (let i = 0; i < periods.length; i++) {
    const dur      = durations[i];
    const bucketId = timestamp.div(BigInt.fromI32(dur)).toI32();
    const statId   = tokenAddr.concat(Bytes.fromUTF8(periods[i])).concatI32(bucketId);
    if (TokenPeriodStats.load(statId) != null) continue; // already created by a concurrent trade
    const stat         = new TokenPeriodStats(statId);
    stat.token         = tokenAddr;
    stat.period        = periods[i];
    stat.bucketId      = BigInt.fromI32(bucketId);
    stat.periodStart   = BigInt.fromI32(bucketId).times(BigInt.fromI32(dur));
    stat.openRaisedBNB  = ZERO;
    stat.closeRaisedBNB = ZERO;
    stat.buyVolumeBNB  = ZERO;
    stat.sellVolumeBNB = ZERO;
    stat.volumeBNB     = ZERO;
    stat.buysCount     = ZERO;
    stat.sellsCount    = ZERO;
    stat.openPrice  = launchPrice;
    stat.highPrice  = launchPrice;
    stat.lowPrice   = launchPrice;
    stat.closePrice = launchPrice;
    stat.save();
  }
}

function upsertOnePeriodStat(
  tokenAddr: Address,
  period: string,
  duration: i32,
  timestamp: BigInt,
  preRaisedBNB: BigInt,
  postRaisedBNB: BigInt,
  bnbAmount: BigInt,
  isBuy: boolean,
  openPrice: BigInt,
  closePrice: BigInt
): void {
  const bucketId = timestamp.div(BigInt.fromI32(duration)).toI32();
  const id = tokenAddr.concat(Bytes.fromUTF8(period)).concatI32(bucketId);

  let stats = TokenPeriodStats.load(id);
  if (stats == null) {
    stats = new TokenPeriodStats(id);
    stats.token         = tokenAddr;
    stats.period        = period;
    stats.bucketId      = BigInt.fromI32(bucketId);
    stats.periodStart   = BigInt.fromI32(bucketId).times(BigInt.fromI32(duration));
    stats.buyVolumeBNB  = ZERO;
    stats.sellVolumeBNB = ZERO;
    stats.volumeBNB     = ZERO;
    stats.buysCount     = ZERO;
    stats.sellsCount    = ZERO;
    stats.openRaisedBNB  = preRaisedBNB;
    stats.closeRaisedBNB = preRaisedBNB;
    stats.openPrice  = openPrice;
    stats.highPrice  = bigIntMax(openPrice, closePrice);
    stats.lowPrice   = bigIntMin(openPrice, closePrice);
    stats.closePrice = closePrice;
  } else {
    stats.highPrice  = bigIntMax(stats.highPrice, closePrice);
    stats.lowPrice   = bigIntMin(stats.lowPrice, closePrice);
    stats.closePrice = closePrice;
  }
  stats.closeRaisedBNB = postRaisedBNB;
  stats.volumeBNB      = stats.volumeBNB.plus(bnbAmount);
  if (isBuy) {
    stats.buyVolumeBNB = stats.buyVolumeBNB.plus(bnbAmount);
    stats.buysCount    = stats.buysCount.plus(BigInt.fromI32(1));
  } else {
    stats.sellVolumeBNB = stats.sellVolumeBNB.plus(bnbAmount);
    stats.sellsCount    = stats.sellsCount.plus(BigInt.fromI32(1));
  }
  stats.save();
}

export function upsertAllPeriodStats(
  tokenAddr: Address,
  timestamp: BigInt,
  preRaisedBNB: BigInt,
  postRaisedBNB: BigInt,
  bnbAmount: BigInt,
  isBuy: boolean,
  openPrice: BigInt,
  closePrice: BigInt
): void {
  upsertOnePeriodStat(tokenAddr, "5m",  300,    timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy, openPrice, closePrice);
  upsertOnePeriodStat(tokenAddr, "45m", 2700,   timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy, openPrice, closePrice);
  upsertOnePeriodStat(tokenAddr, "1h",  3600,   timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy, openPrice, closePrice);
  upsertOnePeriodStat(tokenAddr, "1d",  86400,  timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy, openPrice, closePrice);
  upsertOnePeriodStat(tokenAddr, "7d",  604800, timestamp, preRaisedBNB, postRaisedBNB, bnbAmount, isBuy, openPrice, closePrice);
}

export function upsertSnapshot(
  tokenAddr: Address,
  blockNumber: BigInt,
  timestamp: BigInt,
  preTradeRaisedBNB: BigInt,
  postTradeRaisedBNB: BigInt,
  bnbAmount: BigInt,
  isBuy: boolean,
  openPrice: BigInt,
  closePrice: BigInt
): void {
  const snapshotId = tokenAddr.concatI32(blockNumber.toI32());
  let snapshot = TokenSnapshot.load(snapshotId);
  if (snapshot == null) {
    snapshot = new TokenSnapshot(snapshotId);
    snapshot.token          = tokenAddr;
    snapshot.blockNumber    = blockNumber;
    snapshot.timestamp      = timestamp;
    snapshot.openRaisedBNB  = preTradeRaisedBNB;
    snapshot.closeRaisedBNB = preTradeRaisedBNB;
    snapshot.volumeBNB      = ZERO;
    snapshot.buyCount       = 0;
    snapshot.sellCount      = 0;
    snapshot.openPrice  = openPrice;
    snapshot.highPrice  = bigIntMax(openPrice, closePrice);
    snapshot.lowPrice   = bigIntMin(openPrice, closePrice);
    snapshot.closePrice = closePrice;
  } else {
    snapshot.highPrice  = bigIntMax(snapshot.highPrice, closePrice);
    snapshot.lowPrice   = bigIntMin(snapshot.lowPrice, closePrice);
    snapshot.closePrice = closePrice;
  }
  snapshot.closeRaisedBNB = postTradeRaisedBNB;
  snapshot.volumeBNB = snapshot.volumeBNB.plus(bnbAmount);
  if (isBuy) snapshot.buyCount  = snapshot.buyCount  + 1;
  else        snapshot.sellCount = snapshot.sellCount + 1;
  snapshot.save();
}

// ── Spark OHLCV snapshot / period-bucket upserts (mirrors the Token helpers above,
// operating on the distinct SparkTokenSnapshot/SparkTokenPeriodStats entity classes —
// AssemblyScript has no entity generics, so this is a parallel implementation) ──────

export function seedSparkLaunchChartData(tokenAddr: Address, blockNumber: BigInt, timestamp: BigInt, launchPrice: BigInt): void {
  const snapshotId = tokenAddr.concatI32(blockNumber.toI32());
  if (SparkTokenSnapshot.load(snapshotId) == null) {
    const snap        = new SparkTokenSnapshot(snapshotId);
    snap.token        = tokenAddr;
    snap.blockNumber  = blockNumber;
    snap.timestamp    = timestamp;
    snap.openPrice    = launchPrice;
    snap.highPrice    = launchPrice;
    snap.lowPrice     = launchPrice;
    snap.closePrice   = launchPrice;
    snap.volumeQuote  = ZERO;
    snap.buyCount     = 0;
    snap.sellCount    = 0;
    snap.save();
  }

  const periods:   string[] = ["5m",  "45m",  "1h",   "1d",    "7d"];
  const durations: i32[]    = [300,   2700,   3600,   86400,   604800];
  for (let i = 0; i < periods.length; i++) {
    const dur      = durations[i];
    const bucketId = timestamp.div(BigInt.fromI32(dur)).toI32();
    const statId   = tokenAddr.concat(Bytes.fromUTF8(periods[i])).concatI32(bucketId);
    if (SparkTokenPeriodStats.load(statId) != null) continue;
    const stat          = new SparkTokenPeriodStats(statId);
    stat.token          = tokenAddr;
    stat.period         = periods[i];
    stat.bucketId       = BigInt.fromI32(bucketId);
    stat.periodStart    = BigInt.fromI32(bucketId).times(BigInt.fromI32(dur));
    stat.buyVolumeQuote  = ZERO;
    stat.sellVolumeQuote = ZERO;
    stat.volumeQuote     = ZERO;
    stat.buysCount       = ZERO;
    stat.sellsCount      = ZERO;
    stat.openPrice  = launchPrice;
    stat.highPrice  = launchPrice;
    stat.lowPrice   = launchPrice;
    stat.closePrice = launchPrice;
    stat.save();
  }
}

function upsertOneSparkPeriodStat(
  tokenAddr: Address,
  period: string,
  duration: i32,
  timestamp: BigInt,
  quoteAmount: BigInt,
  isBuy: boolean,
  openPrice: BigInt,
  closePrice: BigInt
): void {
  const bucketId = timestamp.div(BigInt.fromI32(duration)).toI32();
  const id = tokenAddr.concat(Bytes.fromUTF8(period)).concatI32(bucketId);

  let stats = SparkTokenPeriodStats.load(id);
  if (stats == null) {
    stats = new SparkTokenPeriodStats(id);
    stats.token          = tokenAddr;
    stats.period         = period;
    stats.bucketId       = BigInt.fromI32(bucketId);
    stats.periodStart    = BigInt.fromI32(bucketId).times(BigInt.fromI32(duration));
    stats.buyVolumeQuote  = ZERO;
    stats.sellVolumeQuote = ZERO;
    stats.volumeQuote     = ZERO;
    stats.buysCount       = ZERO;
    stats.sellsCount      = ZERO;
    stats.openPrice  = openPrice;
    stats.highPrice  = bigIntMax(openPrice, closePrice);
    stats.lowPrice   = bigIntMin(openPrice, closePrice);
    stats.closePrice = closePrice;
  } else {
    stats.highPrice  = bigIntMax(stats.highPrice, closePrice);
    stats.lowPrice   = bigIntMin(stats.lowPrice, closePrice);
    stats.closePrice = closePrice;
  }
  stats.volumeQuote = stats.volumeQuote.plus(quoteAmount);
  if (isBuy) {
    stats.buyVolumeQuote = stats.buyVolumeQuote.plus(quoteAmount);
    stats.buysCount      = stats.buysCount.plus(BigInt.fromI32(1));
  } else {
    stats.sellVolumeQuote = stats.sellVolumeQuote.plus(quoteAmount);
    stats.sellsCount      = stats.sellsCount.plus(BigInt.fromI32(1));
  }
  stats.save();
}

export function upsertAllSparkPeriodStats(
  tokenAddr: Address,
  timestamp: BigInt,
  quoteAmount: BigInt,
  isBuy: boolean,
  openPrice: BigInt,
  closePrice: BigInt
): void {
  upsertOneSparkPeriodStat(tokenAddr, "5m",  300,    timestamp, quoteAmount, isBuy, openPrice, closePrice);
  upsertOneSparkPeriodStat(tokenAddr, "45m", 2700,   timestamp, quoteAmount, isBuy, openPrice, closePrice);
  upsertOneSparkPeriodStat(tokenAddr, "1h",  3600,   timestamp, quoteAmount, isBuy, openPrice, closePrice);
  upsertOneSparkPeriodStat(tokenAddr, "1d",  86400,  timestamp, quoteAmount, isBuy, openPrice, closePrice);
  upsertOneSparkPeriodStat(tokenAddr, "7d",  604800, timestamp, quoteAmount, isBuy, openPrice, closePrice);
}

export function upsertSparkSnapshot(
  tokenAddr: Address,
  blockNumber: BigInt,
  timestamp: BigInt,
  quoteAmount: BigInt,
  isBuy: boolean,
  openPrice: BigInt,
  closePrice: BigInt
): void {
  const snapshotId = tokenAddr.concatI32(blockNumber.toI32());
  let snapshot = SparkTokenSnapshot.load(snapshotId);
  if (snapshot == null) {
    snapshot = new SparkTokenSnapshot(snapshotId);
    snapshot.token       = tokenAddr;
    snapshot.blockNumber = blockNumber;
    snapshot.timestamp   = timestamp;
    snapshot.volumeQuote = ZERO;
    snapshot.buyCount    = 0;
    snapshot.sellCount   = 0;
    snapshot.openPrice  = openPrice;
    snapshot.highPrice  = bigIntMax(openPrice, closePrice);
    snapshot.lowPrice   = bigIntMin(openPrice, closePrice);
    snapshot.closePrice = closePrice;
  } else {
    snapshot.highPrice  = bigIntMax(snapshot.highPrice, closePrice);
    snapshot.lowPrice   = bigIntMin(snapshot.lowPrice, closePrice);
    snapshot.closePrice = closePrice;
  }
  snapshot.volumeQuote = snapshot.volumeQuote.plus(quoteAmount);
  if (isBuy) snapshot.buyCount  = snapshot.buyCount  + 1;
  else        snapshot.sellCount = snapshot.sellCount + 1;
  snapshot.save();
}

// ── IPFS metadata resolution ──────────────────────────────────────────────────

// Plain holder for resolved IPFS metadata fields — entity-agnostic so both Token
// and SparkLaunchedToken (distinct generated entity classes, no shared base) can
// copy the same resolved values onto themselves.
export class IpfsMetadata {
  description: string | null = null;
  image: string | null = null;
  website: string | null = null;
  twitter: string | null = null;
  telegram: string | null = null;
}

export function resolveIpfsMetadata(uri: string): IpfsMetadata {
  const meta = new IpfsMetadata();

  const path = uri.startsWith("ipfs://") ? uri.slice(7) : uri;
  const data = ipfs.cat(path);
  if (!data) return meta;

  const result = json.try_fromBytes(data as Bytes);
  if (result.isError) return meta;

  const obj = result.value.toObject();

  const descVal = obj.get("description");
  if (descVal && descVal.kind == JSONValueKind.STRING) meta.description = descVal.toString();

  const imageVal = obj.get("image");
  if (imageVal && imageVal.kind == JSONValueKind.STRING) {
    let img = imageVal.toString();
    if (img.startsWith("ipfs://")) img = img.slice(7);
    meta.image = img;
  }

  const websiteVal = obj.get("website");
  if (websiteVal && websiteVal.kind == JSONValueKind.STRING) meta.website = websiteVal.toString();

  const twitterVal = obj.get("twitter");
  if (twitterVal && twitterVal.kind == JSONValueKind.STRING) meta.twitter = twitterVal.toString();

  const telegramVal = obj.get("telegram");
  if (telegramVal && telegramVal.kind == JSONValueKind.STRING) meta.telegram = telegramVal.toString();

  const socialsVal = obj.get("socials");
  if (socialsVal && socialsVal.kind == JSONValueKind.OBJECT) {
    const socials = socialsVal.toObject();
    if (!meta.website) {
      const v = socials.get("website");
      if (v && v.kind == JSONValueKind.STRING) meta.website = v.toString();
    }
    if (!meta.twitter) {
      const v = socials.get("twitter");
      if (v && v.kind == JSONValueKind.STRING) meta.twitter = v.toString();
    }
    if (!meta.telegram) {
      const v = socials.get("telegram");
      if (v && v.kind == JSONValueKind.STRING) meta.telegram = v.toString();
    }
  }

  return meta;
}

// Thin wrapper over resolveIpfsMetadata() for the existing Token call sites.
export function loadIpfsMetadata(token: Token, uri: string): void {
  const meta = resolveIpfsMetadata(uri);
  if (meta.description) token.description = meta.description as string;
  if (meta.image)       token.image       = meta.image as string;
  if (meta.website)     token.website     = meta.website as string;
  if (meta.twitter)     token.twitter     = meta.twitter as string;
  if (meta.telegram)    token.telegram    = meta.telegram as string;
}
