import { BigInt, ethereum } from "@graphprotocol/graph-ts"
import {
  TVL as CLMStrategyTVLEvent,
} from "../../generated/templates/ClmStrategy/ClmStrategy"
import { getClmStrategy, getCLM } from "./entity/clm"
import { getTransaction } from "../common/entity/transaction"
import { ClmStrategyTVLEvent } from "../../generated/schema"
import { getEventIdentifier } from "../common/utils/event"

export function handleClmStrategyTVL(event: CLMStrategyTVLEvent): void {

  const strategy = getClmStrategy(event.address)
  const clm = getCLM(strategy.clm)

  const underlyingAmount0 = event.params.bal0
  const underlyingAmount1 = event.params.bal1

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  const clmStrategyTVLEvent = new ClmStrategyTVLEvent(getEventIdentifier(event))
  clmStrategyTVLEvent.clm = clm.id
  clmStrategyTVLEvent.strategy = strategy.id
  clmStrategyTVLEvent.createdWith = tx.id
  clmStrategyTVLEvent.logIndex = event.logIndex
  clmStrategyTVLEvent.timestamp = event.block.timestamp
  clmStrategyTVLEvent.underlyingAmount0 = underlyingAmount0
  clmStrategyTVLEvent.underlyingAmount1 = underlyingAmount1

  clmStrategyTVLEvent.save()
}
