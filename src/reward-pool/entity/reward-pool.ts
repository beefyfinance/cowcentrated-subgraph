import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { RewardPool, RewardPoolSnapshot } from "../../../generated/schema"
import { ADDRESS_ZERO } from "../../common/utils/address"
import { ZERO_BI } from "../../common/utils/decimal"
import { getIntervalFromTimestamp } from "../../common/utils/time"
import { getPreviousSnapshotIdSuffix, getSnapshotIdSuffix } from "../../common/utils/snapshot"
import { PRODUCT_LIFECYCLE_INITIALIZING } from "../../common/entity/lifecycle"
import { getBeefyRewardPoolProtocol } from "../../common/entity/protocol"

export function isRewardPool(rewardPoolAddress: Bytes): boolean {
  return RewardPool.load(rewardPoolAddress) != null
}

export function isRewardPoolInitialized(rewardPoolAddress: Bytes): boolean {
  let rewardPool = RewardPool.load(rewardPoolAddress)
  return rewardPool != null && rewardPool.lifecycle != PRODUCT_LIFECYCLE_INITIALIZING
}

export function getRewardPool(rewardPoolAddress: Bytes): RewardPool {
  let rewardPool = RewardPool.load(rewardPoolAddress)
  if (!rewardPool) {
    rewardPool = new RewardPool(rewardPoolAddress)
    rewardPool.protocol = getBeefyRewardPoolProtocol().id
    rewardPool.lifecycle = PRODUCT_LIFECYCLE_INITIALIZING
    rewardPool.createdWith = ADDRESS_ZERO
    rewardPool.shareToken = ADDRESS_ZERO
    rewardPool.rewardTokens = []
    rewardPool.rewardTokensOrder = []
    rewardPool.underlyingToken = ADDRESS_ZERO
    rewardPool.sharesTotalSupply = ZERO_BI
    rewardPool.underlyingToNativePrice = ZERO_BI
    rewardPool.rewardToNativePrices = []
    rewardPool.nativeToUSDPrice = ZERO_BI
    rewardPool.underlyingAmount = ZERO_BI
  }
  return rewardPool
}

export function getRewardPoolSnapshot(rewardPool: RewardPool, timestamp: BigInt, period: BigInt): RewardPoolSnapshot {
  const interval = getIntervalFromTimestamp(timestamp, period)
  const snapshotId = rewardPool.id.concat(getSnapshotIdSuffix(period, interval))
  let snapshot = RewardPoolSnapshot.load(snapshotId)
  if (!snapshot) {
    snapshot = new RewardPoolSnapshot(snapshotId)
    snapshot.rewardPool = rewardPool.id

    snapshot.period = period
    snapshot.timestamp = timestamp
    snapshot.roundedTimestamp = interval

    snapshot.sharesTotalSupply = ZERO_BI

    snapshot.underlyingToNativePrice = ZERO_BI
    snapshot.rewardToNativePrices = []
    snapshot.nativeToUSDPrice = ZERO_BI

    snapshot.underlyingAmount = ZERO_BI

    // copy non-reseting values from the previous snapshot to the new snapshot
    const previousSnapshotId = rewardPool.id.concat(getPreviousSnapshotIdSuffix(period, interval))
    const previousSnapshot = RewardPoolSnapshot.load(previousSnapshotId)
    if (previousSnapshot) {
      snapshot.sharesTotalSupply = previousSnapshot.sharesTotalSupply
      snapshot.underlyingToNativePrice = previousSnapshot.underlyingToNativePrice
      snapshot.rewardToNativePrices = previousSnapshot.rewardToNativePrices
      snapshot.nativeToUSDPrice = previousSnapshot.nativeToUSDPrice
      snapshot.underlyingAmount = previousSnapshot.underlyingAmount
    }
  }

  return snapshot
}
