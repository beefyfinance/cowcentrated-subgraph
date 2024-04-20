import { BigInt, ethereum } from "@graphprotocol/graph-ts"
import {
  ClaimedFees as ClaimedFeesEvent,
  Harvest as HarvestEvent,
  ClaimedOutput as ClaimedOutputEvent,
} from "../generated/templates/BeefyCLStrategy/BeefyStrategy"
import { getBeefyCLStrategy, getBeefyCLVault, getBeefyCLVaultSnapshot, isVaultRunning } from "./entity/vault"
import { getTransaction } from "./entity/transaction"
import { BeefyCLVaultHarvestEvent, BeefyCLVaultUnderlyingFeesCollectedEvent } from "../generated/schema"
import { getEventIdentifier } from "./utils/event"
import { getToken } from "./entity/token"
import { ZERO_BD, tokenAmountToDecimal, ZERO_BI } from "./utils/decimal"
import { DAY, VAULT_SNAPSHOT_PERIODS, INVESTOR_SNAPSHOT_PERIODS, PROTOCOL_SNAPSHOT_PERIODS } from "./utils/time"
import { getBeefyCLProtocol, getBeefyCLProtocolSnapshot } from "./entity/protocol"
import { getInvestorPositionSnapshot } from "./entity/position"
import { getInvestor, getInvestorSnapshot } from "./entity/investor"
import { fetchVaultLatestData } from "./utils/price"
import { AprCalc, AprState } from "./utils/apr"

export function handleStrategyHarvest(event: HarvestEvent): void {
  let strategy = getBeefyCLStrategy(event.address)
  let vault = getBeefyCLVault(strategy.vault)
  if (!isVaultRunning(vault)) {
    return
  }

  const sharesToken = getToken(vault.sharesToken)
  const token0 = getToken(vault.underlyingToken0)
  const token1 = getToken(vault.underlyingToken1)
  const earnedToken = getToken(vault.earnedToken)

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain
  const vaultData = fetchVaultLatestData(vault, strategy, sharesToken, token0, token1, earnedToken)
  const currentPriceInToken1 = vaultData.currentPriceInToken1
  const vaultBalanceUnderlying0 = vaultData.token0Balance
  const vaultBalanceUnderlying1 = vaultData.token1Balance
  const sharesTotalSupply = vaultData.sharesTotalSupply
  const token0PriceInNative = vaultData.token0ToNative
  const token1PriceInNative = vaultData.token1ToNative
  const nativePriceUSD = vaultData.nativeToUsd

  ///////
  // compute derived values
  const token0PriceInUSD = token0PriceInNative.times(nativePriceUSD)
  const token1PriceInUSD = token1PriceInNative.times(nativePriceUSD)

  ///////
  // store the raw harvest event
  let harvest = new BeefyCLVaultHarvestEvent(getEventIdentifier(event))
  harvest.vault = vault.id
  harvest.strategy = strategy.id
  harvest.createdWith = tx.id
  harvest.timestamp = event.block.timestamp
  harvest.underlyingAmount0 = vaultBalanceUnderlying0
  harvest.underlyingAmount1 = vaultBalanceUnderlying1
  harvest.underlyingAmount0USD = vaultBalanceUnderlying0.times(token0PriceInUSD)
  harvest.underlyingAmount1USD = vaultBalanceUnderlying1.times(token1PriceInUSD)
  harvest.totalValueLockedUSD = vaultBalanceUnderlying0
    .times(token0PriceInUSD)
    .plus(vaultBalanceUnderlying1.times(token1PriceInUSD))
  harvest.compoundedAmount0 = tokenAmountToDecimal(event.params.fee0, token0.decimals)
  harvest.compoundedAmount1 = tokenAmountToDecimal(event.params.fee1, token1.decimals)
  harvest.compoundedAmount0USD = harvest.compoundedAmount0.times(token0PriceInUSD)
  harvest.compoundedAmount1USD = harvest.compoundedAmount1.times(token1PriceInUSD)
  harvest.compoundedValueUSD = harvest.compoundedAmount0USD.plus(harvest.compoundedAmount1USD)
  harvest.priceOfToken0InToken1 = currentPriceInToken1
  harvest.priceOfToken0InUSD = currentPriceInToken1.times(token1PriceInUSD)
  harvest.save()

  ///////
  // update vault entities
  vault.cumulativeHarvestCount += 1
  vault.cumulativeCompoundedAmount0 = vault.cumulativeCompoundedAmount0.plus(harvest.compoundedAmount0)
  vault.cumulativeCompoundedAmount1 = vault.cumulativeCompoundedAmount1.plus(harvest.compoundedAmount1)
  vault.cumulativeCompoundedAmount0USD = vault.cumulativeCompoundedAmount0USD.plus(harvest.compoundedAmount0USD)
  vault.cumulativeCompoundedAmount1USD = vault.cumulativeCompoundedAmount1USD.plus(harvest.compoundedAmount1USD)
  vault.cumulativeCompoundedValueUSD = vault.cumulativeCompoundedAmount0USD.plus(vault.cumulativeCompoundedAmount1USD)
  vault.save()
  for (let i = 0; i < VAULT_SNAPSHOT_PERIODS.length; i++) {
    const period = VAULT_SNAPSHOT_PERIODS[i]
    const vaultSnapshot = getBeefyCLVaultSnapshot(vault, event.block.timestamp, period)
    vaultSnapshot.harvestCount += 1
    vaultSnapshot.compoundedAmount0 = vaultSnapshot.compoundedAmount0.plus(harvest.compoundedAmount0)
    vaultSnapshot.compoundedAmount1 = vaultSnapshot.compoundedAmount1.plus(harvest.compoundedAmount1)
    vaultSnapshot.compoundedAmount0USD = vaultSnapshot.compoundedAmount0USD.plus(harvest.compoundedAmount0USD)
    vaultSnapshot.compoundedAmount1USD = vaultSnapshot.compoundedAmount1USD.plus(harvest.compoundedAmount1USD)
    vaultSnapshot.compoundedValueUSD = vaultSnapshot.compoundedAmount0USD.plus(vaultSnapshot.compoundedAmount1USD)
    vaultSnapshot.save()
  }

  ///////
  // update investor positions
  let positions = vault.positions.load()
  let positivePositionCount = 0
  for (let i = 0; i < positions.length; i++) {
    let position = positions[i]
    if (!position.sharesBalance.gt(ZERO_BD)) {
      continue
    }
    positivePositionCount += 1

    const positionPercentOfTotalSupply = position.sharesBalance.div(sharesTotalSupply)
    const positionChangeUSD = positionPercentOfTotalSupply.times(harvest.compoundedValueUSD)

    let investor = getInvestor(position.investor)
    position.cumulativeCompoundedAmount0 = position.cumulativeCompoundedAmount0.plus(
      harvest.compoundedAmount0.times(positionPercentOfTotalSupply),
    )
    position.cumulativeCompoundedAmount1 = position.cumulativeCompoundedAmount1.plus(
      harvest.compoundedAmount1.times(positionPercentOfTotalSupply),
    )
    position.cumulativeCompoundedAmount0USD = position.cumulativeCompoundedAmount0USD.plus(
      harvest.compoundedAmount0USD.times(positionPercentOfTotalSupply),
    )
    position.cumulativeCompoundedAmount1USD = position.cumulativeCompoundedAmount1USD.plus(
      harvest.compoundedAmount1USD.times(positionPercentOfTotalSupply),
    )
    position.cumulativeCompoundedValueUSD = position.cumulativeCompoundedValueUSD.plus(positionChangeUSD)
    position.save()
    for (let i = 0; i < INVESTOR_SNAPSHOT_PERIODS.length; i++) {
      const period = INVESTOR_SNAPSHOT_PERIODS[i]
      const positionSnapshot = getInvestorPositionSnapshot(vault, investor, event.block.timestamp, period)
      positionSnapshot.compoundedAmount0 = positionSnapshot.compoundedAmount0.plus(
        harvest.compoundedAmount0.times(positionPercentOfTotalSupply),
      )
      positionSnapshot.compoundedAmount1 = positionSnapshot.compoundedAmount1.plus(
        harvest.compoundedAmount1.times(positionPercentOfTotalSupply),
      )
      positionSnapshot.compoundedAmount0USD = positionSnapshot.compoundedAmount0USD.plus(
        harvest.compoundedAmount0USD.times(positionPercentOfTotalSupply),
      )
      positionSnapshot.compoundedAmount1USD = positionSnapshot.compoundedAmount1USD.plus(
        harvest.compoundedAmount1USD.times(positionPercentOfTotalSupply),
      )
      positionSnapshot.compoundedValueUSD = positionSnapshot.compoundedValueUSD.plus(positionChangeUSD)
      positionSnapshot.save()
    }

    investor.cumulativeCompoundedValueUSD = investor.cumulativeCompoundedValueUSD.plus(positionChangeUSD)
    investor.save()
    for (let i = 0; i < INVESTOR_SNAPSHOT_PERIODS.length; i++) {
      const period = INVESTOR_SNAPSHOT_PERIODS[i]
      const investorSnapshot = getInvestorSnapshot(investor, event.block.timestamp, period)
      investorSnapshot.compoundedValueUSD = investorSnapshot.compoundedValueUSD.plus(positionChangeUSD)
      investorSnapshot.save()
    }
  }

  ///////
  // update protocol entities
  const protocol = getBeefyCLProtocol()
  protocol.cumulativeHarvestCount += 1
  protocol.save()
  for (let i = 0; i < PROTOCOL_SNAPSHOT_PERIODS.length; i++) {
    const period = PROTOCOL_SNAPSHOT_PERIODS[i]
    const protocolSnapshot = getBeefyCLProtocolSnapshot(event.block.timestamp, period)
    protocolSnapshot.harvesterTransactionsCount += 1
    protocolSnapshot.save()
  }
}

export function handleStrategyClaimedFees(event: ClaimedFeesEvent): void {
  handleStrategyFees(
    event,
    event.params.feeAlt0.plus(event.params.feeMain0),
    event.params.feeAlt1.plus(event.params.feeMain1),
    ZERO_BI,
  )
}
export function handleStrategyClaimedOutput(event: ClaimedOutputEvent): void {
  handleStrategyFees(event, ZERO_BI, ZERO_BI, event.params.fees)
}

function handleStrategyFees(
  event: ethereum.Event,
  rawCollectedAmount0: BigInt,
  rawCollectedAmount1: BigInt,
  rawCollectedEarned: BigInt,
): void {
  let strategy = getBeefyCLStrategy(event.address)
  let vault = getBeefyCLVault(strategy.vault)
  if (!isVaultRunning(vault)) {
    return
  }

  const sharesToken = getToken(vault.sharesToken)
  const token0 = getToken(vault.underlyingToken0)
  const token1 = getToken(vault.underlyingToken1)
  const earnedToken = getToken(vault.earnedToken)

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain
  const vaultData = fetchVaultLatestData(vault, strategy, sharesToken, token0, token1, earnedToken)
  const currentPriceInToken1 = vaultData.currentPriceInToken1
  const rangeMinToken1Price = vaultData.rangeMinToken1Price
  const rangeMaxToken1Price = vaultData.rangeMaxToken1Price
  const vaultBalanceUnderlying0 = vaultData.token0Balance
  const vaultBalanceUnderlying1 = vaultData.token1Balance
  const token0PriceInNative = vaultData.token0ToNative
  const token1PriceInNative = vaultData.token1ToNative
  const earnedTokenPriceInNative = vaultData.earnedToNative
  const nativePriceUSD = vaultData.nativeToUsd
  const shareTokenToUnderlying0Rate = vaultData.shareTokenToUnderlying0Rate
  const shareTokenToUnderlying1Rate = vaultData.shareTokenToUnderlying1Rate

  ///////
  // compute derived values
  const token0PriceInUSD = token0PriceInNative.times(nativePriceUSD)
  const token1PriceInUSD = token1PriceInNative.times(nativePriceUSD)
  const earnedTokenPriceInUSD = earnedTokenPriceInNative.times(nativePriceUSD)
  const collectedAmount0 = tokenAmountToDecimal(rawCollectedAmount0, token0.decimals)
  const collectedAmount1 = tokenAmountToDecimal(rawCollectedAmount1, token1.decimals)
  const collectedEarned = !earnedToken ? ZERO_BD : tokenAmountToDecimal(rawCollectedEarned, earnedToken.decimals)

  ///////
  // store the raw collect event
  let collect = new BeefyCLVaultUnderlyingFeesCollectedEvent(getEventIdentifier(event))
  collect.vault = vault.id
  collect.strategy = strategy.id
  collect.createdWith = tx.id
  collect.timestamp = event.block.timestamp
  collect.underlyingAmount0 = vaultBalanceUnderlying0
  collect.underlyingAmount1 = vaultBalanceUnderlying1
  collect.underlyingAmount0USD = vaultBalanceUnderlying0.times(token0PriceInUSD)
  collect.underlyingAmount1USD = vaultBalanceUnderlying1.times(token1PriceInUSD)
  collect.totalValueLockedUSD = vaultBalanceUnderlying0
    .times(token0PriceInUSD)
    .plus(vaultBalanceUnderlying1.times(token1PriceInUSD))
  collect.collectedAmount0 = collectedAmount0
  collect.collectedAmount1 = collectedAmount1
  collect.collectedAmountEarned = collectedEarned
  collect.collectedAmount0USD = collectedAmount0.times(token0PriceInUSD)
  collect.collectedAmount1USD = collectedAmount1.times(token1PriceInUSD)
  collect.collectedAmountEarnedUSD = collectedEarned.times(earnedTokenPriceInUSD)
  collect.collectedValueUSD = collect.collectedAmount0USD
    .plus(collect.collectedAmount1USD)
    .plus(collect.collectedAmountEarnedUSD)
  collect.priceOfToken0InToken1 = currentPriceInToken1
  collect.priceOfToken0InUSD = token0PriceInUSD
  collect.priceOfToken1InUSD = token1PriceInUSD
  collect.priceOfEarnedTokenInUSD = earnedTokenPriceInUSD
  collect.save()

  const collectedAmountInToken1 = collectedAmount0.times(currentPriceInToken1).plus(collectedAmount1)
  const vaultBalanceInToken1 = vaultBalanceUnderlying0.times(currentPriceInToken1).plus(vaultBalanceUnderlying1)

  ///////
  // update vault entities
  vault.currentPriceOfToken0InToken1 = currentPriceInToken1
  vault.currentPriceOfToken0InUSD = currentPriceInToken1.times(token1PriceInUSD)
  vault.priceRangeMin1 = rangeMinToken1Price
  vault.priceRangeMax1 = rangeMaxToken1Price
  vault.priceRangeMinUSD = vault.priceRangeMin1.times(token1PriceInUSD)
  vault.priceRangeMaxUSD = vault.priceRangeMax1.times(token1PriceInUSD)
  vault.underlyingAmount0 = vaultBalanceUnderlying0
  vault.underlyingAmount1 = vaultBalanceUnderlying1
  vault.underlyingAmount0USD = vault.underlyingAmount0.times(token0PriceInUSD)
  vault.underlyingAmount1USD = vault.underlyingAmount1.times(token1PriceInUSD)
  vault.totalValueLockedUSD = vault.underlyingAmount0USD.plus(vault.underlyingAmount1USD)
  const aprState = AprState.deserialize(vault.aprState)
  aprState.addTransaction(collectedAmountInToken1, event.block.timestamp, vaultBalanceInToken1)
  vault.apr1D = AprCalc.calculateLastApr(DAY, aprState, event.block.timestamp)
  vault.apr7D = AprCalc.calculateLastApr(DAY.times(BigInt.fromU32(7)), aprState, event.block.timestamp)
  vault.apr30D = AprCalc.calculateLastApr(DAY.times(BigInt.fromU32(30)), aprState, event.block.timestamp)
  // keep the longest period in the state, AprCalc will ignore older entries if they don't fit the period
  vault.aprState = AprCalc.evictOldEntries(DAY.times(BigInt.fromU32(30)), aprState, event.block.timestamp).serialize()
  vault.save()
  for (let i = 0; i < VAULT_SNAPSHOT_PERIODS.length; i++) {
    const period = VAULT_SNAPSHOT_PERIODS[i]
    const vaultSnapshot = getBeefyCLVaultSnapshot(vault, event.block.timestamp, period)
    vaultSnapshot.currentPriceOfToken0InToken1 = vault.currentPriceOfToken0InToken1
    vaultSnapshot.currentPriceOfToken0InUSD = vault.currentPriceOfToken0InUSD
    vaultSnapshot.priceRangeMin1 = vault.priceRangeMin1
    vaultSnapshot.priceRangeMax1 = vault.priceRangeMax1
    vaultSnapshot.priceRangeMinUSD = vault.priceRangeMinUSD
    vaultSnapshot.priceRangeMaxUSD = vault.priceRangeMaxUSD
    vaultSnapshot.underlyingAmount0 = vault.underlyingAmount0
    vaultSnapshot.underlyingAmount1 = vault.underlyingAmount1
    vaultSnapshot.underlyingAmount0USD = vault.underlyingAmount0USD
    vaultSnapshot.underlyingAmount1USD = vault.underlyingAmount1USD
    vaultSnapshot.totalValueLockedUSD = vault.totalValueLockedUSD
    vaultSnapshot.apr1D = vault.apr1D
    vaultSnapshot.apr7D = vault.apr7D
    vaultSnapshot.apr30D = vault.apr30D
    vaultSnapshot.save()
  }

  ///////
  // update investor positions
  let positions = vault.positions.load()
  let positivePositionCount = 0
  for (let i = 0; i < positions.length; i++) {
    let position = positions[i]
    if (!position.sharesBalance.gt(ZERO_BD)) {
      continue
    }
    positivePositionCount += 1

    let investor = getInvestor(position.investor)
    position.underlyingBalance0 = position.sharesBalance.times(shareTokenToUnderlying0Rate)
    position.underlyingBalance1 = position.sharesBalance.times(shareTokenToUnderlying1Rate)
    position.underlyingBalance0USD = position.underlyingBalance0.times(token0PriceInUSD)
    position.underlyingBalance1USD = position.underlyingBalance1.times(token1PriceInUSD)
    const previousPositionValueUSD = position.positionValueUSD
    position.positionValueUSD = position.underlyingBalance0USD.plus(position.underlyingBalance1USD)
    const positionChangeUSD = position.positionValueUSD.minus(previousPositionValueUSD)
    position.save()
    for (let i = 0; i < INVESTOR_SNAPSHOT_PERIODS.length; i++) {
      const period = INVESTOR_SNAPSHOT_PERIODS[i]
      const positionSnapshot = getInvestorPositionSnapshot(vault, investor, event.block.timestamp, period)
      positionSnapshot.sharesBalance = position.sharesBalance
      positionSnapshot.underlyingBalance0 = position.underlyingBalance0
      positionSnapshot.underlyingBalance1 = position.underlyingBalance1
      positionSnapshot.underlyingBalance0USD = position.underlyingBalance0USD
      positionSnapshot.underlyingBalance1USD = position.underlyingBalance1USD
      positionSnapshot.positionValueUSD = position.positionValueUSD
      positionSnapshot.save()
    }

    investor.totalPositionValueUSD = investor.totalPositionValueUSD.plus(positionChangeUSD)
    investor.save()
    for (let i = 0; i < INVESTOR_SNAPSHOT_PERIODS.length; i++) {
      const period = INVESTOR_SNAPSHOT_PERIODS[i]
      const investorSnapshot = getInvestorSnapshot(investor, event.block.timestamp, period)
      investorSnapshot.totalPositionValueUSD = investor.totalPositionValueUSD
      investorSnapshot.save()
    }
  }

  ///////
  // update protocol entities
  const protocol = getBeefyCLProtocol()
  // this is not exact but will be corrected by the next clock tick
  protocol.totalValueLockedUSD = protocol.totalValueLockedUSD.plus(collect.collectedValueUSD)
  protocol.cumulativeTransactionCount += 1
  protocol.save()
  for (let i = 0; i < PROTOCOL_SNAPSHOT_PERIODS.length; i++) {
    const period = PROTOCOL_SNAPSHOT_PERIODS[i]
    const protocolSnapshot = getBeefyCLProtocolSnapshot(event.block.timestamp, period)
    protocolSnapshot.totalValueLockedUSD = protocol.totalValueLockedUSD
    protocolSnapshot.transactionCount += 1
    protocolSnapshot.save()
  }
}
