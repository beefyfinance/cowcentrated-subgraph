import { BigInt, log } from "@graphprotocol/graph-ts"
import { CLM, ClmPosition } from "../../../generated/schema"
import { CLMData } from "./clm-data"
import { getClmPositionSnapshot } from "../entity/position"
import { POSITION_SNAPSHOT_ENABLED } from "../../config"
import { CLM_SNAPSHOT_PERIODS } from "./snapshot"
import { ZERO_BI } from "../../common/utils/decimal"
import { isClmInitialized } from "../entity/clm"
import { getToken } from "../../common/entity/token"

export function updateClmPositionSnapshotsIfEnabled(
  clm: CLM,
  clmData: CLMData,
  position: ClmPosition,
  timestamp: BigInt,
): void {
  // update position snapshots
  if (!POSITION_SNAPSHOT_ENABLED) {
    return
  }

  if (!isClmInitialized(clm)) {
    log.debug("CLM {} is not initialized, skipping updateClmPositionSnapshots", [clm.id.toHexString()])
    return
  }

  if (position.totalBalance.equals(ZERO_BI)) {
    log.debug("CLM position {} has no balance, skipping updateClmPositionSnapshots", [position.id.toHexString()])
    return
  }

  for (let i = 0; i < CLM_SNAPSHOT_PERIODS.length; i++) {
    const period = CLM_SNAPSHOT_PERIODS[i]
    const snapshot = getClmPositionSnapshot(position, timestamp, period)
    snapshot.managerBalance = position.managerBalance
    snapshot.rewardPoolBalances = position.rewardPoolBalances
    snapshot.totalBalance = position.totalBalance
    snapshot.underlyingBalance0 = clmData.totalUnderlyingAmount0.times(position.managerBalance).div(clmData.managerTotalSupply)
    snapshot.underlyingBalance1 = clmData.totalUnderlyingAmount1.times(position.managerBalance).div(clmData.managerTotalSupply)
    snapshot.token0ToNativePrice = clmData.token0ToNativePrice
    snapshot.token1ToNativePrice = clmData.token1ToNativePrice
    snapshot.outputToNativePrices = clmData.outputToNativePrices
    snapshot.rewardToNativePrices = clmData.rewardToNativePrices
    snapshot.nativeToUSDPrice = clmData.nativeToUSDPrice
    snapshot.save()
  }
}
