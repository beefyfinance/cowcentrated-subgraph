import { ethereum, log } from "@graphprotocol/graph-ts"
import { HOUR } from "../common/utils/time"
import { getClockTick } from "../common/entity/clock"
import { updateClmDataOnClockTick } from "../clm/clock"
import { updateClassicDataOnClockTick } from "../classic/clock"

export function handleClockTick(block: ethereum.Block): void {
  const timestamp = block.timestamp

  let tickRes1h = getClockTick(timestamp, HOUR)
  if (!tickRes1h.isNew) {
    log.debug("handleClockTick: tick already exists for {}", [
      tickRes1h.tick.id.toHexString(),
    ])
    return
  }
  tickRes1h.tick.save()

  updateClmDataOnClockTick(tickRes1h.tick)
  updateClassicDataOnClockTick(tickRes1h.tick)
}
