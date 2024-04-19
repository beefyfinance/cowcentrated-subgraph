import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import { BeefyCLStrategy, BeefyCLVault, Token } from "../../generated/schema"
import { BeefyStrategy as BeefyCLStrategyContract } from "../../generated/templates/BeefyCLStrategy/BeefyStrategy"
import { ZERO_BD, tokenAmountToDecimal } from "./decimal"
import { ChainLinkPriceFeed } from "../../generated/templates/BeefyCLStrategy/ChainLinkPriceFeed"
import { CHAINLINK_NATIVE_PRICE_FEED_ADDRESS, PRICE_FEED_DECIMALS, WNATIVE_DECIMALS } from "../config"
import { MulticallParams, multicallRead } from "./multicall"
import { isNullToken } from "../entity/token"

const nativePriceFeed = ChainLinkPriceFeed.bind(CHAINLINK_NATIVE_PRICE_FEED_ADDRESS)

export function fetchVaultPrices(
  vault: BeefyCLVault,
  strategy: BeefyCLStrategy,
  token0: Token, 
  token1: Token,
  earnedToken: Token,
): VaultPrices {
  const signatures = [
    new MulticallParams(strategy.id, 'lpToken0ToNativePrice()', "uint256"),
    new MulticallParams(strategy.id, 'lpToken1ToNativePrice()', "uint256"),
    new MulticallParams(CHAINLINK_NATIVE_PRICE_FEED_ADDRESS,'latestRoundData()', "uint256"),
  ]
  if (!isNullToken(earnedToken)) {
    signatures.push(new MulticallParams(strategy.id, 'ouptutToNativePrice()', "uint256"),)
  }
  const results = multicallRead(signatures)
  const token0PriceInNative = tokenAmountToDecimal(results[0].toBigInt(), WNATIVE_DECIMALS)
  const token1PriceInNative = tokenAmountToDecimal(results[1].toBigInt(), WNATIVE_DECIMALS)
  const nativePriceUSD = tokenAmountToDecimal(results[2].toBigInt(), PRICE_FEED_DECIMALS)
  let earnedTokenPriceInNative = ZERO_BD
  if (!isNullToken(earnedToken)) {
    earnedTokenPriceInNative = tokenAmountToDecimal(results[3].toBigInt(), WNATIVE_DECIMALS)
  }

  return new VaultPrices(token0PriceInNative, token1PriceInNative, earnedTokenPriceInNative, nativePriceUSD)
}

export function fetchCurrentPriceInToken1(strategyAddress: Bytes, throwOnError: boolean): BigDecimal {
  log.debug("fetching current price for strategy {}", [strategyAddress.toHexString()])
  const strategyContract = BeefyCLStrategyContract.bind(Address.fromBytes(strategyAddress))
  const priceRes = strategyContract.try_price()
  if (priceRes.reverted) {
    if (throwOnError) {
      log.error("updateUserPosition: price() reverted for strategy {}", [strategyAddress.toHexString()])
      throw Error("updateUserPosition: price() reverted")
    }
    return ZERO_BD
  }

  // price is the amount of token1 per token0, expressed with 36 decimals
  const encodingDecimals = BigInt.fromU32(36)
  return tokenAmountToDecimal(priceRes.value, encodingDecimals)
}

export function fetchVaultPriceRangeInToken1(strategyAddress: Bytes, throwOnError: boolean): PriceRange {
  log.debug("fetching current price range for strategy {}", [strategyAddress.toHexString()])
  const strategyContract = BeefyCLStrategyContract.bind(Address.fromBytes(strategyAddress))
  const rangeRes = strategyContract.try_range()
  if (rangeRes.reverted) {
    if (throwOnError) {
      log.error("updateUserPosition: range() reverted for strategy {}", [strategyAddress.toHexString()])
      throw Error("updateUserPosition: range() reverted")
    }
    return new PriceRange(ZERO_BD, ZERO_BD)
  }
  // this is purposely inverted as we want prices in token1
  const encodingDecimals = BigInt.fromU32(36)
  const rangeMinToken1Price = tokenAmountToDecimal(rangeRes.value.value0, encodingDecimals)
  const rangeMaxToken1Price = tokenAmountToDecimal(rangeRes.value.value1, encodingDecimals)
  return new PriceRange(rangeMinToken1Price, rangeMaxToken1Price)
}

export function fetchNativePriceUSD(): BigDecimal {
  const nativePriceUSDRes = nativePriceFeed.try_latestRoundData()
  if (nativePriceUSDRes.reverted) {
    log.error("updateUserPosition: latestRoundData() reverted for native token", [])
    throw Error("updateUserPosition: latestRoundData() reverted")
  }
  return tokenAmountToDecimal(nativePriceUSDRes.value.getAnswer(), PRICE_FEED_DECIMALS)
}

class PriceRange {
  constructor(
    public min: BigDecimal,
    public max: BigDecimal,
  ) {}
}

class VaultPrices {
  constructor(
    public token0ToNative: BigDecimal,
    public token1ToNative: BigDecimal,
    public earnedToNative: BigDecimal,
    public nativeToUsd: BigDecimal,
  ) {}
}
