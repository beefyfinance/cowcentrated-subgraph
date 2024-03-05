import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import { Protocol, ProtocolSnapshot } from '../../generated/schema'
import { ONE_BI, ZERO_BD } from '../utils/decimal'
import { getIntervalFromTimestamp } from '../utils/time'
import { getPreviousSnapshotIdSuffix, getSnapshotIdSuffix } from '../utils/snapshot'

export type ProtocolId = String
export const PROTOCOL_BEEFY_CL: ProtocolId = 'BeefyCL'
export const PROTOCOL_BEEFY_CL_ID: Bytes = Bytes.fromByteArray(Bytes.fromBigInt(ONE_BI))

export function getBeefyCLProtocol(): Protocol {
  const protocolId = PROTOCOL_BEEFY_CL_ID
  let protocol = Protocol.load(protocolId)
  if (!protocol) {
    protocol = new Protocol(protocolId)
    protocol.name = 'Beefy CL'
    protocol.totalValueLockedUSD = ZERO_BD
    protocol.activeVaultCount = 0
    protocol.activeInvestorCount = 0
    protocol.transactionCount = 0
    protocol.harvestCount = 0
  }
  return protocol
}

export function getBeefyCLProtocolSnapshot(timestamp: BigInt, period: BigInt): ProtocolSnapshot {
  const protocolId = PROTOCOL_BEEFY_CL_ID
  const interval = getIntervalFromTimestamp(timestamp, period)
  const snapshotId = protocolId.concat(getSnapshotIdSuffix(period, interval))
  let snapshot = ProtocolSnapshot.load(snapshotId)
  if (!snapshot) {
    snapshot = new ProtocolSnapshot(snapshotId)
    snapshot.protocol = protocolId
    snapshot.timestamp = timestamp
    snapshot.roundedTimestamp = interval
    snapshot.period = period
    snapshot.totalValueLockedUSD = ZERO_BD
    snapshot.activeVaultCount = 0
    snapshot.activeInvestorCount = 0
    snapshot.newInvestorCount = 0
    snapshot.totalTransactionCount = 0
    snapshot.investorTransactionsCount = 0
    snapshot.harvesterTransactionsCount = 0
    snapshot.totalGasSpent = ZERO_BD
    snapshot.totalGasSpentUSD = ZERO_BD
    snapshot.investorGasSpent = ZERO_BD
    snapshot.investorGasSpentUSD = ZERO_BD
    snapshot.harvesterGasSpent = ZERO_BD
    snapshot.harvesterGasSpentUSD = ZERO_BD
    snapshot.protocolGasSaved = ZERO_BD
    snapshot.protocolGasSavedUSD = ZERO_BD
    snapshot.protocolFeesCollectedNative = ZERO_BD
    snapshot.protocolFeesCollectedUSD = ZERO_BD
    snapshot.harvesterFeesCollectedNative = ZERO_BD
    snapshot.harvesterFeesCollectedUSD = ZERO_BD
    snapshot.strategistFeesCollectedNative = ZERO_BD
    snapshot.strategistFeesCollectedUSD = ZERO_BD
    snapshot.zapFeesCollectedNative = ZERO_BD
    snapshot.zapFeesCollectedUSD = ZERO_BD
  }

  // copy non-reseting values from the previous snapshot to the new snapshot
  const previousInterval = getPreviousSnapshotIdSuffix(period, interval)
  const previousSnapshotId = protocolId.concat(previousInterval)
  const previousSnapshot = ProtocolSnapshot.load(previousSnapshotId)
  if (previousSnapshot) {
    snapshot.totalValueLockedUSD = previousSnapshot.totalValueLockedUSD
    snapshot.activeVaultCount = previousSnapshot.activeVaultCount
    snapshot.activeInvestorCount = previousSnapshot.activeInvestorCount
  }

  return snapshot
}
