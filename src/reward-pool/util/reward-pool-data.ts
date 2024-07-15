import { BigInt, log, ethereum, Address } from "@graphprotocol/graph-ts"
import { RewardPool } from "../../../generated/schema"
import { ONE_BI, ZERO_BI, changeValueEncoding } from "../../common/utils/decimal"
import {
  BEEFY_ORACLE_ADDRESS,
  BEEFY_SWAPPER_ADDRESS,
  CHAINLINK_NATIVE_PRICE_FEED_ADDRESS,
  CHAINLINK_NATIVE_PRICE_FEED_DECIMALS,
  PRICE_STORE_DECIMALS_USD,
  WNATIVE_TOKEN_ADDRESS,
  BEEFY_SWAPPER_VALUE_SCALER,
  PYTH_PRICE_FEED_ADDRESS,
  PYTH_NATIVE_PRICE_ID,
  PRICE_ORACLE_TYPE,
} from "../../config"
import { Multicall3Params, MulticallResult, multicall } from "../../common/utils/multicall"
import { getToken } from "../../common/entity/token"
import { getRewardPoolSnapshot } from "../entity/reward-pool"
import { REWARD_POOL_SNAPSHOT_PERIODS } from "./snapshot"

export function fetchRewardPoolData(rewardPool: RewardPool): RewardPoolData {
  const rewardPoolAddress = rewardPool.id
  const rewardTokenAddresses = rewardPool.rewardTokensOrder

  const calls = [
    new Multicall3Params(rewardPoolAddress, "totalSupply()", "uint256"),
    new Multicall3Params(rewardPoolAddress, "balances()", "uint256"),
  ]

  // wnative price to usd
  if (PRICE_ORACLE_TYPE == "chainlink") {
    calls.push(
      new Multicall3Params(
        CHAINLINK_NATIVE_PRICE_FEED_ADDRESS,
        "latestRoundData()",
        "(uint80,int256,uint256,uint256,uint80)",
      ),
    )
  } else if (PRICE_ORACLE_TYPE === "pyth") {
    calls.push(
      new Multicall3Params(PYTH_PRICE_FEED_ADDRESS, "getPriceUnsafe(bytes32)", "(int64,uint64,int32,uint256)", [
        ethereum.Value.fromFixedBytes(PYTH_NATIVE_PRICE_ID),
      ]),
    )
  } else {
    log.error("Unsupported price oracle type {}", [PRICE_ORACLE_TYPE])
    throw new Error("Unsupported price oracle type")
  }

  // warm up beefy swapper oracle
  const tokensToRefresh = new Array<Address>()
  tokensToRefresh.push(WNATIVE_TOKEN_ADDRESS)
  tokensToRefresh.push(Address.fromBytes(rewardPool.underlyingToken))
  for (let i = 0; i < rewardTokenAddresses.length; i++) {
    tokensToRefresh.push(Address.fromBytes(rewardTokenAddresses[i]))
  }
  for (let i = 0; i < tokensToRefresh.length; i++) {
    const tokenAddress = tokensToRefresh[i]
    calls.push(
      new Multicall3Params(BEEFY_ORACLE_ADDRESS, "getFreshPrice(address)", "(uint256,bool)", [
        ethereum.Value.fromAddress(tokenAddress),
      ]),
    )
  }

  const underlyingToken = getToken(Address.fromBytes(rewardPool.underlyingToken))
  const amountId = changeValueEncoding(ONE_BI, ZERO_BI, underlyingToken.decimals).div(BEEFY_SWAPPER_VALUE_SCALER)
  calls.push(
    new Multicall3Params(BEEFY_SWAPPER_ADDRESS, "getAmountOut(address,address,uint256)", "uint256", [
      ethereum.Value.fromAddress(Address.fromBytes(underlyingToken.id)),
      ethereum.Value.fromAddress(WNATIVE_TOKEN_ADDRESS),
      ethereum.Value.fromUnsignedBigInt(amountId),
    ]),
  )

  for (let i = 0; i < rewardTokenAddresses.length; i++) {
    const rewardTokenAddress = Address.fromBytes(rewardTokenAddresses[i])
    const rewardToken = getToken(rewardTokenAddress)
    const amountIn = changeValueEncoding(ONE_BI, ZERO_BI, rewardToken.decimals).div(BEEFY_SWAPPER_VALUE_SCALER)
    calls.push(
      new Multicall3Params(BEEFY_SWAPPER_ADDRESS, "getAmountOut(address,address,uint256)", "uint256", [
        ethereum.Value.fromAddress(rewardTokenAddress),
        ethereum.Value.fromAddress(WNATIVE_TOKEN_ADDRESS),
        ethereum.Value.fromUnsignedBigInt(amountIn),
      ]),
    )
  }

  // map multicall indices to variables
  const results = multicall(calls)

  let idx = 0
  const totalSupplyRes = results[idx++]
  const balanceRes = results[idx++]
  const priceFeedRes = results[idx++]
  for (let i = 0; i < tokensToRefresh.length; i++) {
    idx++
  }
  const underlyingToNativeRes = results[idx++]
  const rewardTokenOutputAmountsRes = new Array<MulticallResult>()
  for (let i = 0; i < rewardTokenAddresses.length; i++) {
    rewardTokenOutputAmountsRes.push(results[idx++])
  }

  // extract the data
  let sharesTotalSupply = ZERO_BI
  if (!totalSupplyRes.reverted) {
    sharesTotalSupply = totalSupplyRes.value.toBigInt()
  } else {
    log.error("Failed to fetch totalSupply for Reward Pool {}", [rewardPool.id.toHexString()])
  }

  let underlyingTokenBalance = ZERO_BI
  if (!balanceRes.reverted) {
    underlyingTokenBalance = balanceRes.value.toBigInt()
  } else {
    log.error("Failed to fetch balance for Reward Pool {}", [rewardPool.id.toHexString()])
  }

  let underlyingToNativePrice = ZERO_BI
  if (!underlyingToNativeRes.reverted) {
    underlyingToNativePrice = underlyingToNativeRes.value.toBigInt().times(BEEFY_SWAPPER_VALUE_SCALER)
  } else {
    log.error("Failed to fetch underlyingToNativePrice for Reward Pool {}", [rewardPool.id.toHexString()])
  }

  // only some strategies have this
  let rewardToNativePrices = new Array<BigInt>()
  for (let i = 0; i < rewardTokenOutputAmountsRes.length; i++) {
    const amountOutRes = rewardTokenOutputAmountsRes[i]
    if (!amountOutRes.reverted) {
      const amountOut = amountOutRes.value.toBigInt().times(BEEFY_SWAPPER_VALUE_SCALER)
      rewardToNativePrices.push(amountOut)
    } else {
      rewardToNativePrices.push(ZERO_BI)
      log.error("Failed to fetch rewardToNativePrices for Reward Pool {}", [rewardPool.id.toHexString()])
    }
  }

  // and have a native price in USD
  let nativeToUSDPrice = ZERO_BI
  if (!priceFeedRes.reverted) {
    if (PRICE_ORACLE_TYPE === "chainlink") {
      const chainLinkAnswer = priceFeedRes.value.toTuple()
      nativeToUSDPrice = changeValueEncoding(
        chainLinkAnswer[1].toBigInt(),
        CHAINLINK_NATIVE_PRICE_FEED_DECIMALS,
        PRICE_STORE_DECIMALS_USD,
      )
    } else if (PRICE_ORACLE_TYPE === "pyth") {
      const pythAnswer = priceFeedRes.value.toTuple()
      const value = pythAnswer[0].toBigInt()
      const exponent = pythAnswer[2].toBigInt()
      const decimals = exponent.neg()
      nativeToUSDPrice = changeValueEncoding(value, decimals, PRICE_STORE_DECIMALS_USD)
    } else {
      log.error("Unsupported price oracle type {}", [PRICE_ORACLE_TYPE])
      throw new Error("Unsupported price oracle type")
    }
  } else {
    log.error("Failed to fetch nativeToUSDPrice for Reward Pool {}", [rewardPool.id.toHexString()])
  }

  return new RewardPoolData(
    sharesTotalSupply,
    underlyingTokenBalance,
    underlyingToNativePrice,
    rewardToNativePrices,
    nativeToUSDPrice,
  )
}

class RewardPoolData {
  constructor(
    public sharesTotalSupply: BigInt,
    public underlyingTokenBalance: BigInt,
    public underlyingToNativePrice: BigInt,
    public rewardToNativePrices: Array<BigInt>,
    public nativeToUSDPrice: BigInt,
  ) {}
}

export function updateRewardPoolDataAndSnapshots(
  rewardPool: RewardPool,
  rewardPoolData: RewardPoolData,
  nowTimestamp: BigInt,
): RewardPool {
  // update reward pool data
  rewardPool.sharesTotalSupply = rewardPoolData.sharesTotalSupply
  rewardPool.underlyingAmount = rewardPoolData.underlyingTokenBalance
  rewardPool.underlyingToNativePrice = rewardPoolData.underlyingToNativePrice
  rewardPool.rewardToNativePrices = rewardPoolData.rewardToNativePrices
  rewardPool.nativeToUSDPrice = rewardPoolData.nativeToUSDPrice
  rewardPool.save()

  // don't save a snapshot if we don't have a deposit yet
  // or if the vault becomes empty
  if (rewardPool.sharesTotalSupply.equals(ZERO_BI)) {
    return rewardPool
  }

  for (let i = 0; i < REWARD_POOL_SNAPSHOT_PERIODS.length; i++) {
    const period = REWARD_POOL_SNAPSHOT_PERIODS[i]
    const snapshot = getRewardPoolSnapshot(rewardPool, nowTimestamp, period)
    snapshot.sharesTotalSupply = rewardPoolData.sharesTotalSupply
    snapshot.underlyingAmount = rewardPoolData.underlyingTokenBalance
    snapshot.underlyingToNativePrice = rewardPoolData.underlyingToNativePrice
    snapshot.rewardToNativePrices = rewardPoolData.rewardToNativePrices
    snapshot.nativeToUSDPrice = rewardPoolData.nativeToUSDPrice
    snapshot.save()
  }

  return rewardPool
}
