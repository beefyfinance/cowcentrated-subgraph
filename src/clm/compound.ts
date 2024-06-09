import { BigInt, ethereum } from "@graphprotocol/graph-ts"
import {
  Harvest as CLMHarvestEvent,
  HarvestRewards as CLMHarvestRewardsEvent,
  ClaimedFees as CLMClaimedFeesEvent,
  ClaimedRewards as CLMClaimedRewardsEvent,
} from "../../generated/templates/CLStrategy/CLStrategy"
import { getCLStrategy, getCLM, isClmInitialized } from "./entity/clm"
import { getTransaction } from "../common/entity/transaction"
import { CLHarvestEvent, CLManagerCollectionEvent } from "../../generated/schema"
import { ZERO_BI } from "../common/utils/decimal"
import { getEventIdentifier } from "../common/utils/event"
import { updateCLMDataAndSnapshots, fetchCLMData } from "./utils/clm-data"

export function handleCLStrategyHarvestAmounts(event: CLMHarvestEvent): void {
  handleClmStrategyHarvest(event, event.params.fee0, event.params.fee1, ZERO_BI)
}

export function handleCLStrategyHarvestRewards(event: CLMHarvestRewardsEvent): void {
  handleClmStrategyHarvest(event, ZERO_BI, ZERO_BI, event.params.fees)
}

function handleClmStrategyHarvest(
  event: ethereum.Event,
  compoundedAmount0: BigInt,
  compoundedAmount1: BigInt,
  collectedRewards: BigInt,
): void {
  let strategy = getCLStrategy(event.address)
  let clm = getCLM(strategy.clm)
  if (!isClmInitialized(clm)) {
    return
  }

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain
  const vaultData = fetchCLMData(clm)

  ///////
  // store the raw harvest event
  let harvest = new CLHarvestEvent(getEventIdentifier(event))
  harvest.clm = clm.id
  harvest.strategy = strategy.id
  harvest.createdWith = tx.id
  harvest.timestamp = event.block.timestamp
  harvest.underlyingAmount0 = vaultData.token0Balance
  harvest.underlyingAmount1 = vaultData.token1Balance
  harvest.compoundedAmount0 = compoundedAmount0
  harvest.compoundedAmount1 = compoundedAmount1
  harvest.collectedRewards = collectedRewards
  harvest.managerTotalSupply = vaultData.managerTotalSupply
  harvest.rewardPoolTotalSupply = vaultData.rewardPoolTotalSupply
  harvest.token0ToNativePrice = vaultData.token0ToNativePrice
  harvest.token1ToNativePrice = vaultData.token1ToNativePrice
  harvest.rewardToNativePrice = vaultData.rewardToNativePrice
  harvest.nativeToUSDPrice = vaultData.nativeToUSDPrice
  harvest.save()
}

export function handleCLStrategyClaimedFees(event: CLMClaimedFeesEvent): void {
  handleClmStrategyFees(
    event,
    event.params.feeAlt0.plus(event.params.feeMain0),
    event.params.feeAlt1.plus(event.params.feeMain1),
    ZERO_BI,
  )
}
export function handleCLStrategyClaimedRewards(event: CLMClaimedRewardsEvent): void {
  handleClmStrategyFees(event, ZERO_BI, ZERO_BI, event.params.fees)
}

function handleClmStrategyFees(
  event: ethereum.Event,
  collectedAmount0: BigInt,
  collectedAmount1: BigInt,
  collectedRewardAmount: BigInt,
): void {
  let strategy = getCLStrategy(event.address)
  let clm = getCLM(strategy.clm)
  if (!isClmInitialized(clm)) {
    return
  }

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain
  const vaultData = fetchCLMData(clm)

  ///////
  // store the raw collect event
  let collect = new CLManagerCollectionEvent(getEventIdentifier(event))
  collect.clm = clm.id
  collect.strategy = strategy.id
  collect.createdWith = tx.id
  collect.timestamp = event.block.timestamp
  collect.underlyingMainAmount0 = vaultData.token0PositionMainBalance
  collect.underlyingMainAmount1 = vaultData.token1PositionMainBalance
  collect.underlyingAltAmount0 = vaultData.token0PositionAltBalance
  collect.underlyingAltAmount1 = vaultData.token1PositionAltBalance
  collect.collectedAmount0 = collectedAmount0
  collect.collectedAmount1 = collectedAmount1
  collect.collectedRewardAmount = collectedRewardAmount
  collect.token0ToNativePrice = vaultData.token0ToNativePrice
  collect.token1ToNativePrice = vaultData.token1ToNativePrice
  collect.rewardToNativePrice = vaultData.rewardToNativePrice
  collect.nativeToUSDPrice = vaultData.nativeToUSDPrice
  collect.save()

  ///////
  // update vault entity
  updateCLMDataAndSnapshots(clm, vaultData, event.block.timestamp)
}
