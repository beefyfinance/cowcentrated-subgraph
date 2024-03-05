import { Address, BigDecimal, BigInt, ethereum, log } from '@graphprotocol/graph-ts'
import {
  Deposit as DepositEvent,
  Withdraw as WithdrawEvent,
} from './../generated/templates/BeefyCLVault/BeefyVaultConcLiq'
import { getBeefyCLVault, getBeefyCLVaultSnapshot, isVaultRunning } from './entity/vault'
import { getTransaction } from './entity/transaction'
import { getBeefyCLProtocol, getBeefyCLProtocolSnapshot } from './entity/protocol'
import { getInvestor, getInvestorSnapshot, isNewInvestor } from './entity/investor'
import { ZERO_BD, ZERO_BI, tokenAmountToDecimal } from './utils/decimal'
import { BeefyVaultConcLiq as BeefyCLVaultContract } from './../generated/templates/BeefyCLVault/BeefyVaultConcLiq'
import { StrategyPassiveManagerUniswap as BeefyCLStrategyContract } from './../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap'
import { SNAPSHOT_PERIODS } from './utils/time'
import { getToken } from './entity/token'
import { getInvestorPosition, getInvestorPositionSnapshot, isNewInvestorPosition } from './entity/position'
import { ADDRESS_ZERO } from './utils/address'
import { sqrtPriceX96ToPriceInToken1, tickToPrice } from './utils/uniswap'
import { getVaultPrices } from './mapping/price'

export function handleVaultDeposit(event: DepositEvent): void {
  updateUserPosition(event, event.params.user, true)
}

export function handleVaultWithdraw(event: WithdrawEvent): void {
  updateUserPosition(event, event.params.user, false)
}
// export function handleTransfer(event: Transfer): void {
// let sharesDelta = event.params.value
// let underlyingDelta0 = BigInt.fromI32(0)
// let underlyingDelta1 = BigInt.fromI32(0)
//
// TODO: this will fetch accounts and vaults twice
// updateUserPosition(event, event.params.to, sharesDelta, underlyingDelta0, underlyingDelta1)
// updateUserPosition(event, event.params.from, sharesDelta.neg(), underlyingDelta0.neg(), underlyingDelta1.neg())
// }

function updateUserPosition(event: ethereum.Event, investorAddress: Address, isDeposit: boolean): void {
  let vault = getBeefyCLVault(event.address)
  if (!isVaultRunning(vault)) {
    log.error('updateUserPosition: vault {} not active at block {}: {}', [
      vault.id.toHexString(),
      event.block.number.toString(),
      vault.lifecycle,
    ])
    return
  }

  log.debug('updateUserPosition: processing {} for vault {}', [
    isDeposit ? 'deposit' : 'withdraw',
    vault.id.toHexString(),
  ])

  const periods = SNAPSHOT_PERIODS
  const sharesToken = getToken(vault.sharesToken)
  const token0 = getToken(vault.underlyingToken0)
  const token1 = getToken(vault.underlyingToken1)

  let tx = getTransaction(event.block, event.transaction, event.receipt)
  tx.save()

  let investor = getInvestor(investorAddress)
  const newInvestor = isNewInvestor(investor)

  ///////
  // fetch data on chain
  // TODO: use multicall3 to fetch all data in one call
  log.debug('updateUserPosition: fetching data for vault {}', [vault.id.toHexString()])
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

  // get the new investor deposit value
  const investorBalanceRes = vaultContract.try_balanceOf(investorAddress)
  if (investorBalanceRes.reverted) {
    log.error('updateUserPosition: balanceOf() reverted for vault {}', [vault.id.toHexString()])
    throw Error('updateUserPosition: balanceOf() reverted')
  }
  const investorShareTokenBalanceRaw = investorBalanceRes.value
  const investorShareTokenBalance = tokenAmountToDecimal(investorShareTokenBalanceRaw, sharesToken.decimals)

  // get the current user balances by simulating a withdraw
  let previewWithdraw0Raw = BigInt.fromI32(0)
  let previewWithdraw1Raw = BigInt.fromI32(0)
  if (investorShareTokenBalanceRaw.gt(ZERO_BI)) {
    const previewWithdrawRes = vaultContract.try_previewWithdraw(investorShareTokenBalanceRaw)
    if (previewWithdrawRes.reverted) {
      log.error('updateUserPosition: previewWithdraw() reverted for vault {}', [vault.id.toHexString()])
      throw Error('updateUserPosition: previewWithdraw() reverted')
    }
    previewWithdraw0Raw = previewWithdrawRes.value.value0
    previewWithdraw1Raw = previewWithdrawRes.value.value1
  }
  let investorBalanceUnderlying0 = tokenAmountToDecimal(previewWithdraw0Raw, token0.decimals)
  let investorBalanceUnderlying1 = tokenAmountToDecimal(previewWithdraw1Raw, token1.decimals)

  const prices = getVaultPrices(vault, token0, token1)
  const token0PriceInNative = prices.token0ToNative
  const token1PriceInNative = prices.token1ToNative
  const nativePriceUSD = prices.nativeToUsd

  ///////
  // compute derived values
  log.debug('updateUserPosition: computing derived values for vault {}', [vault.id.toHexString()])
  const txGasFeeUSD = tx.gasFee.times(nativePriceUSD)
  const token0PriceInUSD = token0PriceInNative.times(nativePriceUSD)
  const token1PriceInUSD = token1PriceInNative.times(nativePriceUSD)

  ///////
  // update investor positions
  log.debug('updateUserPosition: updating investor position of investor {} for vault {}', [
    investor.id.toHexString(),
    vault.id.toHexString(),
  ])
  const position = getInvestorPosition(vault, investor)
  const isNewPosition = isNewInvestorPosition(position)
  const isClosingPosition = isDeposit ? false : investorShareTokenBalance.equals(ZERO_BD)
  if (ADDRESS_ZERO.equals(position.createdWith)) {
    position.createdWith = tx.id
  }
  if (isNewPosition) {
    position.positionOpenAtTimestamp = event.block.timestamp
  }
  if (isClosingPosition) {
    position.closedPositionDuration = position.closedPositionDuration.plus(
      event.block.timestamp.minus(position.positionOpenAtTimestamp),
    )
    position.positionOpenAtTimestamp = ZERO_BI
  }

  position.sharesBalance = investorShareTokenBalance
  const previousPositionValueUSD = position.positionValueUSD
  position.underlyingBalance0 = investorBalanceUnderlying0
  position.underlyingBalance1 = investorBalanceUnderlying1
  position.underlyingBalance0USD = position.underlyingBalance0.times(token0PriceInUSD)
  position.underlyingBalance1USD = position.underlyingBalance1.times(token1PriceInUSD)
  position.positionValueUSD = position.underlyingBalance0USD.plus(position.underlyingBalance1USD)
  const positionChangeUSD = position.positionValueUSD.minus(previousPositionValueUSD)
  position.save()
  for (let i = 0; i < periods.length; i++) {
    log.debug('updateUserPosition: updating investor position snapshot of investor {} for vault {} and period {}', [
      investor.id.toHexString(),
      vault.id.toHexString(),
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

  ///////
  // update vault entities
  log.debug('updateUserPosition: updating vault entities for vault {}', [vault.id.toHexString()])
  vault.currentPriceOfToken0InToken1 = currentPriceInToken1
  vault.priceRangeMin1 = rangeMinToken1Price
  vault.priceRangeMax1 = rangeMaxToken1Price
  vault.priceRangeMin1USD = vault.priceRangeMin1.times(token1PriceInUSD)
  vault.priceRangeMax1USD = vault.priceRangeMax1.times(token1PriceInUSD)
  vault.underlyingAmount0 = vaultBalanceUnderlying0
  vault.underlyingAmount1 = vaultBalanceUnderlying1
  vault.underlyingAmount0USD = vault.underlyingAmount0.times(token0PriceInUSD)
  vault.underlyingAmount1USD = vault.underlyingAmount1.times(token1PriceInUSD)
  vault.totalValueLockedUSD = vault.underlyingAmount0USD.plus(positionChangeUSD)
  if (isDeposit) {
    vault.totalDepositCount += 1
  } else {
    vault.totalWithdrawCount += 1
  }
  vault.save()
  for (let i = 0; i < periods.length; i++) {
    log.debug('updateUserPosition: updating vault snapshot for vault {} and period {}', [
      vault.id.toHexString(),
      periods[i].toString(),
    ])
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
    if (isDeposit) {
      vaultSnapshot.depositCount += 1
    } else {
      vaultSnapshot.withdrawCount += 1
    }
    vaultSnapshot.save()
  }

  ///////
  // update protocol entities
  log.debug('updateUserPosition: updating protocol entities for vault {}', [vault.id.toHexString()])
  const protocol = getBeefyCLProtocol()
  protocol.cumulativeTransactionCount += 1
  protocol.cumulativeInvestorInteractionsCount += 1
  protocol.totalValueLockedUSD = protocol.totalValueLockedUSD.plus(positionChangeUSD)
  if (isNewPosition) {
    protocol.activeInvestorCount += 1
  }
  protocol.save()
  for (let i = 0; i < periods.length; i++) {
    log.debug('updateUserPosition: updating protocol snapshot for vault {} and period {}', [
      vault.id.toHexString(),
      periods[i].toString(),
    ])
    const protocolSnapshot = getBeefyCLProtocolSnapshot(event.block.timestamp, periods[i])
    protocolSnapshot.totalValueLockedUSD = protocolSnapshot.totalValueLockedUSD.plus(positionChangeUSD)
    if (newInvestor) {
      protocolSnapshot.newInvestorCount += 1
    }
    if (isNewPosition) {
      protocolSnapshot.activeInvestorCount += 1
    }
    protocolSnapshot.transactionCount += 1
    protocolSnapshot.investorInteractionsCount += 1
    protocolSnapshot.totalGasSpent = protocolSnapshot.totalGasSpent.plus(tx.gasFee)
    protocolSnapshot.totalGasSpentUSD = protocolSnapshot.totalGasSpentUSD.plus(txGasFeeUSD)
    protocolSnapshot.investorGasSpent = protocolSnapshot.investorGasSpent.plus(tx.gasFee)
    protocolSnapshot.investorGasSpentUSD = protocolSnapshot.investorGasSpentUSD.plus(txGasFeeUSD)
    protocolSnapshot.save()
  }

  ///////
  // update investor entities
  log.debug('updateUserPosition: updating investor entities for investor {}', [investor.id.toHexString()])
  if (isNewPosition) {
    investor.activePositionCount += 1
  }
  if (isClosingPosition) {
    investor.activePositionCount -= 1
  }
  const isEnteringTheProtocol = newInvestor || (isNewPosition && investor.activePositionCount === 1)
  if (isEnteringTheProtocol) {
    investor.currentInvestmentOpenAtTimestamp = event.block.timestamp
  }
  const isExitingTheProtocol = investor.activePositionCount > 0
  if (!isExitingTheProtocol) {
    investor.closedInvestmentDuration = investor.closedInvestmentDuration.plus(
      event.block.timestamp.minus(investor.currentInvestmentOpenAtTimestamp),
    )
    investor.currentInvestmentOpenAtTimestamp = ZERO_BI
  }
  investor.totalPositionValueUSD = investor.totalPositionValueUSD.plus(positionChangeUSD)
  investor.cumulativeInteractionsCount += 1
  if (isDeposit) {
    investor.cumulativeDepositCount += 1
  } else {
    investor.cumulativeWithdrawCount += 1
  }
  investor.save()
  for (let i = 0; i < periods.length; i++) {
    log.debug('updateUserPosition: updating investor snapshot for investor {} and period {}', [
      investor.id.toHexString(),
      periods[i].toString(),
    ])
    const investorSnapshot = getInvestorSnapshot(investor, event.block.timestamp, periods[i])
    investorSnapshot.totalPositionValueUSD = investor.totalPositionValueUSD
    investorSnapshot.interactionsCount += 1
    if (isDeposit) {
      investorSnapshot.depositCount += 1
    } else {
      investorSnapshot.withdrawCount += 1
    }
    investorSnapshot.save()
  }
}
