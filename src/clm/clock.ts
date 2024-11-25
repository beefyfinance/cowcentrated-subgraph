import { ClockTick } from "../../generated/schema"
import { getBeefyCLProtocol } from "../common/entity/protocol"
import { updateCLMDataAndSnapshots, fetchCLMData } from "./utils/clm-data"
import { isClmInitialized } from "./entity/clm"
import { updateClmPositionSnapshotsIfEnabled } from "./utils/position-snapshot"
import { log } from "@graphprotocol/graph-ts"
import { POSITION_SNAPSHOT_ENABLED } from "../config"

export function updateClmDataOnClockTick(tick: ClockTick): void {
  const protocol = getBeefyCLProtocol()
  const clms = protocol.clms.load()

  for (let i = 0; i < clms.length; i++) {
    const clm = clms[i]
    if (!isClmInitialized(clm)) {
      continue
    }
    const clmData = fetchCLMData(clm)
    updateCLMDataAndSnapshots(clm, clmData, tick.timestamp)

    // update position snapshots
    if (POSITION_SNAPSHOT_ENABLED) {
      const positions = clm.positions.load()
      log.info("Updating {} CLM position snapshots", [positions.length.toString()])
      for (let j = 0; j < positions.length; j++) {
        const position = positions[j]
        updateClmPositionSnapshotsIfEnabled(clm, clmData, position, tick.timestamp)
      }
    }
  }
}
