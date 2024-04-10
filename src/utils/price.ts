import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import { BeefyCLStrategy, BeefyCLVault, Token } from "../../generated/schema"
import { BeefyStrategy as BeefyCLStrategyContract } from "../../generated/templates/BeefyCLStrategy/BeefyStrategy"
import { ZERO_BD, tokenAmountToDecimal } from "./decimal"
import { ChainLinkPriceFeed } from "../../generated/templates/BeefyCLStrategy/ChainLinkPriceFeed"
import { CHAINLINK_NATIVE_PRICE_FEED_ADDRESS, PRICE_FEED_DECIMALS, WNATIVE_DECIMALS } from "../config"
import { isNullToken } from "../entity/token"

const nativePriceFeed = ChainLinkPriceFeed.bind(CHAINLINK_NATIVE_PRICE_FEED_ADDRESS)

export function fetchVaultPrices(
  vault: BeefyCLVault,
  strategy: BeefyCLStrategy,
  token0: Token,
  token1: Token,
  earnedToken: Token,
): VaultPrices {
  log.debug("fetchVaultPrices: fetching data for vault {}", [vault.id.toHexString()])
  const strategyContract = BeefyCLStrategyContract.bind(Address.fromBytes(strategy.id))

  const token0PriceInNativeRes = strategyContract.try_lpToken0ToNativePrice()
  if (token0PriceInNativeRes.reverted) {
    log.error("fetchVaultPrices: lpToken0ToNativePrice() of vault {} and strat {} reverted for token {} (token0)", [
      vault.id.toHexString(),
      strategy.id.toHexString(),
      token0.id.toHexString(),
    ])
    throw Error("fetchVaultPrices: lpToken0ToNativePrice() reverted")
  }
  const token0PriceInNative = tokenAmountToDecimal(token0PriceInNativeRes.value, WNATIVE_DECIMALS)
  log.debug("fetchVaultPrices: token0PriceInNative: {}", [token0PriceInNative.toString()])

  const token1PriceInNativeRes = strategyContract.try_lpToken1ToNativePrice()
  if (token1PriceInNativeRes.reverted) {
    log.error("fetchVaultPrices: lpToken1ToNativePrice() of vault {} and strat {} reverted for token {} (token1)", [
      vault.id.toHexString(),
      strategy.id.toHexString(),
      token1.id.toHexString(),
    ])
    throw Error("fetchVaultPrices: lpToken1ToNativePrice() reverted")
  }
  const token1PriceInNative = tokenAmountToDecimal(token1PriceInNativeRes.value, WNATIVE_DECIMALS)
  log.debug("fetchVaultPrices: token1PriceInNative: {}", [token1PriceInNative.toString()])

  // some vaults have an additional token that is not part of the LP
  let earnedTokenPriceInNative = ZERO_BD
  if (!isNullToken(earnedToken)) {
    const earnedTokenPriceInNativeRes = strategyContract.try_ouptutToNativePrice()
    if (earnedTokenPriceInNativeRes.reverted) {
      log.error("fetchVaultPrices: ouptutToNativePrice() of vault {} and strat {} reverted for token {} (earned)", [
        vault.id.toHexString(),
        strategy.id.toHexString(),
        earnedToken.id.toHexString(),
      ])
      throw Error("fetchVaultPrices: ouptutToNativePrice() reverted")
    }
    earnedTokenPriceInNative = tokenAmountToDecimal(earnedTokenPriceInNativeRes.value, WNATIVE_DECIMALS)
    log.debug("fetchVaultPrices: earnedTokenPriceInNative: {}", [earnedTokenPriceInNative.toString()])
  }

  // fetch the native price in USD
  const nativePriceUSDRes = nativePriceFeed.try_latestRoundData()
  if (nativePriceUSDRes.reverted) {
    log.error("fetchVaultPrices: latestRoundData() reverted for native token", [])
    throw Error("fetchVaultPrices: latestRoundData() reverted")
  }
  const nativePriceUSD = tokenAmountToDecimal(nativePriceUSDRes.value.getAnswer(), PRICE_FEED_DECIMALS)
  log.debug("fetchVaultPrices: nativePriceUSD: {}", [nativePriceUSD.toString()])

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
