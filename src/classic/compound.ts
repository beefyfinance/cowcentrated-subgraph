import { BigInt, ethereum, log } from "@graphprotocol/graph-ts"
import { StratHarvest as HarvestEvent, StratHarvest1 as HarvestEvent1 } from "../../generated/templates/ClassicStrategy/ClassicStrategy"
import { getAndSaveTransaction } from "../common/entity/transaction"
import { ClassicHarvestEvent } from "../../generated/schema"
import { getEventIdentifier } from "../common/utils/event"
import { getClassic, getClassicStrategy, hasClassicBeenRemoved, isClassicInitialized } from "./entity/classic"
import { fetchClassicData, updateClassicDataAndSnapshots } from "./utils/classic-data"

export function handleClassicStrategyHarvestAllIndexed(event: HarvestEvent1): void {
  _handleClassicStrategyHarvest(event, event.params.wantHarvested)
}

export function handleClassicStrategyHarvest(event: HarvestEvent): void {
  _handleClassicStrategyHarvest(event, event.params.wantHarvested)
}

function _handleClassicStrategyHarvest(event: ethereum.Event, compoundedAmount: BigInt): void {
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
  let harvest = new ClassicHarvestEvent(getEventIdentifier(event))
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
