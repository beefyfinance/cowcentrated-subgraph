import { ClockTick } from "../../generated/schema"
import { getBeefyClassicProtocol } from "../common/entity/protocol"
import { POSITION_SNAPSHOT_ENABLED } from "../config"
import { hasClassicBeenRemoved, isClassicInitialized } from "./entity/classic"
import { fetchClassicData, updateClassicDataAndSnapshots } from "./utils/classic-data"
import { updateClassicPositionSnapshotsIfEnabled } from "./utils/position-snapshot"
import { log } from "@graphprotocol/graph-ts"

export function updateClassicDataOnClockTick(tick: ClockTick): void {
  const protocol = getBeefyClassicProtocol()
  const classics = protocol.classics.load()

  for (let i = 0; i < classics.length; i++) {
    const classic = classics[i]
    if (!isClassicInitialized(classic)) {
      log.debug("Classic vault {} is not initialized, skipping updateClassicDataOnClockTick", [
        classic.id.toHexString(),
      ])
      continue
    }
    if (hasClassicBeenRemoved(classic)) {
      log.error("Classic vault {} has been removed, skipping updateClassicDataOnClockTick", [classic.id.toHexString()])
      continue
    }

    const classicData = fetchClassicData(classic)
    updateClassicDataAndSnapshots(classic, classicData, tick.timestamp)

    // update position snapshots
    if (POSITION_SNAPSHOT_ENABLED) {
      const positions = classic.positions.load()
      log.info("Updating {} Classic position snapshots", [positions.length.toString()])
      for (let j = 0; j < positions.length; j++) {
        const position = positions[j]
        updateClassicPositionSnapshotsIfEnabled(classic, classicData, position, tick.timestamp)
      }
    }
  }
}
