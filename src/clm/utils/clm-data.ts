import { BigInt, log, ethereum, Address } from "@graphprotocol/graph-ts"
import { CLM } from "../../../generated/schema"
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

  const calls = [
    new Multicall3Params(managerAddress, "totalSupply()", "uint256"),
    new Multicall3Params(managerAddress, "balances()", "(uint256,uint256)"),
    new Multicall3Params(strategyAddress, "balancesOfPool()", "(uint256,uint256,uint256,uint256,uint256,uint256)"),
    new Multicall3Params(strategyAddress, "price()", "uint256"),
    new Multicall3Params(strategyAddress, "range()", "(uint256,uint256)"),
    new Multicall3Params(strategyAddress, "lpToken0ToNativePrice()", "uint256"),
    new Multicall3Params(strategyAddress, "lpToken1ToNativePrice()", "uint256"),
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

  const hasRewardPool = !isNullToken(rewardPoolToken)
  const rewardTokens = clm.rewardTokens
  if (hasRewardPool) {
    calls.push(new Multicall3Params(rewardPoolAddress, "totalSupply()", "uint256"))
    calls.push(
      new Multicall3Params(BEEFY_ORACLE_ADDRESS, "getFreshPrice(address)", "(uint256,bool)", [
        ethereum.Value.fromAddress(WNATIVE_TOKEN_ADDRESS),
      ]),
    )

    for (let i = 0; i < rewardTokens.length; i++) {
      const rewardTokenAddress = Address.fromBytes(rewardTokens[i])
      const rewardToken = getToken(rewardTokenAddress)
      calls.push(
        new Multicall3Params(BEEFY_ORACLE_ADDRESS, "getFreshPrice(address)", "(uint256,bool)", [
          ethereum.Value.fromAddress(rewardTokenAddress),
        ]),
      )

      const amountIn = changeValueEncoding(ONE_BI, ZERO_BI, rewardToken.decimals).div(BEEFY_SWAPPER_VALUE_SCALER)
      calls.push(
        new Multicall3Params(BEEFY_SWAPPER_ADDRESS, "getAmountOut(address,address,uint256)", "uint256", [
          ethereum.Value.fromAddress(rewardTokenAddress),
          ethereum.Value.fromAddress(WNATIVE_TOKEN_ADDRESS),
          ethereum.Value.fromUnsignedBigInt(amountIn),
        ]),
      )
    }
  }

  const results = multicall(calls)
  const totalSupplyRes = results[0]
  const balanceRes = results[1]
  const balanceOfPoolRes = results[2]
  const priceRes = results[3]
  const rangeRes = results[4]
  const token0ToNativePriceRes = results[5]
  const token1ToNativePriceRes = results[6]
  const priceFeedRes = results[7]
  const rewardPoolTotalSupplyRes = hasRewardPool ? results[8] : null
  const rewardTokenOutputAmountsRes = hasRewardPool
    ? results.filter((_, i) => i >= 10).filter((_, i) => i % 2 == 1)
    : []

  let managerTotalSupply = ZERO_BI
  if (!totalSupplyRes.reverted) {
    managerTotalSupply = totalSupplyRes.value.toBigInt()
  } else {
    log.error("Failed to fetch totalSupply for CLM {}", [clm.id.toHexString()])
  }

  let token0Balance = ZERO_BI
  let token1Balance = ZERO_BI
  if (!balanceRes.reverted) {
    const balances = balanceRes.value.toTuple()
    token0Balance = balances[0].toBigInt()
    token1Balance = balances[1].toBigInt()
  } else {
    log.error("Failed to fetch balance for CLM {}", [clm.id.toHexString()])
  }

  let token0PositionMainBalance = ZERO_BI
  let token1PositionMainBalance = ZERO_BI
  let token0PositionAltBalance = ZERO_BI
  let token1PositionAltBalance = ZERO_BI
  if (!balanceOfPoolRes.reverted) {
    const balanceOfPool = balanceOfPoolRes.value.toTuple()
    token0PositionMainBalance = balanceOfPool[2].toBigInt()
    token1PositionMainBalance = balanceOfPool[3].toBigInt()
    token0PositionAltBalance = balanceOfPool[4].toBigInt()
    token1PositionAltBalance = balanceOfPool[5].toBigInt()
  } else {
    log.error("Failed to fetch balanceOfPool for CLM {}", [clm.id.toHexString()])
  }

  // price is the amount of token1 per token0, expressed with 36 decimals
  // this can revert when the liquidity is 0
  const priceDecimals = BigInt.fromU32(36)
  let priceOfToken0InToken1 = ZERO_BI
  if (!priceRes.reverted) {
    priceOfToken0InToken1 = changeValueEncoding(priceRes.value.toBigInt(), priceDecimals, token1.decimals)
  } else {
    log.warning("Failed to fetch price for CLM {}", [clm.id.toHexString()])
  }

  // price range
  // this can revert when the liquidity is 0
  let priceRangeMin1 = ZERO_BI
  let priceRangeMax1 = ZERO_BI
  if (!rangeRes.reverted) {
    const range = rangeRes.value.toTuple()
    priceRangeMin1 = changeValueEncoding(range[0].toBigInt(), priceDecimals, token1.decimals)
    priceRangeMax1 = changeValueEncoding(range[1].toBigInt(), priceDecimals, token1.decimals)
  } else {
    log.warning("Failed to fetch price range for CLM {}", [clm.id.toHexString()])
  }

  // and now the prices
  // arbitrum: 0xc82dE35aAE01bC4caE24d226203b50e6f9044697
  // this contract makes these calls fail at block 223528247
  // due to a misconfigured quote path in the contract
  let token0ToNativePrice = ZERO_BI
  if (!token0ToNativePriceRes.reverted) {
    token0ToNativePrice = token0ToNativePriceRes.value.toBigInt()
  } else {
    log.error("Failed to fetch token0ToNativePrice for CLM {}", [clm.id.toHexString()])
  }
  let token1ToNativePrice = ZERO_BI
  if (!token1ToNativePriceRes.reverted) {
    token1ToNativePrice = token1ToNativePriceRes.value.toBigInt()
  } else {
    log.error("Failed to fetch token0ToNativePrice for CLM {}", [clm.id.toHexString()])
  }

  // only some strategies have this
  let rewardToNativePrices = new Array<BigInt>()
  if (hasRewardPool) {
    for (let i = 0; i < rewardTokenOutputAmountsRes.length; i++) {
      const amountOutRes = rewardTokenOutputAmountsRes[i]
      if (!amountOutRes.reverted) {
        const amountOut = amountOutRes.value.toBigInt().times(BEEFY_SWAPPER_VALUE_SCALER)
        rewardToNativePrices.push(amountOut)
      } else {
        rewardToNativePrices.push(ZERO_BI)
        log.error("Failed to fetch rewardToNativePrices for CLM {}", [clm.id.toHexString()])
      }
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
    log.error("Failed to fetch nativeToUSDPrice for CLM {}", [clm.id.toString()])
  }
  // only some clms have a reward pool token
  let rewardPoolTotalSupply = ZERO_BI
  if (rewardPoolTotalSupplyRes != null) {
    if (!rewardPoolTotalSupplyRes.reverted) {
      rewardPoolTotalSupply = rewardPoolTotalSupplyRes.value.toBigInt()
    } else {
      log.error("Failed to fetch rewardPoolTotalSupply for CLM {}", [clm.id.toHexString()])
    }
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
    rewardToNativePrices,
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
    public rewardToNativePrices: Array<BigInt>,
    public nativeToUSDPrice: BigInt,
  ) {}
}

export function updateCLMDataAndSnapshots(clm: CLM, clmData: CLMData, nowTimestamp: BigInt): CLM {
  // update CLM data
  clm.managerTotalSupply = clmData.managerTotalSupply
  clm.rewardPoolTotalSupply = clmData.rewardPoolTotalSupply
  clm.token0ToNativePrice = clmData.token0ToNativePrice
  clm.token1ToNativePrice = clmData.token1ToNativePrice
  clm.rewardToNativePrices = clmData.rewardToNativePrices
  clm.nativeToUSDPrice = clmData.nativeToUSDPrice
  clm.priceOfToken0InToken1 = clmData.priceOfToken0InToken1
  clm.priceRangeMin1 = clmData.priceRangeMin1
  clm.priceRangeMax1 = clmData.priceRangeMax1
  clm.underlyingMainAmount0 = clmData.token0PositionMainBalance
  clm.underlyingMainAmount1 = clmData.token1PositionMainBalance
  clm.underlyingAltAmount0 = clmData.token0PositionAltBalance
  clm.underlyingAltAmount1 = clmData.token1PositionAltBalance
  clm.save()

  // don't save a snapshot if we don't have a deposit yet
  // or if the vault becomes empty
  if (clmData.managerTotalSupply.equals(ZERO_BI)) {
    return clm
  }

  for (let i = 0; i < CLM_SNAPSHOT_PERIODS.length; i++) {
    const period = CLM_SNAPSHOT_PERIODS[i]
    const snapshot = getClmSnapshot(clm, nowTimestamp, period)
    snapshot.managerTotalSupply = clm.managerTotalSupply
    snapshot.rewardPoolTotalSupply = clm.rewardPoolTotalSupply
    snapshot.token0ToNativePrice = clm.token0ToNativePrice
    snapshot.token1ToNativePrice = clm.token1ToNativePrice
    snapshot.rewardToNativePrices = clm.rewardToNativePrices
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
