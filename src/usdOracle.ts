import { Address, BigInt, Bytes, dataSource } from "@graphprotocol/graph-ts";
import { Sync, PancakePair as PancakePairContract } from "../generated/NativeUsdOracle/PancakePair";
import { Token as ERC20Contract } from "../generated/NativeUsdOracle/Token";
import { NativeUsdPrice, NativeUsdPriceSnapshot } from "../generated/schema";
import { ZERO, NATIVE_USD_ID, bigIntMax, bigIntMin } from "./utils";

// USDC/native (WBNB or WETH) V2-style pair, configured per-chain in the manifest via
// `context.usdcToken`. Native side is always 18-decimal (WBNB/WETH); USDC decimals vary
// by chain (18 on BSC's Binance-Peg USDC, 6 on Ethereum's native USDC) so the reserve
// ratio must be decimal-adjusted — see handleSync().
function getOrCreateOracle(pairAddress: Address): NativeUsdPrice {
  let oracle = NativeUsdPrice.load(NATIVE_USD_ID);
  if (oracle == null) {
    oracle = new NativeUsdPrice(NATIVE_USD_ID);

    const usdcAddr = Address.fromBytes(dataSource.context().getBytes("usdcToken"));

    const pair = PancakePairContract.bind(pairAddress);
    const token0Result = pair.try_token0();
    oracle.usdcIsToken0 = !token0Result.reverted && token0Result.value.equals(usdcAddr);

    const usdcContract = ERC20Contract.bind(usdcAddr);
    const decResult = usdcContract.try_decimals();
    oracle.usdcDecimals = decResult.reverted ? 18 : decResult.value;

    oracle.price = ZERO;
    oracle.lastUpdatedBlock = ZERO;
    oracle.lastUpdatedTimestamp = ZERO;
    oracle.save();
  }
  return oracle as NativeUsdPrice;
}

export function handleSync(event: Sync): void {
  const oracle = getOrCreateOracle(event.address);

  const usdcReserve   = oracle.usdcIsToken0 ? event.params.reserve0 : event.params.reserve1;
  const nativeReserve = oracle.usdcIsToken0 ? event.params.reserve1 : event.params.reserve0;
  if (nativeReserve.equals(ZERO)) return;

  // priceScaled(USD per whole native token, ×1e18) = usdcReserve × 10^(36 - usdcDecimals) / nativeReserve
  // (native side is always 18-decimal, so the exponent collapses to 18 when USDC is also 18-decimal).
  const exponent = 36 - oracle.usdcDecimals;
  const scale = BigInt.fromI32(10).pow(exponent as u8);
  const closePrice = usdcReserve.times(scale).div(nativeReserve);

  const openPrice = oracle.price.equals(ZERO) ? closePrice : oracle.price;

  oracle.price = closePrice;
  oracle.lastUpdatedBlock     = event.block.number;
  oracle.lastUpdatedTimestamp = event.block.timestamp;
  oracle.save();

  const snapshotId = Bytes.fromI32(event.block.number.toI32());
  let snapshot = NativeUsdPriceSnapshot.load(snapshotId);
  if (snapshot == null) {
    snapshot = new NativeUsdPriceSnapshot(snapshotId);
    snapshot.blockNumber = event.block.number;
    snapshot.timestamp   = event.block.timestamp;
    snapshot.openPrice   = openPrice;
    snapshot.highPrice   = bigIntMax(openPrice, closePrice);
    snapshot.lowPrice    = bigIntMin(openPrice, closePrice);
  } else {
    snapshot.highPrice = bigIntMax(snapshot.highPrice, closePrice);
    snapshot.lowPrice  = bigIntMin(snapshot.lowPrice, closePrice);
  }
  snapshot.closePrice = closePrice;
  snapshot.save();
}
