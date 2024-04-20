import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { Protocol, ProtocolSnapshot } from "../../generated/schema"
import { ONE_BI, ZERO_BD } from "../utils/decimal"
import { getIntervalFromTimestamp } from "../utils/time"
import { getPreviousSnapshotIdSuffix, getSnapshotIdSuffix } from "../utils/snapshot"

export type ProtocolId = String
export const PROTOCOL_BEEFY_CL: ProtocolId = "BeefyCL"
export const PROTOCOL_BEEFY_CL_ID: Bytes = Bytes.fromByteArray(Bytes.fromBigInt(ONE_BI))

export function getBeefyCLProtocol(): Protocol {
  const protocolId = PROTOCOL_BEEFY_CL_ID
  let protocol = Protocol.load(protocolId)
  if (!protocol) {
    protocol = new Protocol(protocolId)
    protocol.name = "Beefy CL"
    protocol.totalValueLockedUSD = ZERO_BD
    protocol.activeVaultCount = 0
    protocol.activeInvestorCount = 0
    protocol.cumulativeTransactionCount = 0
    protocol.cumulativeInvestorInteractionsCount = 0
    protocol.cumulativeHarvestCount = 0
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
    snapshot.uniqueActiveInvestorCount = 0
    snapshot.newInvestorCount = 0
    snapshot.transactionCount = 0
    snapshot.investorInteractionsCount = 0
    snapshot.harvesterTransactionsCount = 0
    snapshot.protocolFeesCollectedNative = ZERO_BD
    snapshot.protocolFeesCollectedUSD = ZERO_BD
    snapshot.harvesterFeesCollectedNative = ZERO_BD
    snapshot.harvesterFeesCollectedUSD = ZERO_BD
    snapshot.strategistFeesCollectedNative = ZERO_BD
    snapshot.strategistFeesCollectedUSD = ZERO_BD

    // copy non-reseting values from the previous snapshot to the new snapshot
    const previousInterval = getPreviousSnapshotIdSuffix(period, interval)
    const previousSnapshotId = protocolId.concat(previousInterval)
    const previousSnapshot = ProtocolSnapshot.load(previousSnapshotId)
    if (previousSnapshot) {
      snapshot.totalValueLockedUSD = previousSnapshot.totalValueLockedUSD
      snapshot.activeVaultCount = previousSnapshot.activeVaultCount
    }
  }

  return snapshot
}
