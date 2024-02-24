import { Address, BigDecimal, BigInt, ethereum, log } from '@graphprotocol/graph-ts'
import {
  Deposit as DepositEvent,
  Withdraw as WithdrawEvent,
} from '../../generated/templates/BeefyCLVault/BeefyVaultConcLiq'
import { getBeefyCLStrategy, getBeefyCLVault, getBeefyCLVaultSnapshot, isVaultRunning } from '../entity/vault'
import { getTransaction } from '../entity/transaction'
import { getBeefyCLProtocol, getBeefyCLProtocolSnapshot } from '../entity/protocol'
import { getInvestor, getInvestorSnapshot } from '../entity/investor'
import { ZERO_BD, ZERO_BI, tokenAmountToDecimal } from '../utils/decimal'
import { BeefyVaultConcLiq as BeefyCLVaultContract } from '../../generated/templates/BeefyCLVault/BeefyVaultConcLiq'
import { StrategyPassiveManagerUniswap as BeefyCLStrategyContract } from '../../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap'
import { PERIODS } from '../utils/time'
import { getToken } from '../entity/token'
import { getInvestorPosition, getInvestorPositionSnapshot } from '../entity/position'
import { ADDRESS_ZERO } from '../utils/address'

export { handleVaultInitialized as handleInitialized } from '../vault-lifecycle'
export { handleVaultOwnershipTransferred as handleOwnershipTransferred } from '../ownership'

export function handleDeposit(event: DepositEvent): void {
  updateUserPosition(event, event.params.user, event.params.shares, event.params.amount0, event.params.amount1)
}

export function handleWithdraw(event: WithdrawEvent): void {
  updateUserPosition(
    event,
    event.params.user,
    event.params.shares.neg(),
    event.params.amount0.neg(),
    event.params.amount1.neg(),
  )
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

function updateUserPosition(
  event: ethereum.Event,
  investorAddress: Address,
  sharesDeltaRaw: BigInt,
  underlyingDelta0Raw: BigInt,
  underlyingDelta1Raw: BigInt,
): void {
  const periods = PERIODS
  let vault = getBeefyCLVault(event.address)
  if (isVaultRunning(vault)) {
    log.error('updateUserPosition: vault {} not active at block {}: {}', [
      vault.id.toHexString(),
      event.block.number.toString(),
      vault.lifecycle,
    ])
    return
  }

  const sharesToken = getToken(vault.sharesToken)
  const token0 = getToken(vault.underlyingToken0)
  const token1 = getToken(vault.underlyingToken1)

  let tx = getTransaction(event.block, event.transaction, event.receipt)
  tx.save()

  let investor = getInvestor(investorAddress)

  ///////
  // fetch data on chain
  // TODO: use multicall3 to fetch all data in one call
  const vaultContract = BeefyCLVaultContract.bind(Address.fromBytes(vault.id))
  const strategyContract = BeefyCLStrategyContract.bind(Address.fromBytes(vault.strategy))
  // const rangeRes = strategyContract.try_range() TODO: use this when new strats are deployed
  const rangeRes = strategyContract.try_positionMain()
  if (rangeRes.reverted) {
    log.error('updateUserPosition: range() reverted for strategy {}', [vault.strategy.toHexString()])
    throw Error('updateUserPosition: range() reverted')
  }
  const rangeRaw = rangeRes.value

  const balancesRes = strategyContract.try_balances()
  if (balancesRes.reverted) {
    log.error('updateUserPosition: balances() reverted for strategy {}', [vault.strategy.toHexString()])
    throw Error('updateUserPosition: balances() reverted')
  }
  const balancesRaw = balancesRes.value

  ///////
  // compute derived values
  const sharesDelta = tokenAmountToDecimal(sharesDeltaRaw, sharesToken.decimals)
  const underlyingDelta0 = tokenAmountToDecimal(underlyingDelta0Raw, token0.decimals)
  const underlyingDelta1 = tokenAmountToDecimal(underlyingDelta1Raw, token1.decimals)
  const isNewInvestor = investor.lastInteractionTimestamp.equals(ZERO_BI)
  const isDeposit = sharesDelta.gt(ZERO_BD)
  const token0PriceInNative = ZERO_BD // TODO
  const token1PriceInNative = ZERO_BD // TODO
  const nativePriceUSD = ZERO_BD // TODO
  const investmentValueUSD = ZERO_BD // TODO
  const txGasFeeUSD = tx.gasFee.times(nativePriceUSD)
  const token0PriceInUSD = token0PriceInNative.times(nativePriceUSD)
  const token1PriceInUSD = token1PriceInNative.times(nativePriceUSD)

  ///////
  // update vault entities
  const rangeMinDec = tokenAmountToDecimal(BigInt.fromI32(rangeRaw.value0), token1.decimals)
  const rangeMaxDec = tokenAmountToDecimal(BigInt.fromI32(rangeRaw.value1), token1.decimals)
  const balance0Dec = tokenAmountToDecimal(balancesRaw.value0, token0.decimals)
  const balance1Dec = tokenAmountToDecimal(balancesRaw.value1, token1.decimals)
  vault.priceRangeMin1 = rangeMinDec
  vault.priceRangeMax1 = rangeMaxDec
  vault.priceRangeMin1USD = rangeMinDec.times(token1PriceInUSD)
  vault.priceRangeMax1USD = rangeMaxDec.times(token1PriceInUSD)
  vault.underlyingAmount0 = balance0Dec
  vault.underlyingAmount1 = balance1Dec
  vault.underlyingAmount0USD = balance0Dec.times(token0PriceInUSD)
  vault.underlyingAmount1USD = balance1Dec.times(token1PriceInUSD)
  vault.totalValueLockedUSD = vault.underlyingAmount0USD.plus(investmentValueUSD)
  if (isDeposit) {
    vault.totalDepositCount += 1
  } else {
    vault.totalWithdrawCount += 1
  }
  vault.save()
  for (let i = 0; i < periods.length; i++) {
    const vaultSnapshot = getBeefyCLVaultSnapshot(vault, event.block.timestamp, periods[i])
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
  const protocol = getBeefyCLProtocol()
  protocol.transactionCount += 1
  protocol.totalValueLockedUSD = protocol.totalValueLockedUSD.plus(investmentValueUSD)
  if (isNewInvestor) {
    protocol.activeInvestorCount += 1
  }
  protocol.save()
  for (let i = 0; i < periods.length; i++) {
    const protocolSnapshot = getBeefyCLProtocolSnapshot(event.block.timestamp, periods[i])
    protocolSnapshot.totalValueLockedUSD = protocolSnapshot.totalValueLockedUSD.plus(investmentValueUSD)
    if (isNewInvestor) {
      protocolSnapshot.newInvestorCount += 1
    }
    if (investor.lastInteractionTimestamp.lt(protocolSnapshot.roundedTimestamp)) {
      protocolSnapshot.activeInvestorCount += 1
    }
    protocolSnapshot.totalTransactionCount += 1
    protocolSnapshot.investorTransactionsCount += 1
    protocolSnapshot.totalGasSpent = protocolSnapshot.totalGasSpent.plus(tx.gasFee)
    protocolSnapshot.totalGasSpentUSD = protocolSnapshot.totalGasSpentUSD.plus(txGasFeeUSD)
    protocolSnapshot.investorGasSpent = protocolSnapshot.investorGasSpent.plus(tx.gasFee)
    protocolSnapshot.investorGasSpentUSD = protocolSnapshot.investorGasSpentUSD.plus(txGasFeeUSD)
    protocolSnapshot.save()
  }

  ///////
  // update investor positions
  const position = getInvestorPosition(vault, investor)
  const isNewPosition = position.sharesBalance.equals(ZERO_BD)
  let timeSinceLastPositionUpdate = ZERO_BI
  if (!isNewPosition) {
    timeSinceLastPositionUpdate = event.block.timestamp.minus(position.lastUpdated)
  }
  if (position.createdWith.equals(ADDRESS_ZERO)) {
    position.createdWith = tx.id
  }
  if (!position.sharesBalance.equals(ZERO_BD)) {
    position.timeWeightedPositionValueUSD = position.timeWeightedPositionValueUSD.plus(
      position.positionValueUSD.times(BigDecimal.fromString(timeSinceLastPositionUpdate.toString())),
    )
    position.totalActiveTime = position.totalActiveTime.plus(timeSinceLastPositionUpdate)
  }
  position.sharesBalance = position.sharesBalance.plus(sharesDelta)
  position.underlyingBalance0 = position.underlyingBalance0.plus(underlyingDelta0)
  position.underlyingBalance1 = position.underlyingBalance1.plus(underlyingDelta1)
  position.underlyingBalance0USD = position.underlyingBalance0.times(token0PriceInUSD)
  position.underlyingBalance1USD = position.underlyingBalance1.times(token1PriceInUSD)
  position.positionValueUSD = position.underlyingBalance0USD.plus(position.underlyingBalance1USD)
  position.lastUpdated = event.block.timestamp
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

  ///////
  // update investor entities
  investor.lastInteractionTimestamp = event.block.timestamp
  investor.investedDuration = investor.investedDuration.plus(timeSinceLastPositionUpdate)
  const positionChangeUSD = underlyingDelta0.times(token0PriceInUSD).plus(underlyingDelta1.times(token1PriceInUSD))
  investor.totalPositionValueUSD = investor.totalPositionValueUSD.plus(positionChangeUSD)
  investor.timeWeightedPositionValueUSD = investor.timeWeightedPositionValueUSD.plus(
    investor.totalPositionValueUSD.times(BigDecimal.fromString(timeSinceLastPositionUpdate.toString())),
  )
  investor.totalInteractionsCount += 1
  investor.save()
  for (let i = 0; i < periods.length; i++) {
    const investorSnapshot = getInvestorSnapshot(investor, event.block.timestamp, periods[i])
    investorSnapshot.totalPositionValueUSD = investor.totalPositionValueUSD
    investorSnapshot.timeWeightedPositionValueUSD = investor.timeWeightedPositionValueUSD
    investorSnapshot.interactionsCount += 1
    investorSnapshot.save()
  }
}
