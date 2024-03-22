import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import { Harvest as HarvestEvent } from "./../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap"
import { BeefyVaultConcLiq as BeefyCLVaultContract } from "./../generated/templates/BeefyCLVault/BeefyVaultConcLiq"
import { getBeefyCLStrategy, getBeefyCLVault, getBeefyCLVaultSnapshot, isVaultRunning } from "./entity/vault"
import { getTransaction } from "./entity/transaction"
import { BeefyCLVaultHarvestEvent } from "./../generated/schema"
import { getEventIdentifier } from "./utils/event"
import { getToken } from "./entity/token"
import { ONE_BD, ZERO_BD, tokenAmountToDecimal, decimalToTokenAmount } from "./utils/decimal"
import { SNAPSHOT_PERIODS } from "./utils/time"
import { getBeefyCLProtocol, getBeefyCLProtocolSnapshot } from "./entity/protocol"
import { getInvestorPositionSnapshot } from "./entity/position"
import { getInvestor } from "./entity/investor"
import { getCurrentPriceInToken1, getVaultPriceRangeInToken1, getVaultPrices } from "./mapping/price"

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
  const currentPriceInToken1 = getCurrentPriceInToken1(strategyAddress, true)
  const rangeToken1Price = getVaultPriceRangeInToken1(strategyAddress, true)

  // balances of the vault
  const vaultBalancesRes = vaultContract.try_balances()
  if (vaultBalancesRes.reverted) {
    log.error("handleStrategyHarvest: balances() reverted for strategy {}", [vault.strategy.toHexString()])
    throw Error("handleStrategyHarvest: balances() reverted")
  }
  const vaultBalanceUnderlying0 = tokenAmountToDecimal(vaultBalancesRes.value.value0, token0.decimals)
  const vaultBalanceUnderlying1 = tokenAmountToDecimal(vaultBalancesRes.value.value1, token1.decimals)

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

  const prices = getVaultPrices(vault, token0, token1)
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
  harvest.underlyingAmount0USD = vault.underlyingAmount0.times(token0PriceInUSD)
  harvest.underlyingAmount1USD = vault.underlyingAmount1.times(token1PriceInUSD)
  harvest.totalValueLockedUSD = vault.underlyingAmount0
    .times(token0PriceInUSD)
    .plus(vault.underlyingAmount1.times(token1PriceInUSD))
  harvest.harvestedAmount0 = tokenAmountToDecimal(event.params.fee0, token0.decimals)
  harvest.harvestedAmount1 = tokenAmountToDecimal(event.params.fee1, token1.decimals)
  harvest.harvestedAmount0USD = harvest.harvestedAmount0.times(token0PriceInUSD)
  harvest.harvestedAmount1USD = harvest.harvestedAmount1.times(token1PriceInUSD)
  harvest.harvestValueUSD = harvest.harvestedAmount0USD.plus(harvest.harvestedAmount1USD)
  harvest.save()

  ///////
  // update vault entities
  vault.currentPriceOfToken0InToken1 = currentPriceInToken1
  vault.priceRangeMin1 = rangeToken1Price.min
  vault.priceRangeMax1 = rangeToken1Price.max
  vault.priceRangeMinUSD = vault.priceRangeMin1.times(token1PriceInUSD)
  vault.priceRangeMaxUSD = vault.priceRangeMax1.times(token1PriceInUSD)
  vault.underlyingAmount0 = vaultBalanceUnderlying0
  vault.underlyingAmount1 = vaultBalanceUnderlying1
  vault.underlyingAmount0USD = vault.underlyingAmount0.times(token0PriceInUSD)
  vault.underlyingAmount1USD = vault.underlyingAmount1.times(token1PriceInUSD)
  vault.totalValueLockedUSD = vault.underlyingAmount0USD.plus(vault.underlyingAmount1USD)
  vault.cumulativeHarvestCount += 1
  vault.cumulativeHarvestedAmount0 = vault.cumulativeHarvestedAmount0.plus(harvest.harvestedAmount0)
  vault.cumulativeHarvestedAmount1 = vault.cumulativeHarvestedAmount1.plus(harvest.harvestedAmount1)
  vault.cumulativeHarvestedAmount0USD = vault.cumulativeHarvestedAmount0USD.plus(harvest.harvestedAmount0USD)
  vault.cumulativeHarvestedAmount1USD = vault.cumulativeHarvestedAmount1USD.plus(harvest.harvestedAmount1USD)
  vault.cumulativeHarvestValueUSD = vault.cumulativeHarvestedAmount0USD.plus(vault.cumulativeHarvestedAmount1USD)
  vault.save()
  for (let i = 0; i < periods.length; i++) {
    log.debug("handleStrategyHarvest: updating vault snapshot for vault {} and period {}", [
      vault.id.toHexString(),
      periods[i].toString(),
    ])
    const vaultSnapshot = getBeefyCLVaultSnapshot(vault, event.block.timestamp, periods[i])
    vaultSnapshot.currentPriceOfToken0InToken1 = vault.currentPriceOfToken0InToken1
    vaultSnapshot.priceRangeMin1 = vault.priceRangeMin1
    vaultSnapshot.priceRangeMax1 = vault.priceRangeMax1
    vaultSnapshot.priceRangeMinUSD = vault.priceRangeMinUSD
    vaultSnapshot.priceRangeMaxUSD = vault.priceRangeMaxUSD
    vaultSnapshot.underlyingAmount0 = vault.underlyingAmount0
    vaultSnapshot.underlyingAmount1 = vault.underlyingAmount1
    vaultSnapshot.underlyingAmount0USD = vault.underlyingAmount0USD
    vaultSnapshot.underlyingAmount1USD = vault.underlyingAmount1USD
    vaultSnapshot.totalValueLockedUSD = vault.totalValueLockedUSD
    vaultSnapshot.harvestCount += 1
    vaultSnapshot.harvestedAmount0 = vaultSnapshot.harvestedAmount0.plus(harvest.harvestedAmount0)
    vaultSnapshot.harvestedAmount1 = vaultSnapshot.harvestedAmount1.plus(harvest.harvestedAmount1)
    vaultSnapshot.harvestedAmount0USD = vaultSnapshot.harvestedAmount0USD.plus(harvest.harvestedAmount0USD)
    vaultSnapshot.harvestedAmount1USD = vaultSnapshot.harvestedAmount1USD.plus(harvest.harvestedAmount1USD)
    vaultSnapshot.harvestValueUSD = vaultSnapshot.harvestedAmount0USD.plus(vaultSnapshot.harvestedAmount1USD)
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

    log.debug("handleStrategyHarvest: updating investor position for investor {}", [position.investor.toHexString()])
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
      log.debug("handleStrategyHarvest: updating investor position snapshot for investor {} and period {}", [
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

    log.debug("handleStrategyHarvest: updating investor for investor {}", [position.investor.toHexString()])
    investor.totalPositionValueUSD = investor.totalPositionValueUSD.plus(positionChangeUSD)
    investor.save()
  }

  ///////
  // update protocol entities
  log.debug("handleStrategyHarvest: updating protocol entities for vault {}", [vault.id.toHexString()])
  const protocol = getBeefyCLProtocol()
  protocol.totalValueLockedUSD = protocol.totalValueLockedUSD.plus(harvest.harvestValueUSD)
  protocol.cumulativeTransactionCount += 1
  protocol.cumulativeHarvestCount += 1
  protocol.save()
  for (let i = 0; i < periods.length; i++) {
    log.debug("handleStrategyHarvest: updating protocol snapshot for period {}", [periods[i].toString()])
    const protocolSnapshot = getBeefyCLProtocolSnapshot(event.block.timestamp, periods[i])
    protocolSnapshot.totalValueLockedUSD = protocol.totalValueLockedUSD
    protocolSnapshot.transactionCount += 1
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
