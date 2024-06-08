import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { BeefyCLRewardPool, BeefyCLStrategy, BeefyCLVault, BeefyCLVaultSnapshot } from "../../generated/schema"
import { ADDRESS_ZERO } from "../utils/address"
import { ZERO_BI } from "../utils/decimal"
import { getIntervalFromTimestamp } from "../utils/time"
import { getPreviousSnapshotIdSuffix, getSnapshotIdSuffix } from "../utils/snapshot"
import { getBeefyCLProtocol } from "./protocol"
import { getNullToken } from "./token"

export const BEEFY_CL_VAULT_LIFECYCLE_INITIALIZING = "INITIALIZING"
export const BEEFY_CL_VAULT_LIFECYCLE_RUNNING = "RUNNING"
export const BEEFY_CL_VAULT_LIFECYCLE_PAUSED = "PAUSED"

export function isVaultRunning(vault: BeefyCLVault): boolean {
  return vault.lifecycle == BEEFY_CL_VAULT_LIFECYCLE_RUNNING
}

export function isVaultInitialized(vault: BeefyCLVault): boolean {
  return vault.lifecycle != BEEFY_CL_VAULT_LIFECYCLE_INITIALIZING
}

export function isNewVault(vault: BeefyCLVault): boolean {
  return vault.sharesToken.equals(ADDRESS_ZERO)
}

export function getBeefyCLVault(vaultAddress: Bytes): BeefyCLVault {
  let vault = BeefyCLVault.load(vaultAddress)
  if (!vault) {
    vault = new BeefyCLVault(vaultAddress)

    vault.protocol = getBeefyCLProtocol().id
    vault.createdWith = ADDRESS_ZERO
    vault.strategy = ADDRESS_ZERO
    vault.rewardPool = null
    vault.isInitialized = false
    vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_INITIALIZING

    vault.sharesToken = ADDRESS_ZERO
    vault.rewardPoolToken = getNullToken().id
    vault.underlyingToken0 = ADDRESS_ZERO
    vault.underlyingToken1 = ADDRESS_ZERO
    vault.outputToken0 = getNullToken().id

    vault.totalSupply = ZERO_BI
    vault.rewardPoolTotalSupply = ZERO_BI

    vault.token0ToNativePrice = ZERO_BI
    vault.token1ToNativePrice = ZERO_BI
    vault.output0ToNativePrice = ZERO_BI
    vault.nativeToUSDPrice = ZERO_BI

    vault.priceOfToken0InToken1 = ZERO_BI
    vault.priceRangeMin1 = ZERO_BI
    vault.priceRangeMax1 = ZERO_BI

    vault.underlyingMainAmount0 = ZERO_BI
    vault.underlyingMainAmount1 = ZERO_BI
    vault.underlyingAltAmount0 = ZERO_BI
    vault.underlyingAltAmount1 = ZERO_BI
  }
  return vault
}

export function getBeefyCLStrategy(strategyAddress: Bytes): BeefyCLStrategy {
  let strategy = BeefyCLStrategy.load(strategyAddress)
  if (!strategy) {
    strategy = new BeefyCLStrategy(strategyAddress)
    strategy.vault = ADDRESS_ZERO
    strategy.isInitialized = false
  }
  return strategy
}

export function getBeefyCLRewardPool(rewardPoolAddress: Bytes): BeefyCLRewardPool {
  let rewardPool = BeefyCLRewardPool.load(rewardPoolAddress)
  if (!rewardPool) {
    rewardPool = new BeefyCLRewardPool(rewardPoolAddress)
    rewardPool.vault = ADDRESS_ZERO
    rewardPool.isInitialized = false
  }
  return rewardPool
}

export function getBeefyCLVaultSnapshot(vault: BeefyCLVault, timestamp: BigInt, period: BigInt): BeefyCLVaultSnapshot {
  const interval = getIntervalFromTimestamp(timestamp, period)
  const snapshotId = vault.id.concat(getSnapshotIdSuffix(period, interval))
  let snapshot = BeefyCLVaultSnapshot.load(snapshotId)
  if (!snapshot) {
    snapshot = new BeefyCLVaultSnapshot(snapshotId)
    snapshot.vault = vault.id

    snapshot.period = period
    snapshot.timestamp = timestamp
    snapshot.roundedTimestamp = interval

    snapshot.totalSupply = ZERO_BI
    snapshot.rewardPoolTotalSupply = ZERO_BI

    snapshot.token0ToNativePrice = ZERO_BI
    snapshot.token1ToNativePrice = ZERO_BI
    snapshot.output0ToNativePrice = ZERO_BI
    snapshot.nativeToUSDPrice = ZERO_BI

    snapshot.priceOfToken0InToken1 = ZERO_BI
    snapshot.priceRangeMin1 = ZERO_BI
    snapshot.priceRangeMax1 = ZERO_BI

    snapshot.underlyingMainAmount0 = ZERO_BI
    snapshot.underlyingMainAmount1 = ZERO_BI
    snapshot.underlyingAltAmount0 = ZERO_BI
    snapshot.underlyingAltAmount1 = ZERO_BI

    // copy non-reseting values from the previous snapshot to the new snapshot
    const previousSnapshotId = vault.id.concat(getPreviousSnapshotIdSuffix(period, interval))
    const previousSnapshot = BeefyCLVaultSnapshot.load(previousSnapshotId)
    if (previousSnapshot) {
      snapshot.totalSupply = previousSnapshot.totalSupply
      snapshot.rewardPoolTotalSupply = previousSnapshot.rewardPoolTotalSupply
      snapshot.token0ToNativePrice = previousSnapshot.token0ToNativePrice
      snapshot.token1ToNativePrice = previousSnapshot.token1ToNativePrice
      snapshot.output0ToNativePrice = previousSnapshot.output0ToNativePrice
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
