import { ClockTick } from "../../generated/schema"
import { getBeefyCLProtocol } from "../common/entity/protocol"
import { updateCLMDataAndSnapshots, fetchCLMData } from "./utils/clm-data"
import { isClmInitialized } from "./entity/clm"

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
  }
}
