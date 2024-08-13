import { BigInt, Bytes, store } from "@graphprotocol/graph-ts"
import {
  Classic,
  ClassicVault,
  ClassicStrategy,
  ClassicBoost,
  ClassicSnapshot,
  ClassicRewardPool,
} from "../../../generated/schema"
import { ADDRESS_ZERO } from "../../common/utils/address"
import { ZERO_BI } from "../../common/utils/decimal"
import { getIntervalFromTimestamp } from "../../common/utils/time"
import { getPreviousSnapshotIdSuffix, getSnapshotIdSuffix } from "../../common/utils/snapshot"
import { getBeefyClassicProtocol } from "../../common/entity/protocol"
import { PRODUCT_LIFECYCLE_INITIALIZING } from "../../common/entity/lifecycle"

export function isClassicInitialized(classic: Classic): boolean {
  return classic.lifecycle != PRODUCT_LIFECYCLE_INITIALIZING
}

export function isClassicVaultAddress(vaultAddress: Bytes): boolean {
  return ClassicVault.load(vaultAddress) != null
}

export function getClassic(vaultAddress: Bytes): Classic {
  let classic = Classic.load(vaultAddress)
  if (!classic) {
    classic = new Classic(vaultAddress)

    classic.protocol = getBeefyClassicProtocol().id
    classic.vault = vaultAddress
    classic.strategy = ADDRESS_ZERO

    classic.lifecycle = PRODUCT_LIFECYCLE_INITIALIZING

    classic.vaultSharesToken = vaultAddress
    classic.underlyingToken = ADDRESS_ZERO
    classic.underlyingBreakdownTokens = []
    classic.underlyingBreakdownTokensOrder = []
    classic.boostRewardTokens = []
    classic.boostRewardTokensOrder = []
    classic.rewardPoolTokens = []
    classic.rewardPoolTokensOrder = []
    classic.rewardTokens = []
    classic.rewardTokensOrder = []

    classic.vaultSharesTotalSupply = ZERO_BI
    classic.vaultUnderlyingTotalSupply = ZERO_BI
    classic.vaultUnderlyingBreakdownBalances = []
    classic.rewardPoolsTotalSupply = []

    classic.underlyingToNativePrice = ZERO_BI
    classic.underlyingBreakdownToNativePrices = []
    classic.boostRewardToNativePrices = []
    classic.rewardToNativePrices = []
    classic.nativeToUSDPrice = ZERO_BI

    classic.underlyingAmount = ZERO_BI
  }
  return classic
}

export function removeClassicAndDependencies(classic: Classic): void {
  removeClassicVault(classic.vault)
  removeClassicStrategy(classic.strategy)

  const id = classic.id
  store.remove("Classic", id.toHexString())
}

export function getClassicVault(vaultAddress: Bytes): ClassicVault {
  let vault = ClassicVault.load(vaultAddress)
  if (!vault) {
    vault = new ClassicVault(vaultAddress)
    vault.classic = vaultAddress
    vault.createdWith = ADDRESS_ZERO
    vault.isInitialized = false
  }
  return vault
}

export function removeClassicVault(vaultAddress: Bytes): void {
  const id = vaultAddress
  store.remove("ClassicVault", id.toHexString())
}

export function getClassicStrategy(strategyAddress: Bytes): ClassicStrategy {
  let strategy = ClassicStrategy.load(strategyAddress)
  if (!strategy) {
    strategy = new ClassicStrategy(strategyAddress)
    strategy.classic = ADDRESS_ZERO
    strategy.vault = ADDRESS_ZERO
    strategy.createdWith = ADDRESS_ZERO
    strategy.isInitialized = false
  }
  return strategy
}

export function removeClassicStrategy(strategyAddress: Bytes): void {
  const id = strategyAddress
  store.remove("ClassicStrategy", id.toHexString())
}

export function getClassicBoost(boostAddress: Bytes): ClassicBoost {
  let boost = ClassicBoost.load(boostAddress)
  if (!boost) {
    boost = new ClassicBoost(boostAddress)
    boost.classic = ADDRESS_ZERO
    boost.vault = ADDRESS_ZERO
    boost.createdWith = ADDRESS_ZERO
    boost.rewardToken = ADDRESS_ZERO
    boost.isInitialized = false
  }
  return boost
}

export function isClassicRewardPool(rewardPoolAddress: Bytes): boolean {
  return ClassicRewardPool.load(rewardPoolAddress) != null
}

export function removeClassicRewardPool(rewardPoolAddress: Bytes): void {
  const id = rewardPoolAddress
  store.remove("ClassicRewardPool", id.toHexString())
}

export function getClassicRewardPool(rewardPoolAddress: Bytes): ClassicRewardPool {
  let rewardPool = ClassicRewardPool.load(rewardPoolAddress)
  if (!rewardPool) {
    rewardPool = new ClassicRewardPool(rewardPoolAddress)
    rewardPool.classic = ADDRESS_ZERO
    rewardPool.vault = ADDRESS_ZERO
    rewardPool.createdWith = ADDRESS_ZERO
    rewardPool.isInitialized = false
  }
  return rewardPool
}

export function getClassicSnapshot(classic: Classic, timestamp: BigInt, period: BigInt): ClassicSnapshot {
  const interval = getIntervalFromTimestamp(timestamp, period)
  const snapshotId = classic.id.concat(getSnapshotIdSuffix(period, interval))
  let snapshot = ClassicSnapshot.load(snapshotId)
  if (!snapshot) {
    snapshot = new ClassicSnapshot(snapshotId)
    snapshot.classic = classic.id

    snapshot.period = period
    snapshot.timestamp = timestamp
    snapshot.roundedTimestamp = interval

    snapshot.vaultSharesTotalSupply = ZERO_BI
    snapshot.vaultUnderlyingTotalSupply = ZERO_BI
    snapshot.vaultUnderlyingBreakdownBalances = []
    snapshot.rewardPoolsTotalSupply = []

    snapshot.underlyingToNativePrice = ZERO_BI
    snapshot.underlyingBreakdownToNativePrices = []
    snapshot.boostRewardToNativePrices = []
    snapshot.rewardToNativePrices = []
    snapshot.nativeToUSDPrice = ZERO_BI

    snapshot.underlyingAmount = ZERO_BI

    // copy non-reseting values from the previous snapshot to the new snapshot
    const previousSnapshotId = classic.id.concat(getPreviousSnapshotIdSuffix(period, interval))
    const previousSnapshot = ClassicSnapshot.load(previousSnapshotId)
    if (previousSnapshot) {
      snapshot.vaultSharesTotalSupply = previousSnapshot.vaultSharesTotalSupply
      snapshot.vaultUnderlyingTotalSupply = previousSnapshot.vaultUnderlyingTotalSupply
      snapshot.vaultUnderlyingBreakdownBalances = previousSnapshot.vaultUnderlyingBreakdownBalances
      snapshot.underlyingToNativePrice = previousSnapshot.underlyingToNativePrice
      snapshot.underlyingBreakdownToNativePrices = previousSnapshot.underlyingBreakdownToNativePrices
      snapshot.boostRewardToNativePrices = previousSnapshot.boostRewardToNativePrices
      snapshot.rewardToNativePrices = previousSnapshot.rewardToNativePrices
      snapshot.nativeToUSDPrice = previousSnapshot.nativeToUSDPrice
      snapshot.underlyingAmount = previousSnapshot.underlyingAmount
    }
  }

  return snapshot
}
