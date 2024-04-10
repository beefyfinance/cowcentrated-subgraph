import { BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { BeefyCLVault, Investor, InvestorPosition, InvestorPositionSnapshot } from "../../generated/schema"
import { ADDRESS_ZERO } from "../utils/address"
import { ZERO_BD, ZERO_BI } from "../utils/decimal"
import { getIntervalFromTimestamp } from "../utils/time"
import { getSnapshotIdSuffix } from "../utils/snapshot"

// @ts-ignore
@inline
function getPositionId(vault: BeefyCLVault, investor: Investor): Bytes {
  return vault.id.concat(investor.id)
}

export function isNewInvestorPosition(position: InvestorPosition): boolean {
  return position.sharesBalance.equals(ZERO_BD)
}

export function getInvestorPosition(vault: BeefyCLVault, investor: Investor): InvestorPosition {
  let id = getPositionId(vault, investor)
  let position = InvestorPosition.load(id)
  if (!position) {
    position = new InvestorPosition(id)
    position.vault = vault.id
    position.investor = investor.id
    position.createdWith = ADDRESS_ZERO
    position.closedPositionDuration = ZERO_BI
    position.positionOpenAtTimestamp = ZERO_BI
    position.sharesBalance = ZERO_BD
    position.underlyingBalance0 = ZERO_BD
    position.underlyingBalance1 = ZERO_BD
    position.underlyingBalance0USD = ZERO_BD
    position.underlyingBalance1USD = ZERO_BD
    position.positionValueUSD = ZERO_BD
    position.averageDailyPositionValueUSD30D = ZERO_BD
    position.averageDailyPositionValueUSDState = new Array<BigDecimal>()
    position.cumulativeCompoundedAmount0 = ZERO_BD
    position.cumulativeCompoundedAmount1 = ZERO_BD
    position.cumulativeCompoundedAmount0USD = ZERO_BD
    position.cumulativeCompoundedAmount1USD = ZERO_BD
    position.cumulativeCompoundedValueUSD = ZERO_BD
  }
  return position
}

export function getInvestorPositionSnapshot(
  vault: BeefyCLVault,
  investor: Investor,
  timestamp: BigInt,
  period: BigInt,
): InvestorPositionSnapshot {
  const interval = getIntervalFromTimestamp(timestamp, period)
  const positionId = getPositionId(vault, investor)
  const snapshotId = positionId.concat(getSnapshotIdSuffix(period, interval))
  let snapshot = InvestorPositionSnapshot.load(snapshotId)
  if (!snapshot) {
    snapshot = new InvestorPositionSnapshot(snapshotId)
    snapshot.investorPosition = positionId
    snapshot.timestamp = timestamp
    snapshot.roundedTimestamp = interval
    snapshot.period = period
    snapshot.sharesBalance = ZERO_BD
    snapshot.underlyingBalance0 = ZERO_BD
    snapshot.underlyingBalance1 = ZERO_BD
    snapshot.underlyingBalance0USD = ZERO_BD
    snapshot.underlyingBalance1USD = ZERO_BD
    snapshot.positionValueUSD = ZERO_BD
    snapshot.compoundedAmount0 = ZERO_BD
    snapshot.compoundedAmount1 = ZERO_BD
    snapshot.compoundedAmount0USD = ZERO_BD
    snapshot.compoundedAmount1USD = ZERO_BD
    snapshot.compoundedValueUSD = ZERO_BD

    // copy non-reseting values from the previous snapshot to the new snapshot
    const previousSnapshotId = positionId.concat(getSnapshotIdSuffix(period, interval))
    const previousSnapshot = InvestorPositionSnapshot.load(previousSnapshotId)
    if (previousSnapshot) {
      snapshot.sharesBalance = previousSnapshot.sharesBalance
      snapshot.underlyingBalance0 = previousSnapshot.underlyingBalance0
      snapshot.underlyingBalance1 = previousSnapshot.underlyingBalance1
      snapshot.underlyingBalance0USD = previousSnapshot.underlyingBalance0USD
      snapshot.underlyingBalance1USD = previousSnapshot.underlyingBalance1USD
      snapshot.positionValueUSD = previousSnapshot.positionValueUSD
    }
  }

  return snapshot
}
