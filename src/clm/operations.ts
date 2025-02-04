import { BigInt, ethereum } from "@graphprotocol/graph-ts"
import {
  TVL as CLMStrategyTVLEvent,
  MoveTicksCall as ClmStrategyMoveTicksCall,
} from "../../generated/templates/ClmStrategy/ClmStrategy"
import { getClmStrategy, getCLM } from "./entity/clm"
import { getTransaction } from "../common/entity/transaction"
import { ClmStrategyTVLEvent, ClmMoveTickCall } from "../../generated/schema"
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

export function handleClmStrategyMoveTicks(call: ClmStrategyMoveTicksCall): void {
  const strategy = getClmStrategy(call.to)

  const clm = getCLM(strategy.clm)

  const tx = getTransaction(call.block, call.transaction)
  tx.save()

  const id = strategy.id.concat(call.transaction.hash)
  const moveTickCall = new ClmMoveTickCall(id)
  moveTickCall.clm = clm.id
  moveTickCall.strategy = strategy.id
  moveTickCall.createdWith = tx.id
  moveTickCall.blockNumber = call.block.number
  moveTickCall.timestamp = call.block.timestamp
  moveTickCall.sender = call.from
  moveTickCall.save()
}
