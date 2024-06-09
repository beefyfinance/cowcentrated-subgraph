import { ethereum, log } from "@graphprotocol/graph-ts"
import { ClockTick } from "../../generated/schema"
import { HOUR } from "../common/utils/time"
import { getClockTick } from "../common/entity/clock"
import { getBeefyCLProtocol } from "../common/entity/protocol"
import { updateCLMDataAndSnapshots, fetchCLMData } from "./utils/clm-data"
import { isClmInitialized } from "./entity/clm"

export function handleClockTick(block: ethereum.Block): void {
  const timestamp = block.timestamp

  let tickRes1h = getClockTick(timestamp, HOUR)
  if (!tickRes1h.isNew) {
    log.debug("handleClockTick: tick already exists for 1h period", [])
    return
  }
  tickRes1h.tick.save()

  updateDataOnClockTick(tickRes1h.tick)
}

function updateDataOnClockTick(tick: ClockTick): void {
  const protocol = getBeefyCLProtocol()
  const clms = protocol.clms.load()

  for (let i = 0; i < clms.length; i++) {
    const clm = clms[i]
    if (!isClmInitialized(clm)) {
      continue
    }
    const clmData = fetchCLMData(clm)
    updateCLMDataAndSnapshots(clm, clmData, tick.timestamp)
  }
}
