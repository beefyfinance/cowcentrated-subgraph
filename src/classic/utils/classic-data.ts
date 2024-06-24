import { BigInt, log, ethereum, Address } from "@graphprotocol/graph-ts"
import { CLM, Classic } from "../../../generated/schema"
import { ONE_BI, ZERO_BI, changeValueEncoding } from "../../common/utils/decimal"
import {
  BEEFY_ORACLE_ADDRESS,
  BEEFY_SWAPPER_ADDRESS,
  BEEFY_SWAPPER_VALUE_SCALER,
  CHAINLINK_NATIVE_PRICE_FEED_ADDRESS,
  CHAINLINK_NATIVE_PRICE_FEED_DECIMALS,
  PRICE_ORACLE_TYPE,
  PRICE_STORE_DECIMALS_USD,
  PYTH_NATIVE_PRICE_ID,
  PYTH_PRICE_FEED_ADDRESS,
  WNATIVE_TOKEN_ADDRESS,
} from "../../config"
import { Multicall3Params, multicall } from "../../common/utils/multicall"
import { CLASSIC_SNAPSHOT_PERIODS } from "./snapshot"
import { getClassicSnapshot } from "../entity/classic"
import { getCLM, getClmRewardPool, isClmManager, isClmRewardPool } from "../../clm/entity/clm"
import { getToken } from "../../common/entity/token"

export function fetchClassicData(classic: Classic): ClassicData {
  const vaultAddress = classic.vault

  const calls = [
    new Multicall3Params(vaultAddress, "totalSupply()", "uint256"),
    new Multicall3Params(vaultAddress, "balance()", "uint256"),
  ]

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
      new Multicall3Params(PYTH_PRICE_FEED_ADDRESS, "getPriceUnsafe()", "(int64,uint64,int32,uint256)", [
        ethereum.Value.fromBytes(PYTH_NATIVE_PRICE_ID),
      ]),
    )
  } else {
    log.error("Unsupported price oracle type {}", [PRICE_ORACLE_TYPE])
    throw new Error("Unsupported price oracle type")
  }

  calls.push(
    new Multicall3Params(BEEFY_ORACLE_ADDRESS, "getFreshPrice(address)", "(uint256,bool)", [
      ethereum.Value.fromAddress(WNATIVE_TOKEN_ADDRESS),
    ]),
  )
  const boostRewardTokens = classic.boostRewardTokens
  for (let i = 0; i < boostRewardTokens.length; i++) {
    const boostTokenAddress = Address.fromBytes(boostRewardTokens[i])
    const boostToken = getToken(boostTokenAddress)
    calls.push(
      new Multicall3Params(BEEFY_ORACLE_ADDRESS, "getFreshPrice(address)", "(uint256,bool)", [
        ethereum.Value.fromAddress(boostTokenAddress),
      ]),
    )
    const amountIn = changeValueEncoding(ONE_BI, ZERO_BI, boostToken.decimals).div(BEEFY_SWAPPER_VALUE_SCALER)
    calls.push(
      new Multicall3Params(BEEFY_SWAPPER_ADDRESS, "getAmountOut(address,address,uint256)", "uint256", [
        ethereum.Value.fromAddress(boostTokenAddress),
        ethereum.Value.fromAddress(WNATIVE_TOKEN_ADDRESS),
        ethereum.Value.fromUnsignedBigInt(amountIn),
      ]),
    )
  }

  const results = multicall(calls)
  const vaultTotalSupplyRes = results[0]
  const underlyingTokenBalanceRes = results[1]
  const priceFeedRes = results[2]
  const boostTokenOutputAmountsRes = results.filter((_, i) => i >= 4).filter((_, i) => i % 2 == 1)

  let vaultSharesTotalSupply = ZERO_BI
  if (!vaultTotalSupplyRes.reverted) {
    vaultSharesTotalSupply = vaultTotalSupplyRes.value.toBigInt()
  } else {
    log.error("Failed to fetch vaultSharesTotalSupply for Classic {}", [classic.id.toString()])
  }
  let underlyingAmount = ZERO_BI
  if (!underlyingTokenBalanceRes.reverted) {
    underlyingAmount = underlyingTokenBalanceRes.value.toBigInt()
  } else {
    log.error("Failed to fetch underlyingAmount for Classic {}", [classic.id.toString()])
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
    log.error("Failed to fetch nativeToUSDPrice for Classic {}", [classic.id.toString()])
  }

  let underlyingToNativePrice = ZERO_BI
  let clm: CLM | null = null
  if (isClmRewardPool(classic.underlyingToken)) {
    const rewardPool = getClmRewardPool(classic.underlyingToken)
    clm = getCLM(rewardPool.clm)
  }

  if (isClmManager(classic.underlyingToken)) {
    clm = getCLM(classic.underlyingToken)
  }

  if (clm) {
    const totalNativeAmount0 = clm.underlyingMainAmount0.plus(clm.underlyingAltAmount0).times(clm.token0ToNativePrice)
    const totalNativeAmount1 = clm.underlyingMainAmount1.plus(clm.underlyingAltAmount1).times(clm.token1ToNativePrice)
    const totalNativeAmountInClm = totalNativeAmount0.plus(totalNativeAmount1)
    // assumption: 1 rewardPool token === 1 manager token
    underlyingToNativePrice = clm.managerTotalSupply.equals(ZERO_BI)
      ? ZERO_BI
      : totalNativeAmountInClm.div(clm.managerTotalSupply)
  }

  let boostRewardToNativePrices: BigInt[] = []
  for (let i = 0; i < boostTokenOutputAmountsRes.length; i++) {
    const amountOutRes = boostTokenOutputAmountsRes[i]
    if (!amountOutRes.reverted) {
      const amountOut = amountOutRes.value.toBigInt().times(BEEFY_SWAPPER_VALUE_SCALER)
      boostRewardToNativePrices.push(amountOut)
    } else {
      boostRewardToNativePrices.push(ZERO_BI)
      log.error("Failed to fetch boostRewardToNativePrices for Classic {}", [classic.id.toHexString()])
    }
  }

  return new ClassicData(
    vaultSharesTotalSupply,
    underlyingAmount,
    underlyingToNativePrice,
    boostRewardToNativePrices,
    nativeToUSDPrice,
  )
}

class ClassicData {
  constructor(
    public vaultSharesTotalSupply: BigInt,
    public underlyingAmount: BigInt,
    public underlyingToNativePrice: BigInt,
    public boostRewardToNativePrices: BigInt[],
    public nativeToUSDPrice: BigInt,
  ) {}
}

export function updateClassicDataAndSnapshots(
  classic: Classic,
  classicData: ClassicData,
  nowTimestamp: BigInt,
): Classic {
  // update classic data
  classic.vaultSharesTotalSupply = classicData.vaultSharesTotalSupply
  classic.underlyingToNativePrice = classicData.underlyingToNativePrice
  classic.boostRewardToNativePrices = classicData.boostRewardToNativePrices
  classic.nativeToUSDPrice = classicData.nativeToUSDPrice
  classic.underlyingAmount = classicData.underlyingAmount
  classic.save()

  // don't save a snapshot if we don't have a deposit yet
  // or if the vault becomes empty
  if (classic.vaultSharesTotalSupply.equals(ZERO_BI)) {
    return classic
  }

  for (let i = 0; i < CLASSIC_SNAPSHOT_PERIODS.length; i++) {
    const period = CLASSIC_SNAPSHOT_PERIODS[i]
    const snapshot = getClassicSnapshot(classic, nowTimestamp, period)
    snapshot.vaultSharesTotalSupply = classic.vaultSharesTotalSupply
    snapshot.underlyingToNativePrice = classic.underlyingToNativePrice
    snapshot.boostRewardToNativePrices = classic.boostRewardToNativePrices
    snapshot.underlyingAmount = classic.underlyingAmount
    snapshot.nativeToUSDPrice = classic.nativeToUSDPrice
    snapshot.save()
  }

  return classic
}
