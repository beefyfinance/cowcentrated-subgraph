import { BigInt, Bytes, store } from "@graphprotocol/graph-ts"
import { Investor, ClassicPosition, CLM, Classic, ClassicPositionSnapshot } from "../../../generated/schema"
import { ADDRESS_ZERO } from "../../common/utils/address"
import { ZERO_BI } from "../../common/utils/decimal"
import { getIntervalFromTimestamp } from "../../common/utils/time"
import { getPreviousSnapshotIdSuffix, getSnapshotIdSuffix } from "../../common/utils/snapshot"

// @ts-ignore
@inline
function getPositionId(classic: Classic, investor: Investor): Bytes {
  return classic.id.concat(investor.id)
}

export function getClassicPosition(classic: Classic, investor: Investor): ClassicPosition {
  let id = getPositionId(classic, investor)
  let position = ClassicPosition.load(id)
  if (!position) {
    position = new ClassicPosition(id)
    position.classic = classic.id
    position.investor = investor.id
    position.createdWith = ADDRESS_ZERO
    position.vaultBalance = ZERO_BI
    position.boostBalance = ZERO_BI
    position.rewardPoolBalances = []
    position.erc4626AdapterBalances = []
    position.totalBalance = ZERO_BI
  }
  return position
}

export function removeClassicPosition(classic: Classic, investor: Investor): void {
  const id = getPositionId(classic, investor)
  store.remove("ClassicPosition", id.toHexString())
}

export function getClassicPositionSnapshot(
  position: ClassicPosition,
  timestamp: BigInt,
  period: BigInt,
): ClassicPositionSnapshot {
  const interval = getIntervalFromTimestamp(timestamp, period)
  const snapshotId = position.id.concat(getSnapshotIdSuffix(period, interval))
  let snapshot = ClassicPositionSnapshot.load(snapshotId)
  if (!snapshot) {
    snapshot = new ClassicPositionSnapshot(snapshotId)
    snapshot.classic = position.classic
    snapshot.investor = position.investor
    snapshot.investorPosition = position.id

    snapshot.period = period
    snapshot.timestamp = timestamp
    snapshot.roundedTimestamp = interval

    snapshot.vaultBalance = ZERO_BI
    snapshot.boostBalance = ZERO_BI
    snapshot.rewardPoolBalances = []
    snapshot.erc4626AdapterBalances = []
    snapshot.totalBalance = ZERO_BI

    snapshot.vaultSharesTotalSupply = ZERO_BI
    snapshot.vaultUnderlyingTotalSupply = ZERO_BI
    snapshot.vaultUnderlyingBalance = ZERO_BI
    snapshot.vaultUnderlyingBreakdownBalances = []

    snapshot.underlyingToNativePrice = ZERO_BI
    snapshot.underlyingBreakdownToNativePrices = []
    snapshot.boostRewardToNativePrices = []
    snapshot.rewardToNativePrices = []
    snapshot.nativeToUSDPrice = ZERO_BI

    // copy non-reseting values from the previous snapshot to the new snapshot
    const previousSnapshotId = position.id.concat(getPreviousSnapshotIdSuffix(period, interval))
    const previousSnapshot = ClassicPositionSnapshot.load(previousSnapshotId)
    if (previousSnapshot) {
      snapshot.vaultBalance = previousSnapshot.vaultBalance
      snapshot.boostBalance = previousSnapshot.boostBalance
      snapshot.rewardPoolBalances = previousSnapshot.rewardPoolBalances
      snapshot.erc4626AdapterBalances = previousSnapshot.erc4626AdapterBalances
      snapshot.totalBalance = previousSnapshot.totalBalance
      snapshot.vaultSharesTotalSupply = previousSnapshot.vaultSharesTotalSupply
      snapshot.vaultUnderlyingTotalSupply = previousSnapshot.vaultUnderlyingTotalSupply
      snapshot.vaultUnderlyingBreakdownBalances = previousSnapshot.vaultUnderlyingBreakdownBalances
      snapshot.vaultUnderlyingBalance = previousSnapshot.vaultUnderlyingBalance
      snapshot.underlyingToNativePrice = previousSnapshot.underlyingToNativePrice
      snapshot.underlyingBreakdownToNativePrices = previousSnapshot.underlyingBreakdownToNativePrices
      snapshot.boostRewardToNativePrices = previousSnapshot.boostRewardToNativePrices
      snapshot.rewardToNativePrices = previousSnapshot.rewardToNativePrices
      snapshot.nativeToUSDPrice = previousSnapshot.nativeToUSDPrice
    }
  }

  return snapshot
}
