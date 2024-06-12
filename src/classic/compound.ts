import { BigInt, ethereum } from "@graphprotocol/graph-ts"
import { StratHarvest as HarvestEvent } from "../../generated/templates/ClassicStrategy/ClassicStrategy"
import { getTransaction } from "../common/entity/transaction"
import { ClassicHarvestEvent } from "../../generated/schema"
import { getEventIdentifier } from "../common/utils/event"
import { getClassic, getClassicStrategy, isClassicInitialized } from "./entity/classic"
import { fetchClassicData } from "./utils/classic-data"

export function handleClassicStrategyHarvest(event: HarvestEvent): void {
  _handleClassicStrategyHarvest(event, event.params.wantHarvested)
}

function _handleClassicStrategyHarvest(event: ethereum.Event, compoundedAmount: BigInt): void {
  let strategy = getClassicStrategy(event.address)
  let classic = getClassic(strategy.classic)
  if (!isClassicInitialized(classic)) {
    return
  }

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain
  const classicData = fetchClassicData(classic)

  ///////
  // store the raw harvest event
  let harvest = new ClassicHarvestEvent(getEventIdentifier(event))
  harvest.classic = classic.id
  harvest.strategy = strategy.id
  harvest.createdWith = tx.id
  harvest.logIndex = event.logIndex
  harvest.timestamp = event.block.timestamp
  harvest.underlyingAmount = classicData.underlyingAmount
  harvest.compoundedAmount = compoundedAmount
  harvest.vaultSharesTotalSupply = classicData.vaultSharesTotalSupply
  harvest.underlyingToNativePrice = classicData.nativeToUSDPrice
  harvest.nativeToUSDPrice = classicData.nativeToUSDPrice
  harvest.save()
}
