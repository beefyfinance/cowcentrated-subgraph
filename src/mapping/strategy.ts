import { Address, BigInt, log } from '@graphprotocol/graph-ts'
import { Harvest as HarvestEvent } from '../../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap'
import { StrategyPassiveManagerUniswap as BeefyCLStrategyContract } from '../../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap'
import { BeefyVaultConcLiq as BeefyCLVaultContract } from '../../generated/templates/BeefyCLVault/BeefyVaultConcLiq'
import { getBeefyCLStrategy, getBeefyCLVault, getBeefyCLVaultSnapshot, isVaultRunning } from '../entity/vault'
import { getTransaction } from '../entity/transaction'
import { BeefyCLVaultHarvestEvent } from '../../generated/schema'
import { getEventIdentifier } from '../utils/event'
import { getToken } from '../entity/token'
import { ONE_BD, ZERO_BD, tokenAmountToDecimal, decimalToTokenAmount } from '../utils/decimal'
import { sqrtPriceX96ToPriceInToken1, tickToPrice } from '../utils/uniswap'
import { PERIODS } from '../utils/time'
import { getBeefyCLProtocol, getBeefyCLProtocolSnapshot } from '../entity/protocol'
import { getInvestorPositionSnapshot } from '../entity/position'
import { getInvestor } from '../entity/investor'
export {
  handleStrategyInitialized as handleInitialized,
  handleStrategyPaused as handlePaused,
  handleStrategyUnpaused as handleUnpaused,
} from '../vault-lifecycle'
export { handleStrategyOwnershipTransferred as handleOwnershipTransferred } from '../ownership'

export function handleHarvest(event: HarvestEvent): void {
  let strategy = getBeefyCLStrategy(event.address)
  let vault = getBeefyCLVault(strategy.vault)
  if (!isVaultRunning(vault)) {
    log.error('handleHarvest: vault {} not active at block {}: {}', [
      vault.id.toHexString(),
      event.block.number.toString(),
      vault.lifecycle,
    ])
    return
  }

  const periods = PERIODS
  const sharesToken = getToken(vault.sharesToken)
  const token0 = getToken(vault.underlyingToken0)
  const token1 = getToken(vault.underlyingToken1)

  let tx = getTransaction(event.block, event.transaction, event.receipt)
  tx.save()

  ///////
  // fetch data on chain
  // TODO: use multicall3 to fetch all data in one call
  const vaultContract = BeefyCLVaultContract.bind(Address.fromBytes(vault.id))
  const strategyContract = BeefyCLStrategyContract.bind(Address.fromBytes(vault.strategy))

  // current price
  const sqrtPriceRes = strategyContract.try_price() // TODO: replace with "try_sqrtPrice()" when new strats are deployed
  if (sqrtPriceRes.reverted) {
    log.error('updateUserPosition: price() reverted for strategy {}', [vault.strategy.toHexString()])
    throw Error('updateUserPosition: price() reverted')
  }
  const currentPriceInToken1 = sqrtPriceX96ToPriceInToken1(sqrtPriceRes.value, token0, token1)

  // range the strategy is covering
  const rangeRes = strategyContract.try_positionMain() // TODO: use "try_range()" when new strats are deployed
  if (rangeRes.reverted) {
    log.error('updateUserPosition: range() reverted for strategy {}', [vault.strategy.toHexString()])
    throw Error('updateUserPosition: range() reverted')
  }
  const rangeMinToken1Price = tickToPrice(BigInt.fromI32(rangeRes.value.value0), token0, token1)
  const rangeMaxToken1Price = tickToPrice(BigInt.fromI32(rangeRes.value.value1), token0, token1)

  // balances of the vault
  const vaultBalancesRes = vaultContract.try_balances()
  if (vaultBalancesRes.reverted) {
    log.error('updateUserPosition: balances() reverted for strategy {}', [vault.strategy.toHexString()])
    throw Error('updateUserPosition: balances() reverted')
  }
  const vaultBalanceUnderlying0 = tokenAmountToDecimal(vaultBalancesRes.value.value0, token0.decimals)
  const vaultBalanceUnderlying1 = tokenAmountToDecimal(vaultBalancesRes.value.value1, token1.decimals)

  // preview withdraw of 1 share token
  let previewWithdraw0Raw = BigInt.fromI32(0)
  let previewWithdraw1Raw = BigInt.fromI32(0)
  if (vaultBalanceUnderlying0.gt(ZERO_BD) || vaultBalanceUnderlying1.gt(ZERO_BD)) {
    const previewWithdrawRes = vaultContract.try_previewWithdraw(decimalToTokenAmount(ONE_BD, sharesToken.decimals))
    if (previewWithdrawRes.reverted) {
      log.error('updateUserPosition: previewWithdraw() reverted for vault {}', [vault.id.toHexString()])
      throw Error('updateUserPosition: previewWithdraw() reverted')
    }
    previewWithdraw0Raw = previewWithdrawRes.value.value0
    previewWithdraw1Raw = previewWithdrawRes.value.value1
  }
  let shareTokenToUnderlying0Rate = tokenAmountToDecimal(previewWithdraw0Raw, token0.decimals)
  let shareTokenToUnderlying1Rate = tokenAmountToDecimal(previewWithdraw1Raw, token1.decimals)

  ///////
  // compute derived values
  const token0PriceInNative = ZERO_BD // TODO
  const token1PriceInNative = ZERO_BD // TODO
  const nativePriceUSD = ZERO_BD // TODO
  const txGasFeeUSD = tx.gasFee.times(nativePriceUSD)
  const token0PriceInUSD = token0PriceInNative.times(nativePriceUSD)
  const token1PriceInUSD = token1PriceInNative.times(nativePriceUSD)

  ///////
  // update vault entities
  let harvest = new BeefyCLVaultHarvestEvent(getEventIdentifier(event))
  harvest.vault = vault.id
  harvest.strategy = strategy.id
  harvest.createdWith = tx.id
  harvest.harvestedAmount0 = tokenAmountToDecimal(event.params.fee0, token0.decimals)
  harvest.harvestedAmount1 = tokenAmountToDecimal(event.params.fee1, token1.decimals)
  harvest.harvestedAmount0USD = harvest.harvestedAmount0.times(token0PriceInUSD)
  harvest.harvestedAmount1USD = harvest.harvestedAmount1.times(token1PriceInUSD)
  harvest.harvestValueUSD = harvest.harvestedAmount0USD.plus(harvest.harvestedAmount1USD)
  harvest.save()

  vault.currentPriceOfToken0InToken1 = currentPriceInToken1
  vault.priceRangeMin1 = rangeMinToken1Price
  vault.priceRangeMax1 = rangeMaxToken1Price
  vault.priceRangeMin1USD = vault.priceRangeMin1.times(token1PriceInUSD)
  vault.priceRangeMax1USD = vault.priceRangeMax1.times(token1PriceInUSD)
  vault.underlyingAmount0 = vaultBalanceUnderlying0
  vault.underlyingAmount1 = vaultBalanceUnderlying1
  vault.underlyingAmount0USD = vault.underlyingAmount0.times(token0PriceInUSD)
  vault.underlyingAmount1USD = vault.underlyingAmount1.times(token1PriceInUSD)
  vault.totalValueLockedUSD = vault.underlyingAmount0USD.plus(vault.underlyingAmount1USD)
  vault.totalHarvestCount += 1
  vault.totalHarvestedAmount0 = vault.totalHarvestedAmount0.plus(harvest.harvestedAmount0)
  vault.totalHarvestedAmount1 = vault.totalHarvestedAmount1.plus(harvest.harvestedAmount1)
  vault.totalHarvestedAmount0USD = vault.totalHarvestedAmount0USD.plus(harvest.harvestedAmount0USD)
  vault.totalHarvestedAmount1USD = vault.totalHarvestedAmount1USD.plus(harvest.harvestedAmount1USD)
  vault.totalHarvestValueUSD = vault.totalHarvestedAmount0USD.plus(vault.totalHarvestedAmount1USD)
  vault.save()
  for (let i = 0; i < periods.length; i++) {
    const vaultSnapshot = getBeefyCLVaultSnapshot(vault, event.block.timestamp, periods[i])
    vaultSnapshot.currentPriceOfToken0InToken1 = vault.currentPriceOfToken0InToken1
    vaultSnapshot.priceRangeMin1 = vault.priceRangeMax1
    vaultSnapshot.priceRangeMax1 = vault.priceRangeMax1
    vaultSnapshot.priceRangeMin1USD = vault.priceRangeMax1USD
    vaultSnapshot.priceRangeMax1USD = vault.priceRangeMax1USD
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
  // update protocol entities
  const protocol = getBeefyCLProtocol()
  protocol.transactionCount += 1
  protocol.totalValueLockedUSD = protocol.totalValueLockedUSD.plus(harvest.harvestValueUSD)
  protocol.harvestCount += 1
  protocol.transactionCount += 1
  protocol.save()
  for (let i = 0; i < periods.length; i++) {
    const protocolSnapshot = getBeefyCLProtocolSnapshot(event.block.timestamp, periods[i])
    protocolSnapshot.totalValueLockedUSD = protocolSnapshot.totalValueLockedUSD.plus(harvest.harvestValueUSD)
    protocolSnapshot.totalTransactionCount += 1
    protocolSnapshot.harvesterTransactionsCount += 1
    protocolSnapshot.totalGasSpent = protocolSnapshot.totalGasSpent.plus(tx.gasFee)
    protocolSnapshot.totalGasSpentUSD = protocolSnapshot.totalGasSpentUSD.plus(txGasFeeUSD)
    protocolSnapshot.harvesterGasSpent = protocolSnapshot.investorGasSpent.plus(tx.gasFee)
    protocolSnapshot.harvesterGasSpentUSD = protocolSnapshot.investorGasSpentUSD.plus(txGasFeeUSD)
    protocolSnapshot.save()
  }

  ///////
  // update investor positions
  let positions = vault.positions.load()
  for (let i = 0; i < positions.length; i++) {
    let position = positions[i]
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
      const positionSnapshot = getInvestorPositionSnapshot(vault, investor, event.block.timestamp, periods[i])
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
  }
}
