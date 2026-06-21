import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  TokenLaunched,
  DexAdded,
  DexDisabled,
  QuoteTokenAdded,
  QuoteTokenDisabled,
} from "../generated/SparkLauncher/SparkLauncher";
import { SparkLauncher as SparkLauncherContract } from "../generated/SparkLauncher/SparkLauncher";
import { SparkToken as SparkTokenContract } from "../generated/SparkLauncher/SparkToken";
import {
  SparkLaunchedToken,
  SparkDex,
  SparkQuoteToken,
} from "../generated/schema";

// Seed the constructor-set WETH quote token (no QuoteTokenAdded event is emitted for it).
// Called the first time a DexAdded event is processed (i.e. from the constructor).
function seedWethQuoteToken(launcherAddress: Address): void {
  const launcher = SparkLauncherContract.bind(launcherAddress);
  const wethResult = launcher.try_weth();
  if (wethResult.reverted) return;

  const wethAddr = wethResult.value;
  if (SparkQuoteToken.load(wethAddr) != null) return; // already seeded

  // The constructor hardcodes launchFee = 0.0005 ETH = 5e14 wei, decimals = 18, isNative = true.
  // Any subsequent change emits QuoteTokenAdded, which handleQuoteTokenAdded will catch.
  const qt = new SparkQuoteToken(wethAddr);
  qt.launchFee = BigInt.fromString("500000000000000");
  qt.decimals  = 18;
  qt.enabled   = true;
  qt.isNative  = true;
  qt.save();
}

export function handleTokenLaunched(event: TokenLaunched): void {
  const sparkToken = new SparkLaunchedToken(event.params.token);

  const tokenContract  = SparkTokenContract.bind(event.params.token);
  const nameResult     = tokenContract.try_name();
  const symbolResult   = tokenContract.try_symbol();
  const metaResult     = tokenContract.try_metaURI();
  if (!nameResult.reverted)   sparkToken.name    = nameResult.value;
  if (!symbolResult.reverted) sparkToken.symbol  = symbolResult.value;
  if (!metaResult.reverted)   sparkToken.metaURI = metaResult.value;

  sparkToken.creator    = event.params.creator;
  sparkToken.factory    = event.params.factory;
  sparkToken.quoteToken = event.params.quoteToken;
  sparkToken.feeWallet  = event.params.feeWallet;
  sparkToken.pool       = event.params.pool;
  sparkToken.tokenId    = event.params.tokenId;

  // Derive positionManager from the registered DEX entry (written by handleDexAdded).
  const dex = SparkDex.load(event.params.factory);
  sparkToken.positionManager = dex != null
    ? dex.positionManager
    : Bytes.empty();

  // Determine Uniswap V3 pair ordering: token0 is the lower address.
  const tokenHex     = event.params.token.toHexString();
  const quoteHex     = event.params.quoteToken.toHexString();
  const tokenIsLower = tokenHex < quoteHex;
  sparkToken.token0  = tokenIsLower ? event.params.token     : event.params.quoteToken;
  sparkToken.token1  = tokenIsLower ? event.params.quoteToken : event.params.token;

  sparkToken.totalCreatorFees0  = BigInt.fromI32(0);
  sparkToken.totalCreatorFees1  = BigInt.fromI32(0);
  sparkToken.totalPlatformFees0 = BigInt.fromI32(0);
  sparkToken.totalPlatformFees1 = BigInt.fromI32(0);
  sparkToken.totalCharityFees0  = BigInt.fromI32(0);
  sparkToken.totalCharityFees1  = BigInt.fromI32(0);
  sparkToken.claimCount         = BigInt.fromI32(0);
  sparkToken.lpWithdrawn        = false;

  sparkToken.createdAtTimestamp   = event.block.timestamp;
  sparkToken.createdAtBlockNumber = event.block.number;
  sparkToken.txHash               = event.transaction.hash;
  sparkToken.save();
}

export function handleDexAdded(event: DexAdded): void {
  let dex = SparkDex.load(event.params.factory);
  const isFirst = dex == null;
  if (isFirst) {
    dex = new SparkDex(event.params.factory);
    dex.addedAtTimestamp   = event.block.timestamp;
    dex.addedAtBlockNumber = event.block.number;
  }
  dex.positionManager = event.params.positionManager;
  dex.router          = event.params.router;
  dex.enabled         = true;
  dex.save();

  // The constructor emits DexAdded but never emits QuoteTokenAdded for the initial WETH
  // quote token. Seed it here on the very first DexAdded event we ever see.
  if (isFirst) seedWethQuoteToken(event.address);
}

export function handleDexDisabled(event: DexDisabled): void {
  const dex = SparkDex.load(event.params.factory);
  if (dex == null) return;
  dex.enabled = false;
  dex.save();
}

export function handleQuoteTokenAdded(event: QuoteTokenAdded): void {
  let qt = SparkQuoteToken.load(event.params.token);
  if (qt == null) qt = new SparkQuoteToken(event.params.token);
  qt.launchFee = event.params.fee;
  qt.decimals  = event.params.decimals;
  qt.enabled   = true;

  // Determine isNative by comparing to the launcher's WETH address.
  const launcher   = SparkLauncherContract.bind(event.address);
  const wethResult = launcher.try_weth();
  qt.isNative = !wethResult.reverted &&
    event.params.token.toHexString() == wethResult.value.toHexString();

  qt.save();
}

export function handleQuoteTokenDisabled(event: QuoteTokenDisabled): void {
  const qt = SparkQuoteToken.load(event.params.token);
  if (qt == null) return;
  qt.enabled = false;
  qt.save();
}
