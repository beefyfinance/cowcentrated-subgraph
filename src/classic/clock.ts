import { ClockTick } from "../../generated/schema"
import { getBeefyClassicProtocol } from "../common/entity/protocol"
import { isClassicInitialized } from "./entity/classic"
import { isClmManager, isClmRewardPool } from "../clm/entity/clm"
import { fetchClassicData, updateClassicDataAndSnapshots } from "./utils/classic-data"

export function updateClassicDataOnClockTick(tick: ClockTick): void {
  const protocol = getBeefyClassicProtocol()
  const classics = protocol.classics.load()

  for (let i = 0; i < classics.length; i++) {
    const classic = classics[i]
    if (!isClassicInitialized(classic)) {
      continue
    }

    // speed up the process by skipping vaults on non-reward pools
    if (isClmRewardPool(classic.underlyingToken) || isClmManager(classic.underlyingToken)) {
      const classicData = fetchClassicData(classic)
      updateClassicDataAndSnapshots(classic, classicData, tick.timestamp)
    }
  }
}
