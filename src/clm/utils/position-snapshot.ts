import { BigInt } from "@graphprotocol/graph-ts"
import { CLM, ClmPosition } from "../../../generated/schema"
import { CLMData } from "./clm-data"
import { getClmPositionSnapshot } from "../entity/position"
import { POSITION_SNAPSHOT_ENABLED } from "../../config"
import { CLM_SNAPSHOT_PERIODS } from "./snapshot"

export function updateClmPositionSnapshotsIfEnabled(
  clm: CLM,
  clmData: CLMData,
  position: ClmPosition,
  timestamp: BigInt,
) {
  // update position snapshots
  if (!POSITION_SNAPSHOT_ENABLED) {
    return
  }

  for (let i = 0; i < CLM_SNAPSHOT_PERIODS.length; i++) {
    const period = CLM_SNAPSHOT_PERIODS[i]
    const snapshot = getClmPositionSnapshot(position, timestamp, period)
    snapshot.managerBalance = position.managerBalance
    snapshot.rewardPoolBalances = position.rewardPoolBalances
    snapshot.totalBalance = position.totalBalance
    snapshot.token0ToNativePrice = clmData.token0ToNativePrice
    snapshot.token1ToNativePrice = clmData.token1ToNativePrice
    snapshot.outputToNativePrices = clmData.outputToNativePrices
    snapshot.rewardToNativePrices = clmData.rewardToNativePrices
    snapshot.nativeToUSDPrice = clmData.nativeToUSDPrice
    snapshot.save()
  }
}
