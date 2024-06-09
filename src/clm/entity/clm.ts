import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { CLRewardPool, CLStrategy, CLManager, CLMSnapshot, CLM } from "../../../generated/schema"
import { ADDRESS_ZERO } from "../../common/utils/address"
import { ZERO_BI } from "../../common/utils/decimal"
import { getIntervalFromTimestamp } from "../../common/utils/time"
import { getPreviousSnapshotIdSuffix, getSnapshotIdSuffix } from "../../common/utils/snapshot"
import { getBeefyCLProtocol } from "../../common/entity/protocol"
import { getNullToken } from "../../common/entity/token"

export const CLM_LIFECYCLE_INITIALIZING = "INITIALIZING"
export const CLM_LIFECYCLE_RUNNING = "RUNNING"
export const CLM_LIFECYCLE_PAUSED = "PAUSED"

export function isClmInitialized(clm: CLM): boolean {
  return clm.lifecycle != CLM_LIFECYCLE_INITIALIZING
}

export function getCLM(managerAddress: Bytes): CLM {
  let clm = CLM.load(managerAddress)
  if (!clm) {
    clm = new CLM(managerAddress)

    clm.protocol = getBeefyCLProtocol().id
    clm.manager = managerAddress
    clm.strategy = ADDRESS_ZERO
    clm.rewardPool = null
    clm.lifecycle = CLM_LIFECYCLE_INITIALIZING

    clm.managerToken = managerAddress
    clm.rewardPoolToken = getNullToken().id

    clm.underlyingToken0 = ADDRESS_ZERO
    clm.underlyingToken1 = ADDRESS_ZERO
    clm.rewardToken = getNullToken().id

    clm.managerTotalSupply = ZERO_BI
    clm.rewardPoolTotalSupply = ZERO_BI

    clm.token0ToNativePrice = ZERO_BI
    clm.token1ToNativePrice = ZERO_BI
    clm.rewardToNativePrice = ZERO_BI
    clm.nativeToUSDPrice = ZERO_BI

    clm.priceOfToken0InToken1 = ZERO_BI
    clm.priceRangeMin1 = ZERO_BI
    clm.priceRangeMax1 = ZERO_BI

    clm.underlyingMainAmount0 = ZERO_BI
    clm.underlyingMainAmount1 = ZERO_BI
    clm.underlyingAltAmount0 = ZERO_BI
    clm.underlyingAltAmount1 = ZERO_BI
  }
  return clm
}

export function getCLManager(managerAddress: Bytes): CLManager {
  let manager = CLManager.load(managerAddress)
  if (!manager) {
    manager = new CLManager(managerAddress)
    manager.clm = managerAddress
    manager.createdWith = ADDRESS_ZERO
    manager.isInitialized = false
  }
  return manager
}

export function getCLStrategy(strategyAddress: Bytes): CLStrategy {
  let strategy = CLStrategy.load(strategyAddress)
  if (!strategy) {
    strategy = new CLStrategy(strategyAddress)
    strategy.clm = ADDRESS_ZERO
    strategy.manager = ADDRESS_ZERO
    strategy.createdWith = ADDRESS_ZERO
    strategy.isInitialized = false
  }
  return strategy
}

export function getCLRewardPool(rewardPoolAddress: Bytes): CLRewardPool {
  let rewardPool = CLRewardPool.load(rewardPoolAddress)
  if (!rewardPool) {
    rewardPool = new CLRewardPool(rewardPoolAddress)
    rewardPool.clm = ADDRESS_ZERO
    rewardPool.manager = ADDRESS_ZERO
    rewardPool.createdWith = ADDRESS_ZERO
    rewardPool.isInitialized = false
  }
  return rewardPool
}

export function getCLMSnapshot(clm: CLM, timestamp: BigInt, period: BigInt): CLMSnapshot {
  const interval = getIntervalFromTimestamp(timestamp, period)
  const snapshotId = clm.id.concat(getSnapshotIdSuffix(period, interval))
  let snapshot = CLMSnapshot.load(snapshotId)
  if (!snapshot) {
    snapshot = new CLMSnapshot(snapshotId)
    snapshot.clm = clm.id

    snapshot.period = period
    snapshot.timestamp = timestamp
    snapshot.roundedTimestamp = interval

    snapshot.managerTotalSupply = ZERO_BI
    snapshot.rewardPoolTotalSupply = ZERO_BI

    snapshot.token0ToNativePrice = ZERO_BI
    snapshot.token1ToNativePrice = ZERO_BI
    snapshot.rewardToNativePrice = ZERO_BI
    snapshot.nativeToUSDPrice = ZERO_BI

    snapshot.priceOfToken0InToken1 = ZERO_BI
    snapshot.priceRangeMin1 = ZERO_BI
    snapshot.priceRangeMax1 = ZERO_BI

    snapshot.underlyingMainAmount0 = ZERO_BI
    snapshot.underlyingMainAmount1 = ZERO_BI
    snapshot.underlyingAltAmount0 = ZERO_BI
    snapshot.underlyingAltAmount1 = ZERO_BI

    // copy non-reseting values from the previous snapshot to the new snapshot
    const previousSnapshotId = clm.id.concat(getPreviousSnapshotIdSuffix(period, interval))
    const previousSnapshot = CLMSnapshot.load(previousSnapshotId)
    if (previousSnapshot) {
      snapshot.managerTotalSupply = previousSnapshot.managerTotalSupply
      snapshot.rewardPoolTotalSupply = previousSnapshot.rewardPoolTotalSupply
      snapshot.token0ToNativePrice = previousSnapshot.token0ToNativePrice
      snapshot.token1ToNativePrice = previousSnapshot.token1ToNativePrice
      snapshot.rewardToNativePrice = previousSnapshot.rewardToNativePrice
      snapshot.nativeToUSDPrice = previousSnapshot.nativeToUSDPrice
      snapshot.priceOfToken0InToken1 = previousSnapshot.priceOfToken0InToken1
      snapshot.priceRangeMin1 = previousSnapshot.priceRangeMin1
      snapshot.priceRangeMax1 = previousSnapshot.priceRangeMax1
      snapshot.underlyingMainAmount0 = previousSnapshot.underlyingMainAmount0
      snapshot.underlyingMainAmount1 = previousSnapshot.underlyingMainAmount1
      snapshot.underlyingAltAmount0 = previousSnapshot.underlyingAltAmount0
      snapshot.underlyingAltAmount1 = previousSnapshot.underlyingAltAmount1
    }
  }

  return snapshot
}
