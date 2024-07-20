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
  WNATIVE_DECIMALS,
  WNATIVE_TOKEN_ADDRESS,
} from "../../config"
import { Multicall3Params, MulticallResult, multicall } from "../../common/utils/multicall"
import { CLASSIC_SNAPSHOT_PERIODS } from "./snapshot"
import { getClassicSnapshot } from "../entity/classic"
import { getCLM, getClmRewardPool, isClmManager, isClmRewardPool } from "../../clm/entity/clm"
import { getToken } from "../../common/entity/token"

export function fetchClassicData(classic: Classic): ClassicData {
  const vaultAddress = classic.vault
  const boostRewardTokenAddresses = classic.boostRewardTokensOrder
  const rewardTokenAddresses = classic.rewardTokensOrder
  const rewardPoolTokenAddresses = classic.rewardPoolTokensOrder

  let clm: CLM | null = null
  if (isClmRewardPool(classic.underlyingToken)) {
    const rewardPool = getClmRewardPool(classic.underlyingToken)
    clm = getCLM(rewardPool.clm)
  }

  if (isClmManager(classic.underlyingToken)) {
    clm = getCLM(classic.underlyingToken)
  }

  const calls = [
    new Multicall3Params(vaultAddress, "totalSupply()", "uint256"),
    new Multicall3Params(vaultAddress, "balance()", "uint256"),
  ]

  if (clm) {
    calls.push(new Multicall3Params(clm.managerToken, "totalSupply()", "uint256"))
    calls.push(new Multicall3Params(clm.managerToken, "balances()", "(uint256,uint256)"))
  }

  for (let i = 0; i < rewardPoolTokenAddresses.length; i++) {
    const rewardPoolTokenAddress = Address.fromBytes(rewardPoolTokenAddresses[i])
    calls.push(new Multicall3Params(rewardPoolTokenAddress, "totalSupply()", "uint256"))
  }

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

  const tokensToRefresh = new Array<Address>()
  tokensToRefresh.push(WNATIVE_TOKEN_ADDRESS)
  for (let i = 0; i < boostRewardTokenAddresses.length; i++) {
    tokensToRefresh.push(Address.fromBytes(boostRewardTokenAddresses[i]))
  }
  for (let i = 0; i < rewardTokenAddresses.length; i++) {
    tokensToRefresh.push(Address.fromBytes(rewardTokenAddresses[i]))
  }
  if (clm) {
    tokensToRefresh.push(Address.fromBytes(clm.underlyingToken0))
    tokensToRefresh.push(Address.fromBytes(clm.underlyingToken1))
  }

  for (let i = 0; i < tokensToRefresh.length; i++) {
    calls.push(
      new Multicall3Params(BEEFY_ORACLE_ADDRESS, "getFreshPrice(address)", "(uint256,bool)", [
        ethereum.Value.fromAddress(tokensToRefresh[i]),
      ]),
    )
  }

  for (let i = 0; i < boostRewardTokenAddresses.length; i++) {
    const boostTokenAddress = Address.fromBytes(boostRewardTokenAddresses[i])
    const boostToken = getToken(boostTokenAddress)
    const amountIn = changeValueEncoding(ONE_BI, ZERO_BI, boostToken.decimals).div(BEEFY_SWAPPER_VALUE_SCALER)
    calls.push(
      new Multicall3Params(BEEFY_SWAPPER_ADDRESS, "getAmountOut(address,address,uint256)", "uint256", [
        ethereum.Value.fromAddress(boostTokenAddress),
        ethereum.Value.fromAddress(WNATIVE_TOKEN_ADDRESS),
        ethereum.Value.fromUnsignedBigInt(amountIn),
      ]),
    )
  }

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

  if (clm) {
    const token0 = getToken(clm.underlyingToken0)
    const token1 = getToken(clm.underlyingToken1)
    const amountIn0 = changeValueEncoding(ONE_BI, ZERO_BI, token0.decimals).div(BEEFY_SWAPPER_VALUE_SCALER)
    const amountIn1 = changeValueEncoding(ONE_BI, ZERO_BI, token1.decimals).div(BEEFY_SWAPPER_VALUE_SCALER)
    calls.push(
      new Multicall3Params(BEEFY_SWAPPER_ADDRESS, "getAmountOut(address,address,uint256)", "uint256", [
        ethereum.Value.fromAddress(Address.fromBytes(clm.underlyingToken0)),
        ethereum.Value.fromAddress(WNATIVE_TOKEN_ADDRESS),
        ethereum.Value.fromUnsignedBigInt(amountIn0),
      ]),
    )
    calls.push(
      new Multicall3Params(BEEFY_SWAPPER_ADDRESS, "getAmountOut(address,address,uint256)", "uint256", [
        ethereum.Value.fromAddress(Address.fromBytes(clm.underlyingToken1)),
        ethereum.Value.fromAddress(WNATIVE_TOKEN_ADDRESS),
        ethereum.Value.fromUnsignedBigInt(amountIn1),
      ]),
    )
  }

  const results = multicall(calls)

  let idx = 0
  const vaultTotalSupplyRes = results[idx++]
  const underlyingTokenBalanceRes = results[idx++]
  let clmManagerTotalSupplyRes: MulticallResult | null = null
  let clmManagerBalancesRes: MulticallResult | null = null
  if (clm) {
    clmManagerTotalSupplyRes = results[idx++]
    clmManagerBalancesRes = results[idx++]
  }
  const rewardPoolsTotalSupplyRes = new Array<MulticallResult>()
  for (let i = 0; i < rewardPoolTokenAddresses.length; i++) {
    rewardPoolsTotalSupplyRes.push(results[idx++])
  }
  const priceFeedRes = results[idx++]
  for (let i = 0; i < tokensToRefresh.length; i++) {
    idx++
  }
  const boostRewardTokenOutputAmountsRes = new Array<MulticallResult>()
  for (let i = 0; i < boostRewardTokenAddresses.length; i++) {
    boostRewardTokenOutputAmountsRes.push(results[idx++])
  }
  const rewardTokenOutputAmountsRes = new Array<MulticallResult>()
  for (let i = 0; i < rewardTokenAddresses.length; i++) {
    rewardTokenOutputAmountsRes.push(results[idx++])
  }
  let token0ToNativePriceRes: MulticallResult | null = null
  let token1ToNativePriceRes: MulticallResult | null = null
  if (clm) {
    token0ToNativePriceRes = results[idx++]
    token1ToNativePriceRes = results[idx++]
  }

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
  if (
    clm &&
    clm.managerTotalSupply.notEqual(ZERO_BI) &&
    clmManagerTotalSupplyRes &&
    clmManagerBalancesRes &&
    token0ToNativePriceRes &&
    token1ToNativePriceRes
  ) {
    const token0 = getToken(clm.underlyingToken0)
    const token1 = getToken(clm.underlyingToken1)

    let token0ToNativePrice = ZERO_BI
    if (!token0ToNativePriceRes.reverted) {
      token0ToNativePrice = token0ToNativePriceRes.value.toBigInt().times(BEEFY_SWAPPER_VALUE_SCALER)
    } else {
      log.error("Failed to fetch token0ToNativePrice for Classic {}", [classic.id.toHexString()])
    }

    let token1ToNativePrice = ZERO_BI
    if (!token1ToNativePriceRes.reverted) {
      token1ToNativePrice = token1ToNativePriceRes.value.toBigInt().times(BEEFY_SWAPPER_VALUE_SCALER)
    } else {
      log.error("Failed to fetch token1ToNativePrice for Classic {}", [classic.id.toHexString()])
    }

    let clmManagerTotalSupply = ZERO_BI
    if (!clmManagerTotalSupplyRes.reverted) {
      clmManagerTotalSupply = clmManagerTotalSupplyRes.value.toBigInt()
    } else {
      log.error("Failed to fetch clmManagerTotalSupply for Classic {}", [classic.id.toHexString()])
    }

    let clmToken0Balance = ZERO_BI
    let clmToken1Balance = ZERO_BI
    if (!clmManagerBalancesRes.reverted) {
      const clmManagerBalancesTuple = clmManagerBalancesRes.value.toTuple()
      clmToken0Balance = clmManagerBalancesTuple[0].toBigInt()
      clmToken1Balance = clmManagerBalancesTuple[1].toBigInt()
    } else {
      log.error("Failed to fetch clmManagerBalances for Classic {}", [classic.id.toHexString()])
    }

    const totalNativeAmount0 = changeValueEncoding(
      clmToken0Balance.times(token0ToNativePrice),
      token0.decimals.plus(WNATIVE_DECIMALS),
      WNATIVE_DECIMALS,
    )
    const totalNativeAmount1 = changeValueEncoding(
      clmToken1Balance.times(token1ToNativePrice),
      token1.decimals.plus(WNATIVE_DECIMALS),
      WNATIVE_DECIMALS,
    )
    const totalNativeAmountInClm = totalNativeAmount0.plus(totalNativeAmount1)
    const clmManagerToken = getToken(clm.managerToken)

    underlyingToNativePrice = totalNativeAmountInClm
      .times(WNATIVE_DECIMALS)
      .div(changeValueEncoding(clmManagerTotalSupply, clmManagerToken.decimals, WNATIVE_DECIMALS))
  }

  let boostRewardToNativePrices: BigInt[] = []
  for (let i = 0; i < boostRewardTokenOutputAmountsRes.length; i++) {
    const amountOutRes = boostRewardTokenOutputAmountsRes[i]
    if (!amountOutRes.reverted) {
      const amountOut = amountOutRes.value.toBigInt().times(BEEFY_SWAPPER_VALUE_SCALER)
      boostRewardToNativePrices.push(amountOut)
    } else {
      boostRewardToNativePrices.push(ZERO_BI)
      log.error("Failed to fetch boostRewardToNativePrices for Classic {}", [classic.id.toHexString()])
    }
  }

  // only some clms have a reward pool token
  let rewardPoolsTotalSupply = new Array<BigInt>()
  for (let i = 0; i < rewardPoolsTotalSupplyRes.length; i++) {
    const totalSupplyRes = rewardPoolsTotalSupplyRes[i]
    if (!totalSupplyRes.reverted) {
      rewardPoolsTotalSupply.push(totalSupplyRes.value.toBigInt())
    } else {
      rewardPoolsTotalSupply.push(ZERO_BI)
      log.error("Failed to fetch rewardPoolsTotalSupply for Classic {}", [classic.id.toHexString()])
    }
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
      log.error("Failed to fetch rewardToNativePrices for Classic {}", [classic.id.toHexString()])
    }
  }

  return new ClassicData(
    vaultSharesTotalSupply,
    rewardPoolsTotalSupply,
    underlyingAmount,
    underlyingToNativePrice,
    boostRewardToNativePrices,
    rewardToNativePrices,
    nativeToUSDPrice,
  )
}

class ClassicData {
  constructor(
    public vaultSharesTotalSupply: BigInt,
    public rewardPoolsTotalSupply: Array<BigInt>,
    public underlyingAmount: BigInt,
    public underlyingToNativePrice: BigInt,
    public boostRewardToNativePrices: Array<BigInt>,
    public rewardToNativePrices: Array<BigInt>,
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
