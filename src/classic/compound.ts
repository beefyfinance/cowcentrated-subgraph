import { BigInt, ethereum, log } from "@graphprotocol/graph-ts"
import { StratHarvest as HarvestEvent0 } from "../../generated/templates/ClassicStrategy/ClassicStrategyStratHarvest0"
import { StratHarvest as HarvestEvent1 } from "../../generated/templates/ClassicStrategy/ClassicStrategyStratHarvest1"
import { ChargedFees as ClassicCharged2FeesEvent } from "../../generated/templates/ClassicStrategy/ClassicStrategy"
import { ChargedFees1 as ClassicCharged3FeesEvent } from "../../generated/templates/ClassicStrategy/ClassicStrategy"
import { getAndSaveTransaction } from "../common/entity/transaction"
import { ClassicHarvestEvent } from "../../generated/schema"
import { getEventIdentifier } from "../common/utils/event"
import {
  getClassic,
  getClassicSnapshot,
  getClassicStrategy,
  hasClassicBeenRemoved,
  isClassicInitialized,
} from "./entity/classic"
import { fetchClassicData, updateClassicDataAndSnapshots } from "./utils/classic-data"
import { ZERO_BI } from "../common/utils/decimal"
import { CLASSIC_SNAPSHOT_PERIODS } from "./utils/snapshot"

export function handleClassicStrategyHarvest0(event: HarvestEvent0): void {
  _handleClassicStrategyHarvest(event, event.params.wantHarvested)
}

export function handleClassicStrategyHarvest1(event: HarvestEvent1): void {
  _handleClassicStrategyHarvest(event, event.params.wantHarvested)
}

export function _handleClassicStrategyHarvest(event: ethereum.Event, compoundedAmount: BigInt): void {
  let strategy = getClassicStrategy(event.address)
  let classic = getClassic(strategy.classic)
  if (!isClassicInitialized(classic)) {
    log.warning("Classic vault {} is not initialized, ignoring _handleClassicStrategyHarvest", [
      classic.id.toHexString(),
    ])
    return
  }
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring _handleClassicStrategyHarvest", [classic.id.toHexString()])
    return
  }

  let tx = getAndSaveTransaction(event.block, event.transaction)

  ///////
  // fetch data on chain
  const classicData = fetchClassicData(classic)
  updateClassicDataAndSnapshots(classic, classicData, event.block.timestamp)

  ///////
  // store the raw harvest event
  let eventId = getEventIdentifier(event)
  let harvest = ClassicHarvestEvent.load(eventId)
  if (!harvest) {
    harvest = new ClassicHarvestEvent(eventId)
    harvest.classic = classic.id
    harvest.strategy = strategy.id
    harvest.createdWith = tx.id
    harvest.blockNumber = event.block.number
    harvest.logIndex = event.logIndex
    harvest.timestamp = event.block.timestamp
    harvest.underlyingAmount = classicData.underlyingAmount
    harvest.compoundedAmount = compoundedAmount
    harvest.vaultSharesTotalSupply = classicData.vaultSharesTotalSupply
    harvest.rewardPoolsTotalSupply = classicData.rewardPoolsTotalSupply
    harvest.underlyingToNativePrice = classicData.underlyingToNativePrice
    harvest.boostRewardToNativePrices = classicData.boostRewardToNativePrices
    harvest.rewardToNativePrices = classicData.rewardToNativePrices
    harvest.nativeToUSDPrice = classicData.nativeToUSDPrice
    harvest.save()
  }
}

export function handleClassicStrategyCharged2Fees(event: ClassicCharged2FeesEvent): void {
  const callFees = ZERO_BI
  const beefyFees = event.params.beefyFee
  const strategistFees = event.params.liquidityFee
  _handleClassicStrategyChargedFees(event, callFees, beefyFees, strategistFees)
}

export function handleClassicStrategyCharged3Fees(event: ClassicCharged3FeesEvent): void {
  const callFees = event.params.callFees
  const beefyFees = event.params.beefyFees
  const strategistFees = event.params.strategistFees
  _handleClassicStrategyChargedFees(event, callFees, beefyFees, strategistFees)
}

function _handleClassicStrategyChargedFees(
  event: ethereum.Event,
  callFees: BigInt,
  beefyFees: BigInt,
  strategistFees: BigInt,
): void {
  let strategy = getClassicStrategy(event.address)
  let classic = getClassic(strategy.classic)
  if (!isClassicInitialized(classic)) {
    log.warning("Classic vault {} is not initialized, ignoring _handleClassicStrategyHarvest", [
      classic.id.toHexString(),
    ])
    return
  }

  classic.totalCallFees = classic.totalCallFees.plus(callFees)
  classic.totalBeefyFees = classic.totalBeefyFees.plus(beefyFees)
  classic.totalStrategistFees = classic.totalStrategistFees.plus(strategistFees)
  classic.save()

  for (let i = 0; i < CLASSIC_SNAPSHOT_PERIODS.length; i++) {
    const period = CLASSIC_SNAPSHOT_PERIODS[i]
    const snapshot = getClassicSnapshot(classic, event.block.timestamp, period)
    snapshot.totalCallFees = snapshot.totalCallFees.plus(callFees)
    snapshot.totalBeefyFees = snapshot.totalBeefyFees.plus(beefyFees)
    snapshot.totalStrategistFees = snapshot.totalStrategistFees.plus(strategistFees)
    snapshot.save()
  }
}
