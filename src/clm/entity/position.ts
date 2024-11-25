import { BigInt, Bytes, store } from "@graphprotocol/graph-ts"
import { Investor, ClmPosition, CLM, ClmPositionSnapshot } from "../../../generated/schema"
import { ADDRESS_ZERO } from "../../common/utils/address"
import { ZERO_BI } from "../../common/utils/decimal"
import { getIntervalFromTimestamp } from "../../common/utils/time"
import { getPreviousSnapshotIdSuffix, getSnapshotIdSuffix } from "../../common/utils/snapshot"

// @ts-ignore
@inline
function getPositionId(clm: CLM, investor: Investor): Bytes {
  return clm.id.concat(investor.id)
}

export function getClmPosition(clm: CLM, investor: Investor): ClmPosition {
  let id = getPositionId(clm, investor)
  let position = ClmPosition.load(id)
  if (!position) {
    position = new ClmPosition(id)
    position.clm = clm.id
    position.investor = investor.id
    position.createdWith = ADDRESS_ZERO
    position.managerBalance = ZERO_BI
    position.rewardPoolBalances = []
    position.totalBalance = ZERO_BI
  }
  return position
}

export function removeClmPosition(clm: CLM, investor: Investor): void {
  const id = getPositionId(clm, investor)
  store.remove("ClmPosition", id.toHexString())
}

export function getClmPositionSnapshot(position: ClmPosition, timestamp: BigInt, period: BigInt): ClmPositionSnapshot {
  const interval = getIntervalFromTimestamp(timestamp, period)
  const snapshotId = position.id.concat(getSnapshotIdSuffix(period, interval))
  let snapshot = ClmPositionSnapshot.load(snapshotId)
  if (!snapshot) {
    snapshot = new ClmPositionSnapshot(snapshotId)
    snapshot.clm = position.clm
    snapshot.investor = position.investor
    snapshot.investorPosition = position.id

    snapshot.period = period
    snapshot.timestamp = timestamp
    snapshot.roundedTimestamp = interval

    snapshot.managerBalance = ZERO_BI
    snapshot.rewardPoolBalances = []
    snapshot.totalBalance = ZERO_BI

    snapshot.token0ToNativePrice = ZERO_BI
    snapshot.token1ToNativePrice = ZERO_BI
    snapshot.outputToNativePrices = []
    snapshot.rewardToNativePrices = []
    snapshot.nativeToUSDPrice = ZERO_BI

    // copy non-reseting values from the previous snapshot to the new snapshot
    const previousSnapshotId = position.id.concat(getPreviousSnapshotIdSuffix(period, interval))
    const previousSnapshot = ClmPositionSnapshot.load(previousSnapshotId)
    if (previousSnapshot) {
      snapshot.managerBalance = previousSnapshot.managerBalance
      snapshot.rewardPoolBalances = previousSnapshot.rewardPoolBalances
      snapshot.totalBalance = previousSnapshot.totalBalance
      snapshot.token0ToNativePrice = previousSnapshot.token0ToNativePrice
      snapshot.token1ToNativePrice = previousSnapshot.token1ToNativePrice
      snapshot.outputToNativePrices = previousSnapshot.outputToNativePrices
      snapshot.rewardToNativePrices = previousSnapshot.rewardToNativePrices
      snapshot.nativeToUSDPrice = previousSnapshot.nativeToUSDPrice
    }
  }

  return snapshot
}
