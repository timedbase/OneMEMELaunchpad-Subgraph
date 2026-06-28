import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  TokenLaunched,
  DexAdded,
  DexDisabled,
  QuoteTokenAdded,
  QuoteTokenDisabled,
  LaunchFeeSet,
  LaunchFeeWalletSet,
  MarketCapRefSet,
  ETHRescued,
  ERC20Rescued,
} from "../generated/SparkLauncher/SparkLauncher";
import { SparkLauncher as SparkLauncherContract } from "../generated/SparkLauncher/SparkLauncher";
import { SparkToken as SparkTokenContract } from "../generated/SparkLauncher/SparkToken";
import {
  SparkLaunchedToken,
  SparkDex,
  SparkQuoteToken,
  SparkPool,
  SparkLauncherState,
} from "../generated/schema";
import { UniswapV3Pool, SparkToken as SparkTokenTemplate } from "../generated/templates";

function getOrCreateLauncherState(contractAddr: Address): SparkLauncherState {
  const id = contractAddr as Bytes;
  let state = SparkLauncherState.load(id);
  if (state != null) return state as SparkLauncherState;

  const launcher = SparkLauncherContract.bind(contractAddr);

  state = new SparkLauncherState(id);

  const feeResult    = launcher.try_launchFee();
  const walletResult = launcher.try_launchFeeWallet();

  state.launchFee         = feeResult.reverted   ? BigInt.fromI32(0) : feeResult.value;
  state.launchFeeWallet   = walletResult.reverted ? Bytes.empty()    : walletResult.value;
  state.totalETHRescued   = BigInt.fromI32(0);
  state.totalERC20Rescued = BigInt.fromI32(0);
  state.save();
  return state as SparkLauncherState;
}

// The constructor seeds WETH with no QuoteTokenAdded event. Bootstrap it here on the
// first DexAdded (which IS emitted from the constructor).
function seedWethQuoteToken(launcherAddress: Address): void {
  const launcher = SparkLauncherContract.bind(launcherAddress);
  const wethResult = launcher.try_weth();
  if (wethResult.reverted) return;

  const wethAddr = wethResult.value;
  if (SparkQuoteToken.load(wethAddr) != null) return; // already seeded

  const qt = new SparkQuoteToken(wethAddr);
  qt.marketCapRef = BigInt.fromString("5000000000000000000"); // 5e18 — default from constructor
  qt.wethPairFee  = 0; // unused for WETH itself
  qt.enabled      = true;
  qt.isNative     = true;
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

  const dex = SparkDex.load(event.params.factory);
  sparkToken.positionManager = dex != null
    ? dex.positionManager
    : Bytes.empty();

  const tokenHex     = event.params.token.toHexString();
  const quoteHex     = event.params.quoteToken.toHexString();
  const tokenIsLower = tokenHex < quoteHex;
  sparkToken.token0  = tokenIsLower ? event.params.token      : event.params.quoteToken;
  sparkToken.token1  = tokenIsLower ? event.params.quoteToken : event.params.token;

  sparkToken.totalCreatorFees0  = BigInt.fromI32(0);
  sparkToken.totalCreatorFees1  = BigInt.fromI32(0);
  sparkToken.totalPlatformFees0 = BigInt.fromI32(0);
  sparkToken.totalPlatformFees1 = BigInt.fromI32(0);
  sparkToken.totalCharityFees0  = BigInt.fromI32(0);
  sparkToken.totalCharityFees1  = BigInt.fromI32(0);
  sparkToken.claimCount         = BigInt.fromI32(0);
  sparkToken.lpWithdrawn        = false;

  sparkToken.tradeCount       = BigInt.fromI32(0);
  sparkToken.totalVolumeToken = BigInt.fromI32(0);
  sparkToken.totalVolumeQuote = BigInt.fromI32(0);

  sparkToken.createdAtTimestamp   = event.block.timestamp;
  sparkToken.createdAtBlockNumber = event.block.number;
  sparkToken.txHash               = event.transaction.hash;
  sparkToken.save();

  const pool = new SparkPool(event.params.pool);
  pool.token         = event.params.token;
  pool.sparkIsToken0 = tokenIsLower;
  pool.save();

  UniswapV3Pool.create(event.params.pool);
  SparkTokenTemplate.create(event.params.token);
}

export function handleDexAdded(event: DexAdded): void {
  const existingDex = SparkDex.load(event.params.factory);
  const isFirst = existingDex === null;
  const dex: SparkDex = existingDex !== null ? existingDex : new SparkDex(event.params.factory);

  if (isFirst) {
    dex.addedAtTimestamp   = event.block.timestamp;
    dex.addedAtBlockNumber = event.block.number;
  }
  dex.positionManager = event.params.positionManager;
  dex.router          = event.params.router;
  dex.enabled         = true;
  dex.save();

  if (isFirst) {
    seedWethQuoteToken(event.address);
    // Also bootstrap the launcher state (set in constructor with no event).
    getOrCreateLauncherState(event.address);
  }
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
  qt.marketCapRef = event.params.marketCapRef;
  qt.wethPairFee  = event.params.wethPairFee;
  qt.enabled      = true;

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

export function handleLaunchFeeSet(event: LaunchFeeSet): void {
  const state = getOrCreateLauncherState(event.address);
  state.launchFee = event.params.fee;
  state.save();
}

export function handleLaunchFeeWalletSet(event: LaunchFeeWalletSet): void {
  const state = getOrCreateLauncherState(event.address);
  state.launchFeeWallet = event.params.wallet;
  state.save();
}

export function handleMarketCapRefSet(event: MarketCapRefSet): void {
  const qt = SparkQuoteToken.load(event.params.token);
  if (qt == null) return;
  qt.marketCapRef = event.params.marketCapRef;
  qt.save();
}

export function handleETHRescued(event: ETHRescued): void {
  const state = getOrCreateLauncherState(event.address);
  state.totalETHRescued = state.totalETHRescued.plus(event.params.amount);
  state.save();
}

export function handleERC20Rescued(event: ERC20Rescued): void {
  const state = getOrCreateLauncherState(event.address);
  state.totalERC20Rescued = state.totalERC20Rescued.plus(BigInt.fromI32(1));
  state.save();
}
