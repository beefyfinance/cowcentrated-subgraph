import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import { BeefyCLStrategy, BeefyCLVault, Token } from "../../generated/schema"
import { BeefyStrategy as BeefyCLStrategyContract } from "../../generated/templates/BeefyCLStrategy/BeefyStrategy"
import { ZERO_BD, tokenAmountToDecimal } from "./decimal"
import { ChainLinkPriceFeed } from "../../generated/templates/BeefyCLStrategy/ChainLinkPriceFeed"
import { CHAINLINK_NATIVE_PRICE_FEED_ADDRESS, PRICE_FEED_DECIMALS, WNATIVE_DECIMALS } from "../config"
import { Multicall3Params, multicall } from "./multicall"
import { isNullToken } from "../entity/token"

const nativePriceFeed = ChainLinkPriceFeed.bind(CHAINLINK_NATIVE_PRICE_FEED_ADDRESS)

export function fetchNativePriceUSD(): BigDecimal {
  const nativePriceUSDRes = nativePriceFeed.try_latestRoundData()
  if (nativePriceUSDRes.reverted) {
    log.error("updateUserPosition: latestRoundData() reverted for native token", [])
    throw Error("updateUserPosition: latestRoundData() reverted")
  }
  return tokenAmountToDecimal(nativePriceUSDRes.value.getAnswer(), PRICE_FEED_DECIMALS)
}

export function fetchVaultLatestData(
  vault: BeefyCLVault,
  strategy: BeefyCLStrategy,
  sharesToken: Token,
  token0: Token,
  token1: Token,
  earnedToken: Token,
): VaultData {
  const signatures = [
    new Multicall3Params(vault.id, "totalSupply()", "uint256"),
    new Multicall3Params(vault.id, "balances()", "(uint256,uint256)"),
    new Multicall3Params(strategy.id, "price()", "uint256", true), // this can revert when the liquidity is 0
    new Multicall3Params(strategy.id, "range()", "(uint256,uint256)", true), // this can revert when the liquidity is 0
    new Multicall3Params(strategy.id, "lpToken0ToNativePrice()", "uint256"),
    new Multicall3Params(strategy.id, "lpToken1ToNativePrice()", "uint256"),
    new Multicall3Params(strategy.id, "ouptutToNativePrice()", "uint256", true), // not all strategies have this
    new Multicall3Params(CHAINLINK_NATIVE_PRICE_FEED_ADDRESS, "latestRoundData()", "uint256"),
  ]
  const results = multicall(signatures)

  const totalSupply = tokenAmountToDecimal(results[0].value.toBigInt(), sharesToken.decimals)

  const balanceRes = results[1].value.toTuple()
  const token0Balance = tokenAmountToDecimal(balanceRes[0].toBigInt(), token0.decimals)
  const token1Balance = tokenAmountToDecimal(balanceRes[1].toBigInt(), token1.decimals)

  // price is the amount of token1 per token0, expressed with 36 decimals
  const encodingDecimals = BigInt.fromU32(36)
  let currentPriceInToken1 = ZERO_BD
  if (!results[2].reverted) {
    currentPriceInToken1 = tokenAmountToDecimal(results[2].value.toBigInt(), encodingDecimals)
  }

  // price range
  let rangeMinToken1Price = ZERO_BD
  let rangeMaxToken1Price = ZERO_BD
  if (!results[3].reverted) {
    const rangeRes = results[3].value.toTuple()
    rangeMinToken1Price = tokenAmountToDecimal(rangeRes[0].toBigInt(), encodingDecimals)
    rangeMaxToken1Price = tokenAmountToDecimal(rangeRes[1].toBigInt(), encodingDecimals)
  }

  // and now the prices
  const token0PriceInNative = tokenAmountToDecimal(results[4].value.toBigInt(), WNATIVE_DECIMALS)
  const token1PriceInNative = tokenAmountToDecimal(results[5].value.toBigInt(), WNATIVE_DECIMALS)
  let earnedTokenPriceInNative = ZERO_BD
  if (!isNullToken(earnedToken) && !results[6].reverted) {
    earnedTokenPriceInNative = tokenAmountToDecimal(results[6].value.toBigInt(), WNATIVE_DECIMALS)
  }

  // and have a native price in USD
  const nativePriceUSD = tokenAmountToDecimal(results[7].value.toBigInt(), PRICE_FEED_DECIMALS)

  return new VaultData(
    totalSupply,
    token0Balance,
    token1Balance,
    rangeMinToken1Price,
    rangeMaxToken1Price,
    currentPriceInToken1,
    token0PriceInNative,
    token1PriceInNative,
    earnedTokenPriceInNative,
    nativePriceUSD,
  )
}

class VaultData {
  constructor(
    public sharesTotalSupply: BigDecimal,
    public token0Balance: BigDecimal,
    public token1Balance: BigDecimal,
    public rangeMinToken1Price: BigDecimal,
    public rangeMaxToken1Price: BigDecimal,
    public currentPriceInToken1: BigDecimal,
    public token0ToNative: BigDecimal,
    public token1ToNative: BigDecimal,
    public earnedToNative: BigDecimal,
    public nativeToUsd: BigDecimal,
  ) {}
}
