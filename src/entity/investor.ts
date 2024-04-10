import { BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { Investor, InvestorSnapshot } from "../../generated/schema"
import { ZERO_BD, ZERO_BI } from "../utils/decimal"
import { getIntervalFromTimestamp } from "../utils/time"
import { getPreviousSnapshotIdSuffix, getSnapshotIdSuffix } from "../utils/snapshot"

export function isNewInvestor(investor: Investor): boolean {
  // safe to assume as we only create investors when they interact with the protocol
  return investor.cumulativeInteractionsCount === 0
}

export function getInvestor(accountAddress: Bytes): Investor {
  let investor = Investor.load(accountAddress)
  if (!investor) {
    investor = new Investor(accountAddress)
    investor.activePositionCount = 0
    investor.closedInvestmentDuration = ZERO_BI
    investor.currentInvestmentOpenAtTimestamp = ZERO_BI
    investor.lastInteractionAt = ZERO_BI
    investor.totalPositionValueUSD = ZERO_BD
    investor.averageDailyTotalPositionValueUSD30D = ZERO_BD
    investor.averageDailyTotalPositionValueUSDState = new Array<BigDecimal>()
    investor.cumulativeInteractionsCount = 0
    investor.cumulativeDepositCount = 0
    investor.cumulativeWithdrawCount = 0
    investor.cumulativeCompoundedValueUSD = ZERO_BD
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
    snapshot.interactionsCount = 0
    snapshot.depositCount = 0
    snapshot.withdrawCount = 0
    snapshot.compoundedValueUSD = ZERO_BD

    // copy non-reseting values from the previous snapshot to the new snapshot
    const previousSnapshotId = investor.id.concat(getPreviousSnapshotIdSuffix(period, interval))
    const previousSnapshot = InvestorSnapshot.load(previousSnapshotId)
    if (previousSnapshot) {
      snapshot.totalPositionValueUSD = previousSnapshot.totalPositionValueUSD
    }
  }

  return snapshot
}
