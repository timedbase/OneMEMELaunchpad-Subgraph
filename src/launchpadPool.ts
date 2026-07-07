import { Address } from "@graphprotocol/graph-ts";
import { Swap } from "../generated/templates/LaunchpadV3Pool/UniswapV3Pool";
import { LaunchpadPool, Token, DexTrade } from "../generated/schema";
import { ZERO, sqrtPriceX96ToPrice, computeMarketCap, applyUsdPricing, upsertSnapshot, upsertAllPeriodStats } from "./utils";

// Post-migration swap tracking for STANDARD tokens, whose bonding-curve liquidity moves
// into a fresh PancakeSwap V3 1% pool (see Launchpad._doMigrateV3 / CreatorVault.PositionRegistered).
export function handleSwap(event: Swap): void {
  const poolEntry = LaunchpadPool.load(event.address);
  if (poolEntry == null) return;

  const tokenAddr = poolEntry.token;
  const token = Token.load(tokenAddr);
  if (token == null) return;

  const tokenIsToken0 = poolEntry.tokenIsToken0;

  // amount0/amount1 are signed: negative = leaving pool (bought), positive = entering pool (sold).
  const tokenAmountSigned = tokenIsToken0 ? event.params.amount0 : event.params.amount1;
  const bnbAmountSigned   = tokenIsToken0 ? event.params.amount1 : event.params.amount0;

  const isBuy = tokenAmountSigned.lt(ZERO);
  const tokenAmount = tokenAmountSigned.lt(ZERO) ? tokenAmountSigned.neg() : tokenAmountSigned;
  const bnbAmount   = bnbAmountSigned.lt(ZERO) ? bnbAmountSigned.neg() : bnbAmountSigned;

  const openPrice  = token.lastKnownPrice;
  const closePrice = sqrtPriceX96ToPrice(event.params.sqrtPriceX96, tokenIsToken0);

  const addr = Address.fromBytes(tokenAddr);
  upsertSnapshot(addr, event.block.number, event.block.timestamp, ZERO, ZERO, bnbAmount, isBuy, openPrice, closePrice);
  upsertAllPeriodStats(addr, event.block.timestamp, ZERO, ZERO, bnbAmount, isBuy, openPrice, closePrice);

  const tradeId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const trade   = new DexTrade(tradeId);
  trade.token       = tokenAddr;
  trade.venue       = "V3_POOL";
  trade.trader      = event.params.recipient;
  trade.type        = isBuy ? "BUY" : "SELL";
  trade.bnbAmount   = bnbAmount;
  trade.tokenAmount = tokenAmount;
  trade.priceAfter  = closePrice;
  trade.timestamp   = event.block.timestamp;
  trade.blockNumber = event.block.number;
  trade.txHash      = event.transaction.hash;
  trade.save();

  token.lastKnownPrice = closePrice;
  token.marketCap      = computeMarketCap(closePrice, token.totalSupply);
  applyUsdPricing(token, closePrice);
  token.save();
}
