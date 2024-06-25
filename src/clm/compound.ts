import { BigInt, ethereum } from "@graphprotocol/graph-ts"
import {
  Harvest as CLMHarvestEvent,
  HarvestRewards as CLMHarvestRewardsEvent,
  ClaimedFees as CLMClaimedFeesEvent,
  ClaimedRewards as CLMClaimedRewardsEvent,
} from "../../generated/templates/ClmStrategy/ClmStrategy"
import { getClmStrategy, getCLM, isClmInitialized } from "./entity/clm"
import { getTransaction } from "../common/entity/transaction"
import { ClmHarvestEvent, ClmManagerCollectionEvent } from "../../generated/schema"
import { ZERO_BI } from "../common/utils/decimal"
import { getEventIdentifier } from "../common/utils/event"
import { updateCLMDataAndSnapshots, fetchCLMData } from "./utils/clm-data"

export function handleClmStrategyHarvestAmounts(event: CLMHarvestEvent): void {
  handleClmStrategyHarvest(event, event.params.fee0, event.params.fee1, [])
}

export function handleClmStrategyHarvestRewards(event: CLMHarvestRewardsEvent): void {
  const amountClaimed = event.params.fees
  const strategy = getClmStrategy(event.address)
  const clm = getCLM(strategy.clm)
  const outputToken = strategy.outputToken

  const collectedOutputAmounts = new Array<BigInt>()
  const outputTokens = clm.outputTokens
  for (let i = 0; i < outputTokens.length; i++) {
    if (outputTokens[i].equals(outputToken)) {
      collectedOutputAmounts.push(amountClaimed)
    } else {
      collectedOutputAmounts.push(ZERO_BI)
    }
  }

  handleClmStrategyHarvest(event, ZERO_BI, ZERO_BI, collectedOutputAmounts)
}

function handleClmStrategyHarvest(
  event: ethereum.Event,
  compoundedAmount0: BigInt,
  compoundedAmount1: BigInt,
  collectedOutputAmounts: Array<BigInt>,
): void {
  let strategy = getClmStrategy(event.address)
  let clm = getCLM(strategy.clm)
  if (!isClmInitialized(clm)) {
    return
  }

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain
  const clmData = fetchCLMData(clm)

  ///////
  // store the raw harvest event
  let harvest = new ClmHarvestEvent(getEventIdentifier(event))
  harvest.clm = clm.id
  harvest.strategy = strategy.id
  harvest.createdWith = tx.id
  harvest.logIndex = event.logIndex
  harvest.timestamp = event.block.timestamp
  harvest.underlyingAmount0 = clmData.token0Balance
  harvest.underlyingAmount1 = clmData.token1Balance
  harvest.compoundedAmount0 = compoundedAmount0
  harvest.compoundedAmount1 = compoundedAmount1
  harvest.collectedOutputAmounts = collectedOutputAmounts
  harvest.managerTotalSupply = clmData.managerTotalSupply
  harvest.rewardPoolTotalSupply = clmData.rewardPoolTotalSupply
  harvest.token0ToNativePrice = clmData.token0ToNativePrice
  harvest.token1ToNativePrice = clmData.token1ToNativePrice
  harvest.outputToNativePrices = clmData.outputToNativePrices
  harvest.rewardToNativePrices = clmData.rewardToNativePrices
  harvest.nativeToUSDPrice = clmData.nativeToUSDPrice
  harvest.save()
}

export function handleClmStrategyClaimedFees(event: CLMClaimedFeesEvent): void {
  handleClmStrategyFees(
    event,
    event.params.feeAlt0.plus(event.params.feeMain0),
    event.params.feeAlt1.plus(event.params.feeMain1),
    [],
  )
}
export function handleClmStrategyClaimedRewards(event: CLMClaimedRewardsEvent): void {
  const amountClaimed = event.params.fees
  const strategy = getClmStrategy(event.address)
  const clm = getCLM(strategy.clm)
  const outputToken = strategy.outputToken

  const collectedOutputAmounts = new Array<BigInt>()
  const outputTokens = clm.outputTokens
  for (let i = 0; i < outputTokens.length; i++) {
    if (outputTokens[i].equals(outputToken)) {
      collectedOutputAmounts.push(amountClaimed)
    } else {
      collectedOutputAmounts.push(ZERO_BI)
    }
  }

  handleClmStrategyFees(event, ZERO_BI, ZERO_BI, collectedOutputAmounts)
}

function handleClmStrategyFees(
  event: ethereum.Event,
  collectedAmount0: BigInt,
  collectedAmount1: BigInt,
  collectedOutputAmounts: Array<BigInt>,
): void {
  let strategy = getClmStrategy(event.address)
  let clm = getCLM(strategy.clm)
  if (!isClmInitialized(clm)) {
    return
  }

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain
  const clmData = fetchCLMData(clm)

  ///////
  // store the raw collect event
  let collect = new ClmManagerCollectionEvent(getEventIdentifier(event))
  collect.clm = clm.id
  collect.strategy = strategy.id
  collect.createdWith = tx.id
  collect.logIndex = event.logIndex
  collect.timestamp = event.block.timestamp
  collect.underlyingMainAmount0 = clmData.token0PositionMainBalance
  collect.underlyingMainAmount1 = clmData.token1PositionMainBalance
  collect.underlyingAltAmount0 = clmData.token0PositionAltBalance
  collect.underlyingAltAmount1 = clmData.token1PositionAltBalance
  collect.collectedAmount0 = collectedAmount0
  collect.collectedAmount1 = collectedAmount1
  collect.collectedOutputAmounts = collectedOutputAmounts
  collect.token0ToNativePrice = clmData.token0ToNativePrice
  collect.token1ToNativePrice = clmData.token1ToNativePrice
  collect.outputToNativePrices = clmData.outputToNativePrices
  collect.rewardToNativePrices = clmData.rewardToNativePrices
  collect.nativeToUSDPrice = clmData.nativeToUSDPrice
  collect.save()

  ///////
  // update clm entity
  updateCLMDataAndSnapshots(clm, clmData, event.block.timestamp)
}
