import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import { BeefyCLStrategy, BeefyCLVault, BeefyCLVaultSnapshot } from '../../generated/schema'
import { ADDRESS_ZERO } from '../utils/address'
import { ZERO_BD } from '../utils/decimal'
import { PROTOCOL_BEEFY_CL } from './protocol'
import { getIntervalFromTimestamp } from '../utils/time'

export const BEEFY_CL_VAULT_LIFECYCLE_INITIALIZING = 'INITIALIZING'
export const BEEFY_CL_VAULT_LIFECYCLE_RUNNING = 'RUNNING'
export const BEEFY_CL_VAULT_LIFECYCLE_PAUSED = 'PAUSED'

export function isVaultRunning(vault: BeefyCLVault): boolean {
  return vault.lifecycle == BEEFY_CL_VAULT_LIFECYCLE_RUNNING
}

export function getBeefyCLVault(vaultAddress: Bytes): BeefyCLVault {
  let vault = BeefyCLVault.load(vaultAddress)
  if (!vault) {
    vault = new BeefyCLVault(vaultAddress)
    vault.protocol = PROTOCOL_BEEFY_CL.toString()
    vault.createdWith = ADDRESS_ZERO
    vault.owner = ADDRESS_ZERO
    vault.sharesToken = ADDRESS_ZERO
    vault.strategy = ADDRESS_ZERO
    vault.isInitialized = false
    vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_INITIALIZING
    vault.underlyingToken0 = ADDRESS_ZERO
    vault.underlyingToken1 = ADDRESS_ZERO
    vault.priceRangeMin1 = ZERO_BD
    vault.priceRangeMax1 = ZERO_BD
    vault.priceRangeMin1USD = ZERO_BD
    vault.priceRangeMax1USD = ZERO_BD
    vault.underlyingAmount0 = ZERO_BD
    vault.underlyingAmount1 = ZERO_BD
    vault.underlyingAmount0USD = ZERO_BD
    vault.underlyingAmount1USD = ZERO_BD
    vault.totalValueLockedUSD = ZERO_BD
    vault.totalHarvestCount = 0
    vault.totalDepositCount = 0
    vault.totalWithdrawCount = 0
    vault.totalTransferCount = 0
    vault.totalHarvestedAmount0 = ZERO_BD
    vault.totalHarvestedAmount1 = ZERO_BD
    vault.totalHarvestedAmount0USD = ZERO_BD
    vault.totalHarvestedAmount1USD = ZERO_BD
    vault.totalHarvesterFeeAmountNative = ZERO_BD
    vault.totalProtocolFeeAmountNative = ZERO_BD
    vault.totalStrategistFeeAmountNative = ZERO_BD
    vault.totalHarvesterFeeAmountUSD = ZERO_BD
    vault.totalProtocolFeeAmountUSD = ZERO_BD
    vault.totalStrategistFeeAmountUSD = ZERO_BD
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
  }
  return strategy
}

export function getBeefyCLVaultSnapshot(vault: BeefyCLVault, timestamp: BigInt, period: BigInt): BeefyCLVaultSnapshot {
  const interval = getIntervalFromTimestamp(timestamp, period)
  const snapshotId = vault.id
    .concat(Bytes.fromByteArray(Bytes.fromBigInt(period)))
    .concat(Bytes.fromByteArray(Bytes.fromBigInt(interval)))
  let snapshot = BeefyCLVaultSnapshot.load(snapshotId)
  if (!snapshot) {
    snapshot = new BeefyCLVaultSnapshot(snapshotId)
    snapshot.vault = vault.id
    snapshot.timestamp = timestamp
    snapshot.roundedTimestamp = interval
    snapshot.period = period
    snapshot.priceRangeMin1 = ZERO_BD
    snapshot.priceRangeMax1 = ZERO_BD
    snapshot.priceRangeMin1USD = ZERO_BD
    snapshot.priceRangeMax1USD = ZERO_BD
    snapshot.underlyingAmount0 = ZERO_BD
    snapshot.underlyingAmount1 = ZERO_BD
    snapshot.underlyingAmount0USD = ZERO_BD
    snapshot.underlyingAmount1USD = ZERO_BD
    snapshot.totalValueLockedUSD = ZERO_BD
    snapshot.harvestCount = 0
    snapshot.depositCount = 0
    snapshot.withdrawCount = 0
    snapshot.transferCount = 0
    snapshot.harvestedAmount0 = ZERO_BD
    snapshot.harvestedAmount1 = ZERO_BD
    snapshot.harvestedAmount0USD = ZERO_BD
    snapshot.harvestedAmount1USD = ZERO_BD
    snapshot.harvesterFeeAmountNative = ZERO_BD
    snapshot.protocolFeeAmountNative = ZERO_BD
    snapshot.strategistFeeAmountNative = ZERO_BD
    snapshot.harvesterFeeAmountUSD = ZERO_BD
    snapshot.protocolFeeAmountUSD = ZERO_BD
    snapshot.strategistFeeAmountUSD = ZERO_BD
  }
  return snapshot
}
