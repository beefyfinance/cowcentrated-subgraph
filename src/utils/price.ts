import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import { BeefyCLStrategy, BeefyCLVault, Token } from "../../generated/schema"
import { StrategyPassiveManagerUniswap as BeefyCLStrategyContract } from "../../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap"
import { ONE_BD, ZERO_BD, exponentToBigInt, tokenAmountToDecimal } from "./decimal"
import { UniswapQuoterV2 } from "../../generated/templates/BeefyCLStrategy/UniswapQuoterV2"
import { ChainLinkPriceFeed } from "../../generated/templates/BeefyCLStrategy/ChainLinkPriceFeed"
import {
  CHAINLINK_NATIVE_PRICE_FEED_ADDRESS,
  PRICE_FEED_DECIMALS,
  UNISWAP_V3_QUOTER_V2_ADDRESS,
  WNATIVE_DECIMALS,
  WNATIVE_TOKEN_ADDRESS,
} from "../config"

const quoter = UniswapQuoterV2.bind(UNISWAP_V3_QUOTER_V2_ADDRESS)
const nativePriceFeed = ChainLinkPriceFeed.bind(CHAINLINK_NATIVE_PRICE_FEED_ADDRESS)

export function fetchVaultPrices(
  vault: BeefyCLVault,
  strategy: BeefyCLStrategy,
  token0: Token,
  token1: Token,
): VaultPrices {
  log.debug("updateUserPosition: fetching data for vault {}", [vault.id.toHexString()])
  const token0Path = strategy.lpToken0ToNativePath
  const token1Path = strategy.lpToken1ToNativePath

  // fetch the token prices to native
  let token0PriceInNative = ONE_BD
  if (token0Path.length > 0 && token0.id.notEqual(WNATIVE_TOKEN_ADDRESS)) {
    const token0PriceInNativeRes = quoter.try_quoteExactInput(token0Path, exponentToBigInt(token0.decimals))
    if (token0PriceInNativeRes.reverted) {
      log.error("updateUserPosition: quoteExactInput() of vault {} reverted for token {} (token0) with path {}", [
        vault.id.toHexString(),
        token0.id.toHexString(),
        token0Path.toHexString(),
      ])
      throw Error("updateUserPosition: quoteExactInput() reverted")
    }
    token0PriceInNative = tokenAmountToDecimal(token0PriceInNativeRes.value.getAmountOut(), WNATIVE_DECIMALS)
    log.debug("updateUserPosition: token0PriceInNativeRes: {}", [token0PriceInNative.toString()])
  }
  let token1PriceInNative = ONE_BD
  if (token1Path.length > 0 && token1.id.notEqual(WNATIVE_TOKEN_ADDRESS)) {
    const token1PriceInNativeRes = quoter.try_quoteExactInput(token1Path, exponentToBigInt(token1.decimals))
    if (token1PriceInNativeRes.reverted) {
      log.error("updateUserPosition: quoteExactInput() of vault {} reverted for token {} (token1) with path {}", [
        vault.id.toHexString(),
        token1.id.toHexString(),
        token1Path.toHexString(),
      ])
      throw Error("updateUserPosition: quoteExactInput() reverted")
    }
    token1PriceInNative = tokenAmountToDecimal(token1PriceInNativeRes.value.getAmountOut(), WNATIVE_DECIMALS)
    log.debug("updateUserPosition: token1PriceInNativeRes: {}", [token1PriceInNative.toString()])
  }

  // fetch the native price in USD
  const nativePriceUSDRes = nativePriceFeed.try_latestRoundData()
  if (nativePriceUSDRes.reverted) {
    log.error("updateUserPosition: latestRoundData() reverted for native token", [])
    throw Error("updateUserPosition: latestRoundData() reverted")
  }
  const nativePriceUSD = tokenAmountToDecimal(nativePriceUSDRes.value.getAnswer(), PRICE_FEED_DECIMALS)
  log.debug("updateUserPosition: nativePriceUSD: {}", [nativePriceUSD.toString()])

  return new VaultPrices(token0PriceInNative, token1PriceInNative, nativePriceUSD)
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
    public nativeToUsd: BigDecimal,
  ) {}
}
