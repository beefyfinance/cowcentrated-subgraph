import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { ClmRewardPool, ClmStrategy, ClmManager, ClmSnapshot, CLM } from "../../../generated/schema"
import { ADDRESS_ZERO } from "../../common/utils/address"
import { ZERO_BI } from "../../common/utils/decimal"
import { getIntervalFromTimestamp } from "../../common/utils/time"
import { getPreviousSnapshotIdSuffix, getSnapshotIdSuffix } from "../../common/utils/snapshot"
import { getBeefyCLProtocol } from "../../common/entity/protocol"
import { getNullToken } from "../../common/entity/token"
import { PRODUCT_LIFECYCLE_INITIALIZING } from "../../common/entity/lifecycle"

export function isClmInitialized(clm: CLM): boolean {
  return clm.lifecycle != PRODUCT_LIFECYCLE_INITIALIZING
}

export function isClmManagerAddress(managerAddress: Bytes): boolean {
  return ClmManager.load(managerAddress) != null
}

export function getCLM(managerAddress: Bytes): CLM {
  let clm = CLM.load(managerAddress)
  if (!clm) {
    clm = new CLM(managerAddress)

    clm.protocol = getBeefyCLProtocol().id
    clm.manager = managerAddress
    clm.strategy = ADDRESS_ZERO
    clm.lifecycle = PRODUCT_LIFECYCLE_INITIALIZING

    clm.managerToken = managerAddress
    clm.rewardPoolTokens = []
    clm.rewardPoolTokensOrder = []

    clm.underlyingToken0 = ADDRESS_ZERO
    clm.underlyingToken1 = ADDRESS_ZERO
    clm.outputTokens = []
    clm.outputTokensOrder = []
    clm.rewardTokens = []
    clm.rewardTokensOrder = []

    clm.managerTotalSupply = ZERO_BI
    clm.rewardPoolsTotalSupply = []

    clm.token0ToNativePrice = ZERO_BI
    clm.token1ToNativePrice = ZERO_BI
    clm.outputToNativePrices = []
    clm.rewardToNativePrices = []
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

export function isClmManager(managerAddress: Bytes): boolean {
  return ClmManager.load(managerAddress) != null
}

export function getClmManager(managerAddress: Bytes): ClmManager {
  let manager = ClmManager.load(managerAddress)
  if (!manager) {
    manager = new ClmManager(managerAddress)
    manager.clm = managerAddress
    manager.createdWith = ADDRESS_ZERO
    manager.isInitialized = false
  }
  return manager
}

export function getClmStrategy(strategyAddress: Bytes): ClmStrategy {
  let strategy = ClmStrategy.load(strategyAddress)
  if (!strategy) {
    strategy = new ClmStrategy(strategyAddress)
    strategy.clm = ADDRESS_ZERO
    strategy.manager = ADDRESS_ZERO
    strategy.createdWith = ADDRESS_ZERO
    strategy.outputToken = getNullToken().id
    strategy.isInitialized = false
  }
  return strategy
}

export function isClmRewardPool(rewardPoolAddress: Bytes): boolean {
  return ClmRewardPool.load(rewardPoolAddress) != null
}

export function getClmRewardPool(rewardPoolAddress: Bytes): ClmRewardPool {
  let rewardPool = ClmRewardPool.load(rewardPoolAddress)
  if (!rewardPool) {
    rewardPool = new ClmRewardPool(rewardPoolAddress)
    rewardPool.clm = ADDRESS_ZERO
    rewardPool.manager = ADDRESS_ZERO
    rewardPool.createdWith = ADDRESS_ZERO
    rewardPool.isInitialized = false
  }
  return rewardPool
}

export function getClmSnapshot(clm: CLM, timestamp: BigInt, period: BigInt): ClmSnapshot {
  const interval = getIntervalFromTimestamp(timestamp, period)
  const snapshotId = clm.id.concat(getSnapshotIdSuffix(period, interval))
  let snapshot = ClmSnapshot.load(snapshotId)
  if (!snapshot) {
    snapshot = new ClmSnapshot(snapshotId)
    snapshot.clm = clm.id

    snapshot.period = period
    snapshot.timestamp = timestamp
    snapshot.roundedTimestamp = interval

    snapshot.managerTotalSupply = ZERO_BI
    snapshot.rewardPoolsTotalSupply = []

    snapshot.token0ToNativePrice = ZERO_BI
    snapshot.token1ToNativePrice = ZERO_BI
    snapshot.outputToNativePrices = []
    snapshot.rewardToNativePrices = []
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
    const previousSnapshot = ClmSnapshot.load(previousSnapshotId)
    if (previousSnapshot) {
      snapshot.managerTotalSupply = previousSnapshot.managerTotalSupply
      snapshot.rewardPoolsTotalSupply = previousSnapshot.rewardPoolsTotalSupply
      snapshot.token0ToNativePrice = previousSnapshot.token0ToNativePrice
      snapshot.token1ToNativePrice = previousSnapshot.token1ToNativePrice
      snapshot.outputToNativePrices = previousSnapshot.outputToNativePrices
      snapshot.rewardToNativePrices = previousSnapshot.rewardToNativePrices
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
