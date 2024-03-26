import { BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { BeefyCLStrategy, BeefyCLVault, BeefyCLVaultSnapshot } from "../../generated/schema"
import { ADDRESS_ZERO } from "../utils/address"
import { ZERO_BD } from "../utils/decimal"
import { PROTOCOL_BEEFY_CL_ID } from "./protocol"
import { getIntervalFromTimestamp } from "../utils/time"
import { getPreviousSnapshotIdSuffix, getSnapshotIdSuffix } from "../utils/snapshot"

export const BEEFY_CL_VAULT_LIFECYCLE_INITIALIZING = "INITIALIZING"
export const BEEFY_CL_VAULT_LIFECYCLE_RUNNING = "RUNNING"
export const BEEFY_CL_VAULT_LIFECYCLE_PAUSED = "PAUSED"

export function isVaultRunning(vault: BeefyCLVault): boolean {
  return vault.lifecycle == BEEFY_CL_VAULT_LIFECYCLE_RUNNING
}

export function isNewVault(vault: BeefyCLVault): boolean {
  return vault.sharesToken.equals(ADDRESS_ZERO)
}

export function getBeefyCLVault(vaultAddress: Bytes): BeefyCLVault {
  let vault = BeefyCLVault.load(vaultAddress)
  if (!vault) {
    vault = new BeefyCLVault(vaultAddress)
    vault.protocol = PROTOCOL_BEEFY_CL_ID
    vault.createdWith = ADDRESS_ZERO
    vault.owner = ADDRESS_ZERO
    vault.sharesToken = ADDRESS_ZERO
    vault.strategy = ADDRESS_ZERO
    vault.isInitialized = false
    vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_INITIALIZING
    vault.underlyingToken0 = ADDRESS_ZERO
    vault.underlyingToken1 = ADDRESS_ZERO
    vault.currentPriceOfToken0InToken1 = ZERO_BD
    vault.currentPriceOfToken0InUSD = ZERO_BD
    vault.priceRangeMin1 = ZERO_BD
    vault.priceRangeMax1 = ZERO_BD
    vault.priceRangeMinUSD = ZERO_BD
    vault.priceRangeMaxUSD = ZERO_BD
    vault.underlyingAmount0 = ZERO_BD
    vault.underlyingAmount1 = ZERO_BD
    vault.underlyingAmount0USD = ZERO_BD
    vault.underlyingAmount1USD = ZERO_BD
    vault.totalValueLockedUSD = ZERO_BD
    vault.cumulativeHarvestCount = 0
    vault.cumulativeDepositCount = 0
    vault.cumulativeWithdrawCount = 0
    vault.cumulativeTransferCount = 0
    vault.cumulativeCompoundedAmount0 = ZERO_BD
    vault.cumulativeCompoundedAmount1 = ZERO_BD
    vault.cumulativeCompoundedAmount0USD = ZERO_BD
    vault.cumulativeCompoundedAmount1USD = ZERO_BD
    vault.cumulativeCompoundedValueUSD = ZERO_BD
    vault.cumulativeHarvesterFeeCollectedNative = ZERO_BD
    vault.cumulativeProtocolFeeCollectedNative = ZERO_BD
    vault.cumulativeStrategistFeeCollectedNative = ZERO_BD
    vault.cumulativeHarvesterFeeCollectedUSD = ZERO_BD
    vault.cumulativeProtocolFeeCollectedUSD = ZERO_BD
    vault.cumulativeStrategistFeeCollectedUSD = ZERO_BD
    vault.aprState = new Array<BigDecimal>()
    vault.apr1D = ZERO_BD
    vault.apr7D = ZERO_BD
    vault.apr30D = ZERO_BD
  }
  return vault
}

export function getBeefyCLStrategy(strategyAddress: Bytes): BeefyCLStrategy {
  let strategy = BeefyCLStrategy.load(strategyAddress)
  if (!strategy) {
    strategy = new BeefyCLStrategy(strategyAddress)
    strategy.vault = ADDRESS_ZERO
    strategy.owner = ADDRESS_ZERO
    strategy.isInitialized = false
    strategy.lpToken0ToNativePath = Bytes.empty()
    strategy.lpToken1ToNativePath = Bytes.empty()
  }
  return strategy
}

export function getBeefyCLVaultSnapshot(vault: BeefyCLVault, timestamp: BigInt, period: BigInt): BeefyCLVaultSnapshot {
  const interval = getIntervalFromTimestamp(timestamp, period)
  const snapshotId = vault.id.concat(getSnapshotIdSuffix(period, interval))
  let snapshot = BeefyCLVaultSnapshot.load(snapshotId)
  if (!snapshot) {
    snapshot = new BeefyCLVaultSnapshot(snapshotId)
    snapshot.vault = vault.id
    snapshot.timestamp = timestamp
    snapshot.roundedTimestamp = interval
    snapshot.period = period
    snapshot.currentPriceOfToken0InToken1 = ZERO_BD
    snapshot.currentPriceOfToken0InUSD = ZERO_BD
    snapshot.priceRangeMin1 = ZERO_BD
    snapshot.priceRangeMax1 = ZERO_BD
    snapshot.priceRangeMinUSD = ZERO_BD
    snapshot.priceRangeMaxUSD = ZERO_BD
    snapshot.underlyingAmount0 = ZERO_BD
    snapshot.underlyingAmount1 = ZERO_BD
    snapshot.underlyingAmount0USD = ZERO_BD
    snapshot.underlyingAmount1USD = ZERO_BD
    snapshot.totalValueLockedUSD = ZERO_BD
    snapshot.harvestCount = 0
    snapshot.depositCount = 0
    snapshot.withdrawCount = 0
    snapshot.transferCount = 0
    snapshot.compoundedAmount0 = ZERO_BD
    snapshot.compoundedAmount1 = ZERO_BD
    snapshot.compoundedAmount0USD = ZERO_BD
    snapshot.compoundedAmount1USD = ZERO_BD
    snapshot.compoundedValueUSD = ZERO_BD
    snapshot.harvesterFeeCollectedNative = ZERO_BD
    snapshot.protocolFeeCollectedNative = ZERO_BD
    snapshot.strategistFeeCollectedNative = ZERO_BD
    snapshot.harvesterFeeCollectedUSD = ZERO_BD
    snapshot.protocolFeeCollectedUSD = ZERO_BD
    snapshot.strategistFeeCollectedUSD = ZERO_BD
    snapshot.apr1D = ZERO_BD
    snapshot.apr7D = ZERO_BD
    snapshot.apr30D = ZERO_BD

    // copy non-reseting values from the previous snapshot to the new snapshot
    const previousSnapshotId = vault.id.concat(getPreviousSnapshotIdSuffix(period, interval))
    const previousSnapshot = BeefyCLVaultSnapshot.load(previousSnapshotId)
    if (previousSnapshot) {
      snapshot.currentPriceOfToken0InToken1 = previousSnapshot.currentPriceOfToken0InToken1
      snapshot.currentPriceOfToken0InUSD = previousSnapshot.currentPriceOfToken0InUSD
      snapshot.priceRangeMin1 = previousSnapshot.priceRangeMin1
      snapshot.priceRangeMax1 = previousSnapshot.priceRangeMax1
      snapshot.priceRangeMinUSD = previousSnapshot.priceRangeMinUSD
      snapshot.priceRangeMaxUSD = previousSnapshot.priceRangeMaxUSD
      snapshot.underlyingAmount0 = previousSnapshot.underlyingAmount0
      snapshot.underlyingAmount1 = previousSnapshot.underlyingAmount1
      snapshot.underlyingAmount0USD = previousSnapshot.underlyingAmount0USD
      snapshot.underlyingAmount1USD = previousSnapshot.underlyingAmount1USD
      snapshot.totalValueLockedUSD = previousSnapshot.totalValueLockedUSD
    }
  }

  return snapshot
}
