import { BigInt } from "@graphprotocol/graph-ts"
import { CLM } from "../../../generated/schema"
import { ZERO_BI, changeValueEncoding } from "../../common/utils/decimal"
import { CHAINLINK_NATIVE_PRICE_FEED_ADDRESS, PRICE_FEED_DECIMALS, PRICE_STORE_DECIMALS_USD } from "../../config"
import { Multicall3Params, multicall } from "../../common/utils/multicall"
import { getToken, isNullToken } from "../../common/entity/token"
import { CLM_SNAPSHOT_PERIODS } from "./snapshot"
import { getClmSnapshot } from "../entity/clm"

export function fetchCLMData(clm: CLM): CLMData {
  const managerAddress = clm.id
  const strategyAddress = clm.strategy
  const rewardPoolAddress = clm.rewardPoolToken

  const token1 = getToken(clm.underlyingToken0)
  const rewardPoolToken = getToken(clm.rewardPoolToken)

  const signatures = [
    new Multicall3Params(managerAddress, "totalSupply()", "uint256"),
    new Multicall3Params(managerAddress, "balances()", "(uint256,uint256)"),
    new Multicall3Params(strategyAddress, "balancesOfPool()", "(uint256,uint256,uint256,uint256,uint256,uint256)"),
    new Multicall3Params(strategyAddress, "price()", "uint256", true), // this can revert when the liquidity is 0
    new Multicall3Params(strategyAddress, "range()", "(uint256,uint256)", true), // this can revert when the liquidity is 0
    new Multicall3Params(strategyAddress, "lpToken0ToNativePrice()", "uint256"),
    new Multicall3Params(strategyAddress, "lpToken1ToNativePrice()", "uint256"),
    new Multicall3Params(
      CHAINLINK_NATIVE_PRICE_FEED_ADDRESS,
      "latestRoundData()",
      "(uint80,int256,uint256,uint256,uint80)",
    ),
  ]

  const hasRewardPool = !isNullToken(rewardPoolToken)
  if (hasRewardPool) {
    signatures.push(
      new Multicall3Params(strategyAddress, "rewardToNativePrice()", "uint256", true), // only some strategies have this
    )
    signatures.push(
      new Multicall3Params(rewardPoolAddress, "totalSupply()", "uint256", true), // only some clms have a reward pool token
    )
  }

  const results = multicall(signatures)
  const totalSupplyRes = results[0]
  const balanceRes = results[1]
  const balanceOfPoolRes = results[2]
  const priceRes = results[3]
  const rangeRes = results[4]
  const token0ToNativePriceRes = results[5]
  const token1ToNativePriceRes = results[6]
  const chainLinkAnswerRes = results[7]
  const rewardToNativePriceRes = hasRewardPool ? results[8] : null
  const rewardPoolTotalSupplyRes = hasRewardPool ? results[9] : null

  const managerTotalSupply = totalSupplyRes.value.toBigInt()
  const balances = balanceRes.value.toTuple()
  const token0Balance = balances[0].toBigInt()
  const token1Balance = balances[1].toBigInt()

  const balanceOfPool = balanceOfPoolRes.value.toTuple()
  const token0PositionMainBalance = balanceOfPool[2].toBigInt()
  const token1PositionMainBalance = balanceOfPool[3].toBigInt()
  const token0PositionAltBalance = balanceOfPool[4].toBigInt()
  const token1PositionAltBalance = balanceOfPool[5].toBigInt()

  // price is the amount of token1 per token0, expressed with 36 decimals
  const priceDecimals = BigInt.fromU32(36)
  let priceOfToken0InToken1 = ZERO_BI
  if (!priceRes.reverted) {
    priceOfToken0InToken1 = changeValueEncoding(priceRes.value.toBigInt(), priceDecimals, token1.decimals)
  }

  // price range
  let priceRangeMin1 = ZERO_BI
  let priceRangeMax1 = ZERO_BI
  if (!rangeRes.reverted) {
    const range = rangeRes.value.toTuple()
    priceRangeMin1 = changeValueEncoding(range[0].toBigInt(), priceDecimals, token1.decimals)
    priceRangeMax1 = changeValueEncoding(range[1].toBigInt(), priceDecimals, token1.decimals)
  }

  // and now the prices
  const token0ToNativePrice = token0ToNativePriceRes.value.toBigInt()
  const token1ToNativePrice = token1ToNativePriceRes.value.toBigInt()
  let rewardToNativePrice = ZERO_BI
  if (rewardToNativePriceRes != null && !rewardToNativePriceRes.reverted) {
    rewardToNativePrice = rewardToNativePriceRes.value.toBigInt()
  }

  // and have a native price in USD
  const chainLinkAnswer = chainLinkAnswerRes.value.toTuple()
  const nativeToUSDPrice = changeValueEncoding(
    chainLinkAnswer[1].toBigInt(),
    PRICE_FEED_DECIMALS,
    PRICE_STORE_DECIMALS_USD,
  )

  let rewardPoolTotalSupply = ZERO_BI
  if (rewardPoolTotalSupplyRes != null && !rewardPoolTotalSupplyRes.reverted) {
    rewardPoolTotalSupply = rewardPoolTotalSupplyRes.value.toBigInt()
  }

  return new CLMData(
    managerTotalSupply,
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
    rewardToNativePrice,
    nativeToUSDPrice,
  )
}

class CLMData {
  constructor(
    public managerTotalSupply: BigInt,
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
    public rewardToNativePrice: BigInt,
    public nativeToUSDPrice: BigInt,
  ) {}
}

export function updateCLMDataAndSnapshots(clm: CLM, clmData: CLMData, nowTimestamp: BigInt): CLM {
  // update CLM data
  clm.managerTotalSupply = clmData.managerTotalSupply
  clm.rewardPoolTotalSupply = clmData.rewardPoolTotalSupply
  clm.token0ToNativePrice = clmData.token0ToNativePrice
  clm.token1ToNativePrice = clmData.token1ToNativePrice
  clm.rewardToNativePrice = clmData.rewardToNativePrice
  clm.nativeToUSDPrice = clmData.nativeToUSDPrice
  clm.priceOfToken0InToken1 = clmData.priceOfToken0InToken1
  clm.priceRangeMin1 = clmData.priceRangeMin1
  clm.priceRangeMax1 = clmData.priceRangeMax1
  clm.underlyingMainAmount0 = clmData.token0PositionMainBalance
  clm.underlyingMainAmount1 = clmData.token1PositionMainBalance
  clm.underlyingAltAmount0 = clmData.token0PositionAltBalance
  clm.underlyingAltAmount1 = clmData.token1PositionAltBalance
  clm.save()
  for (let i = 0; i < CLM_SNAPSHOT_PERIODS.length; i++) {
    const period = CLM_SNAPSHOT_PERIODS[i]
    const snapshot = getClmSnapshot(clm, nowTimestamp, period)
    snapshot.managerTotalSupply = clm.managerTotalSupply
    snapshot.rewardPoolTotalSupply = clm.rewardPoolTotalSupply
    snapshot.token0ToNativePrice = clm.token0ToNativePrice
    snapshot.token1ToNativePrice = clm.token1ToNativePrice
    snapshot.rewardToNativePrice = clm.rewardToNativePrice
    snapshot.nativeToUSDPrice = clm.nativeToUSDPrice
    snapshot.priceOfToken0InToken1 = clm.priceOfToken0InToken1
    snapshot.priceRangeMin1 = clm.priceRangeMin1
    snapshot.priceRangeMax1 = clm.priceRangeMax1
    snapshot.underlyingMainAmount0 = clm.underlyingMainAmount0
    snapshot.underlyingMainAmount1 = clm.underlyingMainAmount1
    snapshot.underlyingAltAmount0 = clm.underlyingAltAmount0
    snapshot.underlyingAltAmount1 = clm.underlyingAltAmount1
    snapshot.save()
  }

  return clm
}
