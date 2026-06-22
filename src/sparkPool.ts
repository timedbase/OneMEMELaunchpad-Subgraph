import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { Swap } from "../generated/templates/UniswapV3Pool/UniswapV3Pool";
import { SparkPool, SparkLaunchedToken, SparkTrade } from "../generated/schema";

export function handleSwap(event: Swap): void {
  const poolEntry = SparkPool.load(event.address);
  if (poolEntry == null) return;

  const sparkToken = SparkLaunchedToken.load(poolEntry.token);
  if (sparkToken == null) return;

  const ZERO = BigInt.fromI32(0);
  const sparkIsToken0 = poolEntry.sparkIsToken0;

  // amount0/amount1 are signed: negative = leaving pool (bought), positive = entering pool (sold).
  const sparkAmount = sparkIsToken0 ? event.params.amount0 : event.params.amount1;
  const quoteAmount = sparkIsToken0 ? event.params.amount1 : event.params.amount0;

  // Spark leaving the pool (amount < 0) means someone bought it.
  const isBuy = sparkAmount.lt(ZERO);

  const id = event.transaction.hash.concatI32(event.logIndex.toI32());
  const trade = new SparkTrade(id);
  trade.token        = poolEntry.token;
  trade.pool         = event.address;
  trade.sender       = event.params.sender;
  trade.recipient    = event.params.recipient;
  trade.amount0      = event.params.amount0;
  trade.amount1      = event.params.amount1;
  trade.sqrtPriceX96 = event.params.sqrtPriceX96;
  trade.liquidity    = event.params.liquidity;
  trade.tick         = event.params.tick;
  trade.isBuy        = isBuy;
  trade.sparkAmount  = sparkAmount.lt(ZERO) ? sparkAmount.neg() : sparkAmount;
  trade.quoteAmount  = quoteAmount.lt(ZERO) ? quoteAmount.neg() : quoteAmount;
  trade.timestamp    = event.block.timestamp;
  trade.blockNumber  = event.block.number;
  trade.txHash       = event.transaction.hash;
  trade.save();

  sparkToken.tradeCount       = sparkToken.tradeCount.plus(BigInt.fromI32(1));
  sparkToken.totalVolumeToken = sparkToken.totalVolumeToken.plus(trade.sparkAmount);
  sparkToken.totalVolumeQuote = sparkToken.totalVolumeQuote.plus(trade.quoteAmount);
  sparkToken.save();
}
