import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import {
  ClaimedFees as ClaimedFeesEvent,
  Harvest as HarvestEvent,
} from "../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap"
import { BeefyVaultConcLiq as BeefyCLVaultContract } from "../generated/templates/BeefyCLVault/BeefyVaultConcLiq"
import { getBeefyCLStrategy, getBeefyCLVault, getBeefyCLVaultSnapshot, isVaultRunning } from "./entity/vault"
import { getTransaction } from "./entity/transaction"
import { BeefyCLVaultHarvestEvent, BeefyCLVaultUnderlyingFeesCollectedEvent } from "../generated/schema"
import { getEventIdentifier } from "./utils/event"
import { getToken } from "./entity/token"
import { ONE_BD, ZERO_BD, tokenAmountToDecimal, decimalToTokenAmount, ZERO_BI } from "./utils/decimal"
import { DAY, SNAPSHOT_PERIODS, WEEK, YEAR } from "./utils/time"
import { getBeefyCLProtocol, getBeefyCLProtocolSnapshot } from "./entity/protocol"
import { getInvestorPositionSnapshot } from "./entity/position"
import { getInvestor, getInvestorSnapshot } from "./entity/investor"
import { fetchCurrentPriceInToken1, fetchVaultPriceRangeInToken1, fetchVaultPrices } from "./utils/price"
import { AprCalc, AprState } from "./utils/apr"

export function handleStrategyHarvest(event: HarvestEvent): void {
  let strategy = getBeefyCLStrategy(event.address)
  let vault = getBeefyCLVault(strategy.vault)
  if (!isVaultRunning(vault)) {
    log.error("handleHarvest: vault {} not active at block {}: {}", [
      vault.id.toHexString(),
      event.block.number.toString(),
      vault.lifecycle,
    ])
    return
  }

  log.debug("handleHarvest: processing harvest for vault {}", [vault.id.toHexString()])

  const periods = SNAPSHOT_PERIODS
  const sharesToken = getToken(vault.sharesToken)
  const token0 = getToken(vault.underlyingToken0)
  const token1 = getToken(vault.underlyingToken1)

  let tx = getTransaction(event.block, event.transaction, event.receipt)
  tx.save()

  ///////
  // fetch data on chain
  // TODO: use multicall3 to fetch all data in one call
  log.debug("handleStrategyHarvest: fetching data for vault {}", [vault.id.toHexString()])
  const vaultContract = BeefyCLVaultContract.bind(Address.fromBytes(vault.id))
  const strategyAddress = Address.fromBytes(vault.strategy)

  // current prices
  const currentPriceInToken1 = fetchCurrentPriceInToken1(strategyAddress, true)
  const rangeToken1Price = fetchVaultPriceRangeInToken1(strategyAddress, true)

  // balances of the vault
  const vaultBalancesRes = vaultContract.try_balances()
  if (vaultBalancesRes.reverted) {
    log.error("handleStrategyHarvest: balances() reverted for strategy {}", [vault.strategy.toHexString()])
    throw Error("handleStrategyHarvest: balances() reverted")
  }
  const vaultBalanceUnderlying0 = tokenAmountToDecimal(vaultBalancesRes.value.value0, token0.decimals)
  const vaultBalanceUnderlying1 = tokenAmountToDecimal(vaultBalancesRes.value.value1, token1.decimals)

  // vault shares total supply
  const sharesTotalSupplyRes = vaultContract.try_totalSupply()
  if (sharesTotalSupplyRes.reverted) {
    log.error("handleStrategyHarvest: totalSupply() reverted for vault {}", [vault.id.toHexString()])
    throw Error("handleStrategyHarvest: totalSupply() reverted")
  }
  const sharesTotalSupply = tokenAmountToDecimal(sharesTotalSupplyRes.value, sharesToken.decimals)

  // preview withdraw of 1 share token
  let previewWithdraw0Raw = BigInt.fromI32(0)
  let previewWithdraw1Raw = BigInt.fromI32(0)
  if (vaultBalanceUnderlying0.gt(ZERO_BD) || vaultBalanceUnderlying1.gt(ZERO_BD)) {
    const previewWithdrawRes = vaultContract.try_previewWithdraw(decimalToTokenAmount(ONE_BD, sharesToken.decimals))
    if (previewWithdrawRes.reverted) {
      log.error("handleStrategyHarvest: previewWithdraw() reverted for vault {}", [vault.id.toHexString()])
      throw Error("handleStrategyHarvest: previewWithdraw() reverted")
    }
    previewWithdraw0Raw = previewWithdrawRes.value.value0
    previewWithdraw1Raw = previewWithdrawRes.value.value1
  }
  let shareTokenToUnderlying0Rate = tokenAmountToDecimal(previewWithdraw0Raw, token0.decimals)
  let shareTokenToUnderlying1Rate = tokenAmountToDecimal(previewWithdraw1Raw, token1.decimals)

  const prices = fetchVaultPrices(vault, strategy, token0, token1)
  const token0PriceInNative = prices.token0ToNative
  const token1PriceInNative = prices.token1ToNative
  const nativePriceUSD = prices.nativeToUsd

  ///////
  // compute derived values
  log.debug("handleStrategyHarvest: computing derived values for vault {}", [vault.id.toHexString()])
  const txGasFeeUSD = tx.gasFee.times(nativePriceUSD)
  const token0PriceInUSD = token0PriceInNative.times(nativePriceUSD)
  const token1PriceInUSD = token1PriceInNative.times(nativePriceUSD)

  ///////
  // store the raw harvest event
  log.debug("handleStrategyHarvest: updating vault entities for vault {}", [vault.id.toHexString()])
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
  for (let i = 0; i < periods.length; i++) {
    log.debug("handleStrategyHarvest: updating vault snapshot for vault {} and period {}", [
      vault.id.toHexString(),
      periods[i].toString(),
    ])
    const vaultSnapshot = getBeefyCLVaultSnapshot(vault, event.block.timestamp, periods[i])
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
  log.debug("handleStrategyHarvest: updating investor positions for vault {}", [vault.id.toHexString()])
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

    log.debug("handleStrategyHarvest: updating investor position for investor {}", [position.investor.toHexString()])
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
    for (let i = 0; i < periods.length; i++) {
      log.debug("handleStrategyHarvest: updating investor position snapshot for investor {} and period {}", [
        position.investor.toHexString(),
        periods[i].toString(),
      ])
      const positionSnapshot = getInvestorPositionSnapshot(vault, investor, event.block.timestamp, periods[i])
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

    log.debug("handleStrategyHarvest: updating investor for investor {}", [position.investor.toHexString()])
    investor.cumulativeCompoundedValueUSD = investor.cumulativeCompoundedValueUSD.plus(positionChangeUSD)
    investor.save()
    for (let i = 0; i < periods.length; i++) {
      log.debug("handleStrategyHarvest: updating investor snapshot for investor {} and period {}", [
        position.investor.toHexString(),
        periods[i].toString(),
      ])
      const investorSnapshot = getInvestorSnapshot(investor, event.block.timestamp, periods[i])
      investorSnapshot.compoundedValueUSD = investorSnapshot.compoundedValueUSD.plus(positionChangeUSD)
      investorSnapshot.save()
    }
  }

  ///////
  // update protocol entities
  log.debug("handleStrategyHarvest: updating protocol entities for vault {}", [vault.id.toHexString()])
  const protocol = getBeefyCLProtocol()
  protocol.cumulativeHarvestCount += 1
  protocol.save()
  for (let i = 0; i < periods.length; i++) {
    log.debug("handleStrategyHarvest: updating protocol snapshot for period {}", [periods[i].toString()])
    const protocolSnapshot = getBeefyCLProtocolSnapshot(event.block.timestamp, periods[i])
    protocolSnapshot.harvesterTransactionsCount += 1
    protocolSnapshot.totalGasSpent = protocolSnapshot.totalGasSpent.plus(tx.gasFee)
    protocolSnapshot.totalGasSpentUSD = protocolSnapshot.totalGasSpentUSD.plus(txGasFeeUSD)
    protocolSnapshot.harvesterGasSpent = protocolSnapshot.investorGasSpent.plus(tx.gasFee)
    protocolSnapshot.harvesterGasSpentUSD = protocolSnapshot.investorGasSpentUSD.plus(txGasFeeUSD)
    const harvestGasSaved = tx.gasFee.times(BigDecimal.fromString(positivePositionCount.toString()))
    protocolSnapshot.protocolGasSaved = protocolSnapshot.protocolGasSaved.plus(harvestGasSaved)
    protocolSnapshot.protocolGasSavedUSD = protocolSnapshot.protocolGasSavedUSD.plus(
      harvestGasSaved.times(nativePriceUSD),
    )

    protocolSnapshot.save()
  }
}

export function handleStrategyClaimedFees(event: ClaimedFeesEvent): void {
  let strategy = getBeefyCLStrategy(event.address)
  let vault = getBeefyCLVault(strategy.vault)
  if (!isVaultRunning(vault)) {
    log.error("handleStrategyClaimedFees: vault {} not active at block {}: {}", [
      vault.id.toHexString(),
      event.block.number.toString(),
      vault.lifecycle,
    ])
    return
  }

  log.debug("handleStrategyChargedFees: processing chaimed fees for vault {}", [vault.id.toHexString()])

  const periods = SNAPSHOT_PERIODS
  const sharesToken = getToken(vault.sharesToken)
  const token0 = getToken(vault.underlyingToken0)
  const token1 = getToken(vault.underlyingToken1)

  let tx = getTransaction(event.block, event.transaction, event.receipt)
  tx.save()

  ///////
  // fetch data on chain
  // TODO: use multicall3 to fetch all data in one call
  log.debug("handleStrategyChargedFees: fetching data for vault {}", [vault.id.toHexString()])
  const vaultContract = BeefyCLVaultContract.bind(Address.fromBytes(vault.id))
  const strategyAddress = Address.fromBytes(vault.strategy)

  // current prices
  const currentPriceInToken1 = fetchCurrentPriceInToken1(strategyAddress, true)
  const rangeToken1Price = fetchVaultPriceRangeInToken1(strategyAddress, true)

  // balances of the vault
  const vaultBalancesRes = vaultContract.try_balances()
  if (vaultBalancesRes.reverted) {
    log.error("handleStrategyChargedFees: balances() reverted for strategy {}", [vault.strategy.toHexString()])
    throw Error("handleStrategyChargedFees: balances() reverted")
  }
  const vaultBalanceUnderlying0 = tokenAmountToDecimal(vaultBalancesRes.value.value0, token0.decimals)
  const vaultBalanceUnderlying1 = tokenAmountToDecimal(vaultBalancesRes.value.value1, token1.decimals)

  // preview withdraw of 1 share token
  let previewWithdraw0Raw = BigInt.fromI32(0)
  let previewWithdraw1Raw = BigInt.fromI32(0)
  if (vaultBalanceUnderlying0.gt(ZERO_BD) || vaultBalanceUnderlying1.gt(ZERO_BD)) {
    const previewWithdrawRes = vaultContract.try_previewWithdraw(decimalToTokenAmount(ONE_BD, sharesToken.decimals))
    if (previewWithdrawRes.reverted) {
      log.error("handleStrategyChargedFees: previewWithdraw() reverted for vault {}", [vault.id.toHexString()])
      throw Error("handleStrategyChargedFees: previewWithdraw() reverted")
    }
    previewWithdraw0Raw = previewWithdrawRes.value.value0
    previewWithdraw1Raw = previewWithdrawRes.value.value1
  }
  let shareTokenToUnderlying0Rate = tokenAmountToDecimal(previewWithdraw0Raw, token0.decimals)
  let shareTokenToUnderlying1Rate = tokenAmountToDecimal(previewWithdraw1Raw, token1.decimals)

  const prices = fetchVaultPrices(vault, strategy, token0, token1)
  const token0PriceInNative = prices.token0ToNative
  const token1PriceInNative = prices.token1ToNative
  const nativePriceUSD = prices.nativeToUsd

  ///////
  // compute derived values
  log.debug("handleStrategyChargedFees: computing derived values for vault {}", [vault.id.toHexString()])
  const token0PriceInUSD = token0PriceInNative.times(nativePriceUSD)
  const token1PriceInUSD = token1PriceInNative.times(nativePriceUSD)
  const collectedAmount0 = tokenAmountToDecimal(event.params.feeAlt0.plus(event.params.feeMain0), token0.decimals)
  const collectedAmount1 = tokenAmountToDecimal(event.params.feeAlt1.plus(event.params.feeMain1), token1.decimals)

  ///////
  // store the raw collect event
  log.debug("handleStrategyChargedFees: updating vault entities for vault {}", [vault.id.toHexString()])
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
  collect.collectedAmount0USD = collectedAmount0.times(token0PriceInUSD)
  collect.collectedAmount1USD = collectedAmount1.times(token1PriceInUSD)
  collect.collectedValueUSD = collect.collectedAmount0USD.plus(collect.collectedAmount1USD)
  collect.priceOfToken0InToken1 = currentPriceInToken1
  collect.priceOfToken0InUSD = currentPriceInToken1.times(token1PriceInUSD)
  collect.save()

  const collectedAmountInToken1 = (collectedAmount0.times(currentPriceInToken1)).plus(collectedAmount1);
  const vaultBalanceInToken1 = (vaultBalanceUnderlying0.times(currentPriceInToken1)).plus(vaultBalanceUnderlying1);

  ///////
  // update vault entities
  vault.currentPriceOfToken0InToken1 = currentPriceInToken1
  vault.currentPriceOfToken0InUSD = currentPriceInToken1.times(token1PriceInUSD)
  vault.priceRangeMin1 = rangeToken1Price.min
  vault.priceRangeMax1 = rangeToken1Price.max
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
  for (let i = 0; i < periods.length; i++) {
    log.debug("handleStrategyChargedFees: updating vault snapshot for vault {} and period {}", [
      vault.id.toHexString(),
      periods[i].toString(),
    ])
    const vaultSnapshot = getBeefyCLVaultSnapshot(vault, event.block.timestamp, periods[i])
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
  log.debug("handleStrategyChargedFees: updating investor positions for vault {}", [vault.id.toHexString()])
  let positions = vault.positions.load()
  let positivePositionCount = 0
  for (let i = 0; i < positions.length; i++) {
    let position = positions[i]
    if (!position.sharesBalance.gt(ZERO_BD)) {
      continue
    }
    positivePositionCount += 1

    log.debug("handleStrategyChargedFees: updating investor position for investor {}", [
      position.investor.toHexString(),
    ])
    let investor = getInvestor(position.investor)
    position.underlyingBalance0 = position.sharesBalance.times(shareTokenToUnderlying0Rate)
    position.underlyingBalance1 = position.sharesBalance.times(shareTokenToUnderlying1Rate)
    position.underlyingBalance0USD = position.underlyingBalance0.times(token0PriceInUSD)
    position.underlyingBalance1USD = position.underlyingBalance1.times(token1PriceInUSD)
    const previousPositionValueUSD = position.positionValueUSD
    position.positionValueUSD = position.underlyingBalance0USD.plus(position.underlyingBalance1USD)
    const positionChangeUSD = position.positionValueUSD.minus(previousPositionValueUSD)
    position.save()
    for (let i = 0; i < periods.length; i++) {
      log.debug("handleStrategyChargedFees: updating investor position snapshot for investor {} and period {}", [
        position.investor.toHexString(),
        periods[i].toString(),
      ])
      const positionSnapshot = getInvestorPositionSnapshot(vault, investor, event.block.timestamp, periods[i])
      positionSnapshot.sharesBalance = position.sharesBalance
      positionSnapshot.underlyingBalance0 = position.underlyingBalance0
      positionSnapshot.underlyingBalance1 = position.underlyingBalance1
      positionSnapshot.underlyingBalance0USD = position.underlyingBalance0USD
      positionSnapshot.underlyingBalance1USD = position.underlyingBalance1USD
      positionSnapshot.positionValueUSD = position.positionValueUSD
      positionSnapshot.save()
    }

    log.debug("handleStrategyChargedFees: updating investor for investor {}", [position.investor.toHexString()])
    investor.totalPositionValueUSD = investor.totalPositionValueUSD.plus(positionChangeUSD)
    investor.save()
    for (let i = 0; i < periods.length; i++) {
      log.debug("handleStrategyChargedFees: updating investor snapshot for investor {} and period {}", [
        position.investor.toHexString(),
        periods[i].toString(),
      ])
      const investorSnapshot = getInvestorSnapshot(investor, event.block.timestamp, periods[i])
      investorSnapshot.totalPositionValueUSD = investor.totalPositionValueUSD
      investorSnapshot.save()
    }
  }

  ///////
  // update protocol entities
  log.debug("handleStrategyChargedFees: updating protocol entities for vault {}", [vault.id.toHexString()])
  const protocol = getBeefyCLProtocol()
  // this is not exact but will be corrected by the next clock tick
  protocol.totalValueLockedUSD = protocol.totalValueLockedUSD.plus(collect.collectedValueUSD)
  protocol.cumulativeTransactionCount += 1
  protocol.save()
  for (let i = 0; i < periods.length; i++) {
    log.debug("handleStrategyChargedFees: updating protocol snapshot for period {}", [periods[i].toString()])
    const protocolSnapshot = getBeefyCLProtocolSnapshot(event.block.timestamp, periods[i])
    protocolSnapshot.totalValueLockedUSD = protocol.totalValueLockedUSD
    protocolSnapshot.transactionCount += 1
    protocolSnapshot.save()
  }
}
