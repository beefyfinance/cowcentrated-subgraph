import { ClockTick } from "../../generated/schema"
import { getBeefyClassicProtocol } from "../common/entity/protocol"
import { hasClassicBeenRemoved, isClassicInitialized } from "./entity/classic"
import { isClmManager, isClmRewardPool } from "../clm/entity/clm"
import { fetchClassicData, updateClassicDataAndSnapshots } from "./utils/classic-data"
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
  }
}
