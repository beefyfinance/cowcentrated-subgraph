import { Classic } from "../../../generated/schema"

import { ClassicData } from "./classic-data"
import { ClassicPosition } from "../../../generated/schema"
import { POSITION_SNAPSHOT_ENABLED } from "../../config"
import { CLASSIC_SNAPSHOT_PERIODS } from "./snapshot"
import { getClassicPositionSnapshot } from "../entity/position"
import { BigInt } from "@graphprotocol/graph-ts"

export function updateClassicPositionSnapshotsIfEnabled(
  classic: Classic,
  classicData: ClassicData,
  position: ClassicPosition,
  timestamp: BigInt,
) {
  // update position snapshots
  if (!POSITION_SNAPSHOT_ENABLED) {
    return
  }

  for (let i = 0; i < CLASSIC_SNAPSHOT_PERIODS.length; i++) {
    const period = CLASSIC_SNAPSHOT_PERIODS[i]
    const snapshot = getClassicPositionSnapshot(position, timestamp, period)
    snapshot.vaultBalance = position.vaultBalance
    snapshot.boostBalance = position.boostBalance
    snapshot.rewardPoolBalances = position.rewardPoolBalances
    snapshot.totalBalance = position.totalBalance
    snapshot.underlyingToNativePrice = classicData.underlyingToNativePrice
    snapshot.underlyingBreakdownToNativePrices = classicData.underlyingBreakdownToNativePrices
    snapshot.boostRewardToNativePrices = classicData.boostRewardToNativePrices
    snapshot.rewardToNativePrices = classicData.rewardToNativePrices
    snapshot.nativeToUSDPrice = classicData.nativeToUSDPrice
    snapshot.save()
  }
}
