import { Address } from "@graphprotocol/graph-ts";
import { Swap, PancakePair as PancakePairContract } from "../generated/templates/PancakePair/PancakePair";
import { LaunchpadPair, Token, DexTrade } from "../generated/schema";
import { ZERO, reservesToPrice, computeMarketCap, applyUsdPricing, upsertSnapshot, upsertAllPeriodStats } from "./utils";

// Post-migration swap tracking for TAX/REFLECTION tokens, whose bonding-curve liquidity moves
// into a PancakeSwap V2 pair (see Launchpad._doMigrateV2).
export function handleSwap(event: Swap): void {
  const pairEntry = LaunchpadPair.load(event.address);
  if (pairEntry == null) return;

  const tokenAddr = pairEntry.token;
  const token = Token.load(tokenAddr);
  if (token == null) return;

  const tokenIsToken0 = pairEntry.tokenIsToken0;

  const amount0In  = event.params.amount0In;
  const amount1In  = event.params.amount1In;
  const amount0Out = event.params.amount0Out;
  const amount1Out = event.params.amount1Out;

  // Token leaving the pool (Out > 0 on the token's side) means someone bought it.
  const isBuy = tokenIsToken0 ? amount0Out.gt(ZERO) : amount1Out.gt(ZERO);

  const tokenAmount = tokenIsToken0
    ? (amount0In.gt(ZERO) ? amount0In : amount0Out)
    : (amount1In.gt(ZERO) ? amount1In : amount1Out);
  const bnbAmount = tokenIsToken0
    ? (amount1In.gt(ZERO) ? amount1In : amount1Out)
    : (amount0In.gt(ZERO) ? amount0In : amount0Out);

  const openPrice = token.lastKnownPrice;

  // Reserves already reflect the post-swap state by the time this handler runs.
  const pairContract   = PancakePairContract.bind(event.address);
  const reservesResult = pairContract.try_getReserves();
  let closePrice = openPrice;
  if (!reservesResult.reverted) {
    const reserve0 = reservesResult.value.value0;
    const reserve1 = reservesResult.value.value1;
    const tokenReserve = tokenIsToken0 ? reserve0 : reserve1;
    const bnbReserve   = tokenIsToken0 ? reserve1 : reserve0;
    closePrice = reservesToPrice(bnbReserve, tokenReserve);
  }

  const addr = Address.fromBytes(tokenAddr);
  upsertSnapshot(addr, event.block.number, event.block.timestamp, ZERO, ZERO, bnbAmount, isBuy, openPrice, closePrice);
  upsertAllPeriodStats(addr, event.block.timestamp, ZERO, ZERO, bnbAmount, isBuy, openPrice, closePrice);

  const tradeId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const trade   = new DexTrade(tradeId);
  trade.token       = tokenAddr;
  trade.venue       = "V2_PAIR";
  trade.trader      = event.params.to;
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
