import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import { Investor, InvestorSnapshot } from '../../generated/schema'
import { ZERO_BD, ZERO_BI } from '../utils/decimal'
import { getIntervalFromTimestamp } from '../utils/time'
import { getSnapshotIdSuffix } from '../utils/snapshot'

export function getInvestor(accountAddress: Bytes): Investor {
  let investor = Investor.load(accountAddress)
  if (!investor) {
    investor = new Investor(accountAddress)
    investor.activePositionCount = 0
    investor.lastInteractionTimestamp = ZERO_BI
    investor.investedDuration = ZERO_BI
    investor.totalPositionValueUSD = ZERO_BD
    investor.timeWeightedPositionValueUSD = ZERO_BD
    investor.totalInteractionsCount = 0
  }

  return investor
}

export function getInvestorSnapshot(investor: Investor, timestamp: BigInt, period: BigInt): InvestorSnapshot {
  const interval = getIntervalFromTimestamp(timestamp, period)
  const snapshotId = investor.id.concat(getSnapshotIdSuffix(period, interval))
  let snapshot = InvestorSnapshot.load(snapshotId)
  if (!snapshot) {
    snapshot = new InvestorSnapshot(snapshotId)
    snapshot.investor = investor.id
    snapshot.timestamp = timestamp
    snapshot.roundedTimestamp = interval
    snapshot.period = period
    snapshot.totalPositionValueUSD = ZERO_BD
    snapshot.timeWeightedPositionValueUSD = ZERO_BD
    snapshot.interactionsCount = 0
  }
  return snapshot
}
