import { BigInt, log } from "@graphprotocol/graph-ts"
import { Classic } from "../../../generated/schema"
import { ZERO_BI, changeValueEncoding } from "../../common/utils/decimal"
import { CHAINLINK_NATIVE_PRICE_FEED_ADDRESS, PRICE_FEED_DECIMALS, PRICE_STORE_DECIMALS_USD } from "../../config"
import { Multicall3Params, multicall } from "../../common/utils/multicall"
import { CLASSIC_SNAPSHOT_PERIODS } from "./snapshot"
import { getClassicSnapshot } from "../entity/classic"

export function fetchClassicData(classic: Classic): ClassicData {
  const vaultAddress = classic.vault

  const signatures = [
    new Multicall3Params(vaultAddress, "totalSupply()", "uint256"),
    new Multicall3Params(vaultAddress, "balance()", "uint256"),
    new Multicall3Params(
      CHAINLINK_NATIVE_PRICE_FEED_ADDRESS,
      "latestRoundData()",
      "(uint80,int256,uint256,uint256,uint80)",
    ),
  ]

  const results = multicall(signatures)
  const vaultTotalSupplyRes = results[0]
  const underlyingTokenBalanceRes = results[1]
  const chainLinkAnswerRes = results[2]

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
  if (!chainLinkAnswerRes.reverted) {
    const chainLinkAnswer = chainLinkAnswerRes.value.toTuple()
    nativeToUSDPrice = changeValueEncoding(chainLinkAnswer[1].toBigInt(), PRICE_FEED_DECIMALS, PRICE_STORE_DECIMALS_USD)
  } else {
    log.error("Failed to fetch nativeToUSDPrice for Classic {}", [classic.id.toString()])
  }

  return new ClassicData(vaultSharesTotalSupply, underlyingAmount, nativeToUSDPrice)
}

class ClassicData {
  constructor(
    public vaultSharesTotalSupply: BigInt,
    public underlyingAmount: BigInt,
    public nativeToUSDPrice: BigInt,
  ) {}
}

export function updateClassicDataAndSnapshots(
  classic: Classic,
  classicData: ClassicData,
  nowTimestamp: BigInt,
): Classic {
  // update CLM data
  classic.vaultSharesTotalSupply = classicData.vaultSharesTotalSupply
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
    snapshot.underlyingAmount = classic.underlyingAmount
    snapshot.nativeToUSDPrice = classic.nativeToUSDPrice
    snapshot.save()
  }

  return classic
}
