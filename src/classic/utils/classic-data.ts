import { BigInt, log, ethereum, Address, Bytes } from "@graphprotocol/graph-ts"
import { CLM, Classic, Token } from "../../../generated/schema"
import { ONE_BI, ZERO_BI, changeValueEncoding } from "../../common/utils/decimal"
import {
  BEEFY_ORACLE_ADDRESS,
  BEEFY_SWAPPER_ADDRESS,
  BEEFY_SWAPPER_VALUE_SCALER,
  CHAINLINK_NATIVE_PRICE_FEED_ADDRESS,
  CHAINLINK_NATIVE_PRICE_FEED_DECIMALS,
  PRICE_ORACLE_TYPE,
  PRICE_STORE_DECIMALS_TOKEN_TO_NATIVE,
  PRICE_STORE_DECIMALS_USD,
  PYTH_NATIVE_PRICE_ID,
  PYTH_PRICE_FEED_ADDRESS,
  UMBRELLA_REGISTRY_ADDRESS,
  UMBRELLA_REGISTRY_FEED_KEY_BYTES_32,
  UMBRELLA_REGISTRY_PRICE_FEED_DECIMALS,
  UMBRELLA_REGISTRY_PRICE_FEED_NAME_BYTES_32,
  WNATIVE_DECIMALS,
  WNATIVE_TOKEN_ADDRESS,
} from "../../config"
import { Multicall3Params, MulticallResult, multicall } from "../../common/utils/multicall"
import { CLASSIC_SNAPSHOT_PERIODS } from "./snapshot"
import { getClassicSnapshot, hasClassicBeenRemoved } from "../entity/classic"
import { getCLM, getClmRewardPool, isClmManager, isClmRewardPool } from "../../clm/entity/clm"
import { getToken } from "../../common/entity/token"
import { getVaultTokenBreakdown, PLATFORM_BEEFY_LST_VAULT } from "../platform"
import { getTokenToNativePrice } from "../../common/oracle"

export function fetchClassicUnderlyingCLM(classic: Classic): CLM | null {
  let clm: CLM | null = null

  if (isClmRewardPool(classic.underlyingToken)) {
    const rewardPool = getClmRewardPool(classic.underlyingToken)
    clm = getCLM(rewardPool.clm)
  }

  if (isClmManager(classic.underlyingToken)) {
    clm = getCLM(classic.underlyingToken)
  }

  return clm
}

export function fetchClassicData(classic: Classic): ClassicData {
  const vaultAddress = classic.vault
  const boostRewardTokenAddresses = classic.boostRewardTokensOrder
  const rewardTokenAddresses = classic.rewardTokensOrder
  const rewardPoolTokenAddresses = classic.rewardPoolTokensOrder
  const underlyingTokenAddress = classic.underlyingToken
  const underlyingBreakdownTokenAddresses = classic.underlyingBreakdownTokensOrder
  const erc4626AdapterTokenAddresses = classic.erc4626AdapterTokensOrder
  const clm = fetchClassicUnderlyingCLM(classic)

  const calls = [
    new Multicall3Params(vaultAddress, "totalSupply()", "uint256"),
    classic.underlyingPlatform == PLATFORM_BEEFY_LST_VAULT
      ? new Multicall3Params(vaultAddress, "totalAssets()", "uint256")
      : new Multicall3Params(vaultAddress, "balance()", "uint256"),
    new Multicall3Params(underlyingTokenAddress, "totalSupply()", "uint256"),
  ]

  if (clm) {
    calls.push(new Multicall3Params(clm.managerToken, "totalSupply()", "uint256"))
    calls.push(new Multicall3Params(clm.managerToken, "balances()", "(uint256,uint256)"))
  }

  for (let i = 0; i < rewardPoolTokenAddresses.length; i++) {
    const rewardPoolTokenAddress = Address.fromBytes(rewardPoolTokenAddresses[i])
    calls.push(new Multicall3Params(rewardPoolTokenAddress, "totalSupply()", "uint256"))
  }

  for (let i = 0; i < erc4626AdapterTokenAddresses.length; i++) {
    const erc4626AdapterTokenAddress = Address.fromBytes(erc4626AdapterTokenAddresses[i])
    calls.push(new Multicall3Params(erc4626AdapterTokenAddress, "totalSupply()", "uint256"))
    calls.push(
      new Multicall3Params(vaultAddress, "balanceOf(address)", "uint256", [
        ethereum.Value.fromAddress(erc4626AdapterTokenAddress),
      ]),
    )
  }

  const tokensToRefresh = new Array<Address>()
  tokensToRefresh.push(WNATIVE_TOKEN_ADDRESS)
  for (let i = 0; i < boostRewardTokenAddresses.length; i++) {
    tokensToRefresh.push(Address.fromBytes(boostRewardTokenAddresses[i]))
  }
  for (let i = 0; i < rewardTokenAddresses.length; i++) {
    tokensToRefresh.push(Address.fromBytes(rewardTokenAddresses[i]))
  }
  for (let i = 0; i < underlyingBreakdownTokenAddresses.length; i++) {
    tokensToRefresh.push(Address.fromBytes(underlyingBreakdownTokenAddresses[i]))
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
  } else if (PRICE_ORACLE_TYPE === "umbrella") {
    // get the price feeds contract address
    const res = multicall([
      new Multicall3Params(UMBRELLA_REGISTRY_ADDRESS, "getAddress(bytes32)", "address", [
        ethereum.Value.fromFixedBytes(UMBRELLA_REGISTRY_FEED_KEY_BYTES_32),
      ]),
    ])

    const feedsContractAddressRes = res[0]
    if (feedsContractAddressRes.reverted) {
      log.error("Failed to fetch feedsContractAddress for Classic {}", [classic.id.toHexString()])
      throw new Error("Failed to fetch feedsContractAddress for Classic")
    }
    const feedsContractAddress = feedsContractAddressRes.value.toAddress()

    calls.push(
      new Multicall3Params(feedsContractAddress, "getPriceData(bytes32)", "(uint8,uint24,uint32,uint128)", [
        ethereum.Value.fromFixedBytes(UMBRELLA_REGISTRY_PRICE_FEED_NAME_BYTES_32),
      ]),
    )
  } else if (PRICE_ORACLE_TYPE === "beefy") {
    calls.push(
      new Multicall3Params(BEEFY_ORACLE_ADDRESS, "getPrice(address)", "uint256", [
        ethereum.Value.fromAddress(WNATIVE_TOKEN_ADDRESS),
      ]),
    )
  } else {
    log.error("Unsupported price oracle type {}", [PRICE_ORACLE_TYPE])
    throw new Error("Unsupported price oracle type")
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

  for (let i = 0; i < underlyingBreakdownTokenAddresses.length; i++) {
    const underlyingBreakdownTokenAddress = Address.fromBytes(underlyingBreakdownTokenAddresses[i])
    const underlyingBreakdownToken = getToken(underlyingBreakdownTokenAddress)
    const amountIn = changeValueEncoding(ONE_BI, ZERO_BI, underlyingBreakdownToken.decimals).div(
      BEEFY_SWAPPER_VALUE_SCALER,
    )
    calls.push(
      new Multicall3Params(BEEFY_SWAPPER_ADDRESS, "getAmountOut(address,address,uint256)", "uint256", [
        ethereum.Value.fromAddress(underlyingBreakdownTokenAddress),
        ethereum.Value.fromAddress(WNATIVE_TOKEN_ADDRESS),
        ethereum.Value.fromUnsignedBigInt(amountIn),
      ]),
    )
  }

  // -----------------------------------------------------------------

  const results = multicall(calls)

  // -----------------------------------------------------------------

  let idx = 0
  const vaultTotalSupplyRes = results[idx++]
  const underlyingTokenBalanceRes = results[idx++]
  const underlyingTokenTotalSupplyRes = results[idx++]
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
  const erc4626AdapterTotalSupplyRes = new Array<MulticallResult>()
  const erc4626AdapterVaultSharesBalancesRes = new Array<MulticallResult>()
  for (let i = 0; i < erc4626AdapterTokenAddresses.length; i++) {
    erc4626AdapterTotalSupplyRes.push(results[idx++])
    erc4626AdapterVaultSharesBalancesRes.push(results[idx++])
  }
  idx = idx + tokensToRefresh.length
  const priceFeedRes = results[idx++]
  const boostRewardTokenOutputAmountsRes = new Array<MulticallResult>()
  for (let i = 0; i < boostRewardTokenAddresses.length; i++) {
    boostRewardTokenOutputAmountsRes.push(results[idx++])
  }
  const rewardTokenOutputAmountsRes = new Array<MulticallResult>()
  for (let i = 0; i < rewardTokenAddresses.length; i++) {
    rewardTokenOutputAmountsRes.push(results[idx++])
  }
  const underlyingBreakdownToNativeRes = new Array<MulticallResult>()
  for (let i = 0; i < underlyingBreakdownTokenAddresses.length; i++) {
    underlyingBreakdownToNativeRes.push(results[idx++])
  }

  // -----------------------------------------------------------------

  let vaultSharesTotalSupply = ZERO_BI
  if (!vaultTotalSupplyRes.reverted) {
    vaultSharesTotalSupply = vaultTotalSupplyRes.value.toBigInt()
  } else {
    log.error("Failed to fetch vaultSharesTotalSupply for Classic {}", [classic.id.toHexString()])
  }
  let underlyingAmount = ZERO_BI
  if (!underlyingTokenBalanceRes.reverted) {
    underlyingAmount = underlyingTokenBalanceRes.value.toBigInt()
  } else {
    log.error("Failed to fetch underlyingAmount for Classic {}", [classic.id.toHexString()])
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
    } else if (PRICE_ORACLE_TYPE === "umbrella") {
      const umbrellaAnswer = priceFeedRes.value.toTuple()
      const value = umbrellaAnswer[3].toBigInt()
      nativeToUSDPrice = changeValueEncoding(value, UMBRELLA_REGISTRY_PRICE_FEED_DECIMALS, PRICE_STORE_DECIMALS_USD)
    } else if (PRICE_ORACLE_TYPE === "beefy") {
      const beefyAnswer = priceFeedRes.value.toBigInt()
      nativeToUSDPrice = changeValueEncoding(beefyAnswer, WNATIVE_DECIMALS, PRICE_STORE_DECIMALS_USD)
    } else {
      log.error("Unsupported price oracle type {}", [PRICE_ORACLE_TYPE])
      throw new Error("Unsupported price oracle type")
    }
  } else {
    log.error("Failed to fetch nativeToUSDPrice for Classic {}", [classic.id.toHexString()])
  }

  let vaultUnderlyingTotalSupply = ZERO_BI
  if (!underlyingTokenTotalSupplyRes.reverted) {
    vaultUnderlyingTotalSupply = underlyingTokenTotalSupplyRes.value.toBigInt()
  } else {
    log.error("Failed to fetch vaultUnderlyingTotalSupply for Classic {}", [classic.id.toHexString()])
  }

  let boostRewardToNativePrices: BigInt[] = []
  for (let i = 0; i < boostRewardTokenOutputAmountsRes.length; i++) {
    const amountOutRes = boostRewardTokenOutputAmountsRes[i]
    const boostToken = getToken(boostRewardTokenAddresses[i])
    boostRewardToNativePrices.push(priceToNativeWithFallback(classic, boostToken, amountOutRes))
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

  let erc4626AdapterTotalSupply = new Array<BigInt>()
  for (let i = 0; i < erc4626AdapterTotalSupplyRes.length; i++) {
    const totalSupplyRes = erc4626AdapterTotalSupplyRes[i]
    if (!totalSupplyRes.reverted) {
      erc4626AdapterTotalSupply.push(totalSupplyRes.value.toBigInt())
    } else {
      erc4626AdapterTotalSupply.push(ZERO_BI)
      log.error("Failed to fetch erc4626AdapterTotalSupply for Classic {}", [classic.id.toHexString()])
    }
  }

  let erc4626AdapterVaultSharesBalances = new Array<BigInt>()
  for (let i = 0; i < erc4626AdapterVaultSharesBalancesRes.length; i++) {
    const shareBalanceRes = erc4626AdapterVaultSharesBalancesRes[i]
    if (!shareBalanceRes.reverted) {
      erc4626AdapterVaultSharesBalances.push(shareBalanceRes.value.toBigInt())
    } else {
      erc4626AdapterVaultSharesBalances.push(ZERO_BI)
      log.error("Failed to fetch erc4626AdapterShareBalances for Classic {}", [classic.id.toHexString()])
    }
  }

  // only some strategies have this
  let rewardToNativePrices = new Array<BigInt>()
  for (let i = 0; i < rewardTokenOutputAmountsRes.length; i++) {
    const amountOutRes = rewardTokenOutputAmountsRes[i]
    const rewardToken = getToken(rewardTokenAddresses[i])
    rewardToNativePrices.push(priceToNativeWithFallback(classic, rewardToken, amountOutRes))
  }

  let underlyingBreakdownToNativePrices = new Array<BigInt>()
  for (let i = 0; i < underlyingBreakdownToNativeRes.length; i++) {
    const underlyingBreakdownTokenAddress = underlyingBreakdownTokenAddresses[i]
    const amountOutRes = underlyingBreakdownToNativeRes[i]
    const underlyingBreakdownToken = getToken(underlyingBreakdownTokenAddress)
    underlyingBreakdownToNativePrices.push(priceToNativeWithFallback(classic, underlyingBreakdownToken, amountOutRes))
  }

  let underlyingToNativePrice = ZERO_BI
  let vaultUnderlyingBreakdownBalances = new Array<BigInt>()
  if (clm) {
    if (
      clm.managerTotalSupply.notEqual(ZERO_BI) &&
      clmManagerTotalSupplyRes &&
      clmManagerBalancesRes &&
      underlyingBreakdownToNativeRes.length == 2
    ) {
      const token0 = getToken(clm.underlyingToken0)
      const token1 = getToken(clm.underlyingToken1)

      const token0ToNativePriceRes = underlyingBreakdownToNativeRes[0]
      let token0ToNativePrice = ZERO_BI
      token0ToNativePrice = priceToNativeWithFallback(classic, token0, token0ToNativePriceRes)

      const token1ToNativePriceRes = underlyingBreakdownToNativeRes[1]
      let token1ToNativePrice = ZERO_BI
      token1ToNativePrice = priceToNativeWithFallback(classic, token1, token1ToNativePriceRes)

      let clmManagerTotalSupply = ZERO_BI
      if (!clmManagerTotalSupplyRes.reverted) {
        clmManagerTotalSupply = clmManagerTotalSupplyRes.value.toBigInt()
        vaultUnderlyingTotalSupply = clmManagerTotalSupply
      } else {
        log.error("Failed to fetch clmManagerTotalSupply for Classic {}", [classic.id.toHexString()])
      }

      let clmToken0Balance = ZERO_BI
      let clmToken1Balance = ZERO_BI
      if (!clmManagerBalancesRes.reverted) {
        const clmManagerBalancesTuple = clmManagerBalancesRes.value.toTuple()
        clmToken0Balance = clmManagerBalancesTuple[0].toBigInt()
        clmToken1Balance = clmManagerBalancesTuple[1].toBigInt()

        vaultUnderlyingBreakdownBalances = [clmToken0Balance, clmToken1Balance]
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
        .times(changeValueEncoding(ONE_BI, ZERO_BI, WNATIVE_DECIMALS))
        .div(changeValueEncoding(clmManagerTotalSupply, clmManagerToken.decimals, WNATIVE_DECIMALS))
    }
  } else {
    const breakdown = getVaultTokenBreakdown(classic)

    // set the breakdown balances
    for (let i = 0; i < underlyingBreakdownTokenAddresses.length; i++) {
      let rawBalance = ZERO_BI
      for (let j = 0; j < breakdown.length; j++) {
        if (breakdown[j].tokenAddress.equals(underlyingBreakdownTokenAddresses[i])) {
          rawBalance = breakdown[j].rawBalance
          break
        }
      }
      vaultUnderlyingBreakdownBalances.push(rawBalance)
      if (rawBalance.equals(ZERO_BI)) {
        log.error("Failed to fetch vaultUnderlyingBreakdownBalances for Classic {}", [classic.id.toHexString()])
      }
    }

    // underlying token is WNATIVE, price to native is 1-1
    if (underlyingTokenAddress.equals(WNATIVE_TOKEN_ADDRESS)) {
      underlyingToNativePrice = changeValueEncoding(ONE_BI, ZERO_BI, PRICE_STORE_DECIMALS_TOKEN_TO_NATIVE)
      log.debug("Underlying token is WNATIVE, price to native is 1-1 {}", [classic.id.toHexString()])
    } else {
      // convert the breakdown balances to native prices
      let totalNativeEquivalentAmount = ZERO_BI
      for (let i = 0; i < underlyingBreakdownTokenAddresses.length; i++) {
        const token = getToken(underlyingBreakdownTokenAddresses[i])
        const tokenBalance = vaultUnderlyingBreakdownBalances[i]
        const tokenToNativePrice = underlyingBreakdownToNativePrices[i]
        const tokenNativeAmount = changeValueEncoding(
          tokenBalance.times(tokenToNativePrice),
          token.decimals.plus(WNATIVE_DECIMALS),
          WNATIVE_DECIMALS,
        )
        totalNativeEquivalentAmount = totalNativeEquivalentAmount.plus(tokenNativeAmount)
      }

      if (underlyingAmount.notEqual(ZERO_BI)) {
        const underlyingToken = getToken(underlyingTokenAddress)
        underlyingToNativePrice = totalNativeEquivalentAmount
          .times(changeValueEncoding(ONE_BI, ZERO_BI, underlyingToken.decimals))
          .div(underlyingAmount)
        log.debug("Price to native is {} for underlyingToken: {}", [
          underlyingToNativePrice.toString(),
          underlyingToken.id.toHexString(),
        ])
      } else {
        log.error("Failed to fetch underlyingAmount for Classic {}", [classic.id.toHexString()])
      }
    }
  }

  return new ClassicData(
    vaultSharesTotalSupply,
    vaultUnderlyingTotalSupply,
    vaultUnderlyingBreakdownBalances,
    rewardPoolsTotalSupply,
    erc4626AdapterTotalSupply,
    erc4626AdapterVaultSharesBalances,
    underlyingAmount,
    underlyingToNativePrice,
    underlyingBreakdownToNativePrices,
    boostRewardToNativePrices,
    rewardToNativePrices,
    nativeToUSDPrice,
  )
}

export class ClassicData {
  constructor(
    public vaultSharesTotalSupply: BigInt,
    public vaultUnderlyingTotalSupply: BigInt,
    public vaultUnderlyingBreakdownBalances: Array<BigInt>,
    public rewardPoolsTotalSupply: Array<BigInt>,
    public erc4626AdaptersTotalSupply: Array<BigInt>,
    public erc4626AdapterVaultSharesBalances: Array<BigInt>,
    public underlyingAmount: BigInt,
    public underlyingToNativePrice: BigInt,
    public underlyingBreakdownToNativePrices: Array<BigInt>,
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
  if (hasClassicBeenRemoved(classic)) {
    log.error("Classic vault {} has been removed, skipping updateClassicDataAndSnapshots", [classic.id.toHexString()])
    return classic
  }
  // update classic data
  classic.vaultSharesTotalSupply = classicData.vaultSharesTotalSupply
  classic.vaultUnderlyingTotalSupply = classicData.vaultUnderlyingTotalSupply
  classic.vaultUnderlyingBreakdownBalances = classicData.vaultUnderlyingBreakdownBalances
  classic.vaultUnderlyingBalance = classicData.underlyingAmount
  classic.rewardPoolsTotalSupply = classicData.rewardPoolsTotalSupply
  classic.erc4626AdaptersTotalSupply = classicData.erc4626AdaptersTotalSupply
  classic.erc4626AdapterVaultSharesBalances = classicData.erc4626AdapterVaultSharesBalances
  classic.underlyingAmount = classicData.underlyingAmount
  classic.underlyingToNativePrice = classicData.underlyingToNativePrice
  classic.underlyingBreakdownToNativePrices = classicData.underlyingBreakdownToNativePrices
  classic.boostRewardToNativePrices = classicData.boostRewardToNativePrices
  classic.rewardToNativePrices = classicData.rewardToNativePrices
  classic.nativeToUSDPrice = classicData.nativeToUSDPrice
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
    snapshot.vaultUnderlyingTotalSupply = classic.vaultUnderlyingTotalSupply
    snapshot.vaultUnderlyingBreakdownBalances = classic.vaultUnderlyingBreakdownBalances
    snapshot.rewardPoolsTotalSupply = classic.rewardPoolsTotalSupply
    snapshot.erc4626AdaptersTotalSupply = classic.erc4626AdaptersTotalSupply
    snapshot.erc4626AdapterVaultSharesBalances = classic.erc4626AdapterVaultSharesBalances
    snapshot.underlyingAmount = classic.underlyingAmount
    snapshot.underlyingToNativePrice = classic.underlyingToNativePrice
    snapshot.underlyingBreakdownToNativePrices = classic.underlyingBreakdownToNativePrices
    snapshot.boostRewardToNativePrices = classic.boostRewardToNativePrices
    snapshot.rewardToNativePrices = classic.rewardToNativePrices
    snapshot.nativeToUSDPrice = classic.nativeToUSDPrice
    snapshot.save()
  }

  return classic
}

function priceToNativeWithFallback(classic: Classic, token: Token, swapperResult: MulticallResult): BigInt {
  let amountOut = ZERO_BI
  if (!swapperResult.reverted) {
    amountOut = swapperResult.value.toBigInt().times(BEEFY_SWAPPER_VALUE_SCALER)
  } else {
    log.error("Failed to fetch priceToNativeWithFallback for Classic {} token: {}, swapperResult reverted", [
      classic.id.toHexString(),
      token.id.toHexString(),
    ])
  }

  // manual beefy oracle fixes
  const isObviouslyWrongAmount = BigInt.fromString("10000000000000000000000000000000").equals(amountOut)
  const isVeryLargeAmount = amountOut.gt(BigInt.fromString("1000000000000000000000000"))
  if (isObviouslyWrongAmount) {
    log.error("Obviously wrong amount out for Classic {} underlyingBreakdownTokenAddress: {}, amountOut: {}", [
      classic.id.toHexString(),
      token.id.toHexString(),
      amountOut.toString(),
    ])
    amountOut = ZERO_BI
  } else if (isVeryLargeAmount) {
    log.error("Very large amount out for Classic {} underlyingBreakdownTokenAddress: {}, amountOut: {}", [
      classic.id.toHexString(),
      token.id.toHexString(),
      amountOut.toString(),
    ])
    amountOut = changeValueEncoding(ONE_BI, ZERO_BI, token.decimals) // set price to 1-1
  }

  // amount out is 0, try to fallback to our slower oracle
  // this happens when the beefy oracle is not setup or was setup very late and we are missing
  // past data prices
  if (amountOut.equals(ZERO_BI)) {
    const oraclePrice = getTokenToNativePrice(token)
    log.warning("Fallback to oracle for Classic {} underlyingBreakdownTokenAddress: {}, amountOut: {}", [
      classic.id.toHexString(),
      token.id.toHexString(),
      oraclePrice.toString(),
    ])
    return oraclePrice
  }

  log.debug("Amount out is {} for Classic {} underlyingBreakdownTokenAddress: {}", [
    amountOut.toString(),
    classic.id.toHexString(),
    token.id.toHexString(),
  ])
  return amountOut
}
