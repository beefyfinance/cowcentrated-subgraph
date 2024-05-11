import { BigInt } from "@graphprotocol/graph-ts"
import { BeefyCLStrategy, BeefyCLVault, Token } from "../../generated/schema"
import { ZERO_BI, changeValueEncoding } from "./decimal"
import { CHAINLINK_NATIVE_PRICE_FEED_ADDRESS, PRICE_FEED_DECIMALS, PRICE_STORE_DECIMALS_USD } from "../config"
import { Multicall3Params, multicall } from "./multicall"
import { isNullToken } from "../entity/token"

export function fetchVaultLatestData(
  vault: BeefyCLVault,
  strategy: BeefyCLStrategy,
  sharesToken: Token,
  rewardPoolToken: Token,
  token0: Token,
  token1: Token,
): VaultData {
  const signatures = [
    new Multicall3Params(vault.id, "totalSupply()", "uint256"),
    new Multicall3Params(vault.id, "balances()", "(uint256,uint256)"),
    new Multicall3Params(strategy.id, "balancesOfPool()", "(uint256,uint256,uint256,uint256,uint256,uint256)"),
    new Multicall3Params(strategy.id, "price()", "uint256", true), // this can revert when the liquidity is 0
    new Multicall3Params(strategy.id, "range()", "(uint256,uint256)", true), // this can revert when the liquidity is 0
    new Multicall3Params(strategy.id, "lpToken0ToNativePrice()", "uint256"),
    new Multicall3Params(strategy.id, "lpToken1ToNativePrice()", "uint256"),
    new Multicall3Params(
      CHAINLINK_NATIVE_PRICE_FEED_ADDRESS,
      "latestRoundData()",
      "(uint80,int256,uint256,uint256,uint80)",
    ),
  ]
  if (!isNullToken(rewardPoolToken)) {
    signatures.push(new Multicall3Params(rewardPoolToken.id, "totalSupply()", "uint256"))
  }

  const results = multicall(signatures)

  const totalSupply = results[0].value.toBigInt()
  const balanceRes = results[1].value.toTuple()
  const token0Balance = balanceRes[0].toBigInt()
  const token1Balance = balanceRes[1].toBigInt()

  const balanceOfPoolRes = results[2].value.toTuple()
  const token0PositionMainBalance = balanceOfPoolRes[2].toBigInt()
  const token1PositionMainBalance = balanceOfPoolRes[3].toBigInt()
  const token0PositionAltBalance = balanceOfPoolRes[4].toBigInt()
  const token1PositionAltBalance = balanceOfPoolRes[5].toBigInt()

  // price is the amount of token1 per token0, expressed with 36 decimals
  const priceDecimals = BigInt.fromU32(36)
  let priceOfToken0InToken1 = ZERO_BI
  if (!results[3].reverted) {
    priceOfToken0InToken1 = changeValueEncoding(results[3].value.toBigInt(), priceDecimals, token1.decimals)
  }

  // price range
  let priceRangeMin1 = ZERO_BI
  let priceRangeMax1 = ZERO_BI
  if (!results[4].reverted) {
    const rangeRes = results[4].value.toTuple()
    priceRangeMin1 = changeValueEncoding(rangeRes[0].toBigInt(), priceDecimals, token1.decimals)
    priceRangeMax1 = changeValueEncoding(rangeRes[1].toBigInt(), priceDecimals, token1.decimals)
  }

  // and now the prices
  const token0ToNativePrice = results[5].value.toBigInt()
  const token1ToNativePrice = results[6].value.toBigInt()

  // and have a native price in USD
  const chainLinkAnswer = results[7].value.toTuple()
  const nativeToUSDPrice = changeValueEncoding(
    chainLinkAnswer[1].toBigInt(),
    PRICE_FEED_DECIMALS,
    PRICE_STORE_DECIMALS_USD,
  )

  let rewardPoolTotalSupply = ZERO_BI
  if (!isNullToken(rewardPoolToken)) {
    rewardPoolTotalSupply = results[8].value.toBigInt()
  }

  return new VaultData(
    totalSupply,
    rewardPoolTotalSupply,
    token0Balance,
    token1Balance,

    token0PositionMainBalance,
    token1PositionMainBalance,
    token0PositionAltBalance,
    token1PositionAltBalance,

    priceOfToken0InToken1,
    priceRangeMin1,
    priceRangeMax1,

    token0ToNativePrice,
    token1ToNativePrice,
    nativeToUSDPrice,
  )
}

class VaultData {
  constructor(
    public sharesTotalSupply: BigInt,
    public rewardPoolTotalSupply: BigInt,
    public token0Balance: BigInt,
    public token1Balance: BigInt,

    public token0PositionMainBalance: BigInt,
    public token1PositionMainBalance: BigInt,
    public token0PositionAltBalance: BigInt,
    public token1PositionAltBalance: BigInt,

    public priceOfToken0InToken1: BigInt,
    public priceRangeMin1: BigInt,
    public priceRangeMax1: BigInt,

    public token0ToNativePrice: BigInt,
    public token1ToNativePrice: BigInt,
    public nativeToUSDPrice: BigInt,
  ) {}
}
