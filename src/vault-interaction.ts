import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts"
import {
  Deposit as DepositEvent,
  Withdraw as WithdrawEvent,
  Transfer as TransferEvent,
} from "../generated/templates/BeefyCLVault/BeefyVaultConcLiq"
import { getBeefyCLStrategy, getBeefyCLVault, getBeefyCLVaultSnapshot, isVaultRunning } from "./entity/vault"
import { getTransaction } from "./entity/transaction"
import { getBeefyCLProtocol, getBeefyCLProtocolSnapshot } from "./entity/protocol"
import { getInvestor, getInvestorSnapshot, isNewInvestor } from "./entity/investor"
import { ONE_BD, ZERO_BD, ZERO_BI, bigDecMax, tokenAmountToDecimal } from "./utils/decimal"
import { BeefyVaultConcLiq as BeefyCLVaultContract } from "../generated/templates/BeefyCLVault/BeefyVaultConcLiq"
import { INVESTOR_SNAPSHOT_PERIODS, PROTOCOL_SNAPSHOT_PERIODS, VAULT_SNAPSHOT_PERIODS } from "./utils/time"
import { getToken } from "./entity/token"
import { getInvestorPosition, getInvestorPositionSnapshot, isNewInvestorPosition } from "./entity/position"
import { ADDRESS_ZERO } from "./utils/address"
import { fetchVaultLatestData } from "./utils/price"
import { InvestorPositionInteraction } from "../generated/schema"
import { getEventIdentifier } from "./utils/event"
import { SHARE_TOKEN_MINT_ADDRESS } from "./config"
import { isBoostAddress } from "./entity/boost"
import { DailyAvgCalc, DailyAvgState } from "./utils/daily-avg"

export function handleVaultDeposit(event: DepositEvent): void {
  updateUserPosition(event, event.params.user, true, false)
}
export function handleVaultWithdraw(event: WithdrawEvent): void {
  updateUserPosition(event, event.params.user, false, false)
}
export function handleVaultTransfer(event: TransferEvent): void {
  // sending to self
  if (event.params.from.equals(event.params.to)) {
    return
  }

  // transfering nothing
  if (event.params.value.equals(ZERO_BI)) {
    return
  }

  // don't duplicate processing between Transfer and Deposit/Withdraw
  if (event.params.from.equals(SHARE_TOKEN_MINT_ADDRESS) || event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS)) {
    return
  }

  // ignore transfers from/to boosts
  if (isBoostAddress(event.params.from)) {
    return
  }
  if (isBoostAddress(event.params.to)) {
    return
  }

  updateUserPosition(event, event.params.to, true, true)
  updateUserPosition(event, event.params.from, false, true)
}

function updateUserPosition(
  event: ethereum.Event,
  investorAddress: Address,
  isDeposit: boolean,
  isTransfer: boolean,
): void {
  let vault = getBeefyCLVault(event.address)
  if (!isVaultRunning(vault)) {
    return
  }

  const strategy = getBeefyCLStrategy(vault.strategy)
  const sharesToken = getToken(vault.sharesToken)
  const token0 = getToken(vault.underlyingToken0)
  const token1 = getToken(vault.underlyingToken1)
  const earnedToken = getToken(vault.earnedToken)

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain
  // TODO: use multicall3 to fetch all data in one call
  const vaultContract = BeefyCLVaultContract.bind(Address.fromBytes(vault.id))
  const vaultData = fetchVaultLatestData(vault, strategy, sharesToken, token0, token1, earnedToken)
  const currentPriceInToken1 = vaultData.currentPriceInToken1
  const rangeMinToken1Price = vaultData.rangeMinToken1Price
  const rangeMaxToken1Price = vaultData.rangeMaxToken1Price
  const vaultBalanceUnderlying0 = vaultData.token0Balance
  const vaultBalanceUnderlying1 = vaultData.token1Balance
  const token0PriceInNative = vaultData.token0ToNative
  const token1PriceInNative = vaultData.token1ToNative
  const nativePriceUSD = vaultData.nativeToUsd

  // get the new investor deposit value, this shouldn't be necessary but
  // avoids any potential issues with people gifting to the vault
  const investorShareTokenBalanceRaw = vaultContract.balanceOf(investorAddress)
  const investorShareTokenBalance = tokenAmountToDecimal(investorShareTokenBalanceRaw, sharesToken.decimals)

  ///////
  // compute derived values
  const investorBalanceUnderlying0 = investorShareTokenBalance.times(vaultData.shareTokenToUnderlying0Rate)
  const investorBalanceUnderlying1 = investorShareTokenBalance.times(vaultData.shareTokenToUnderlying1Rate)
  const token0PriceInUSD = token0PriceInNative.times(nativePriceUSD)
  const token1PriceInUSD = token1PriceInNative.times(nativePriceUSD)

  const investor = getInvestor(investorAddress)
  const position = getInvestorPosition(vault, investor)
  const newInvestor = isNewInvestor(investor)
  const isNewPosition = isNewInvestorPosition(position)
  const isClosingPosition = investorShareTokenBalance.equals(ZERO_BD)
  const isEnteringTheProtocol = newInvestor || (isNewPosition && investor.activePositionCount === 1)
  const isExitingTheProtocol = investor.activePositionCount > 0
  const previousInteractionAt = investor.lastInteractionAt

  ///////
  // update investor positions
  const previousSharesBalance = position.sharesBalance
  const previousUnderlyingBalance0 = position.underlyingBalance0
  const previousUnderlyingBalance1 = position.underlyingBalance1
  const previousUnderlyingBalance0USD = position.underlyingBalance0USD
  const previousUnderlyingBalance1USD = position.underlyingBalance1USD
  const previousPositionValueUSD = position.positionValueUSD
  if (ADDRESS_ZERO.equals(position.createdWith)) position.createdWith = tx.id
  if (isNewPosition) position.positionOpenAtTimestamp = event.block.timestamp
  if (isClosingPosition) {
    position.closedPositionDuration = position.closedPositionDuration.plus(
      event.block.timestamp.minus(position.positionOpenAtTimestamp),
    )
    position.positionOpenAtTimestamp = ZERO_BI
  }
  position.sharesBalance = investorShareTokenBalance
  position.underlyingBalance0 = investorBalanceUnderlying0
  position.underlyingBalance1 = investorBalanceUnderlying1
  position.underlyingBalance0USD = position.underlyingBalance0.times(token0PriceInUSD)
  position.underlyingBalance1USD = position.underlyingBalance1.times(token1PriceInUSD)
  position.positionValueUSD = position.underlyingBalance0USD.plus(position.underlyingBalance1USD)
  const sharesBalanceDelta = position.sharesBalance.minus(previousSharesBalance)
  const underlyingBalance0Delta = position.underlyingBalance0.minus(previousUnderlyingBalance0)
  const underlyingBalance1Delta = position.underlyingBalance1.minus(previousUnderlyingBalance1)
  const underlyingBalance0DeltaUSD = position.underlyingBalance0USD.minus(previousUnderlyingBalance0USD)
  const underlyingBalance1DeltaUSD = position.underlyingBalance1USD.minus(previousUnderlyingBalance1USD)
  const positionValueUSDDelta = position.positionValueUSD.minus(previousPositionValueUSD)
  if (isNewPosition) {
    position.initialUnderlyingBalance0 = position.underlyingBalance0
    position.initialUnderlyingBalance1 = position.underlyingBalance1
    position.initialUnderlyingBalance0USD = position.underlyingBalance0USD
    position.initialUnderlyingBalance1USD = position.underlyingBalance1USD
    position.initialPositionValueUSD = position.positionValueUSD
  } else {
    // update initial values using the deltas
    position.initialUnderlyingBalance0 = position.initialUnderlyingBalance0.plus(underlyingBalance0Delta)
    position.initialUnderlyingBalance1 = position.initialUnderlyingBalance1.plus(underlyingBalance1Delta)
    position.initialUnderlyingBalance0USD = position.initialUnderlyingBalance0.times(token0PriceInUSD)
    position.initialUnderlyingBalance1USD = position.initialUnderlyingBalance1.times(token1PriceInUSD)
    position.initialPositionValueUSD = position.initialUnderlyingBalance0USD.plus(position.initialUnderlyingBalance1USD)
  }
  let dailyAvgState = DailyAvgState.deserialize(position.averageDailyPositionValueUSDState)
  dailyAvgState.setPendingValue(position.positionValueUSD, event.block.timestamp)
  position.averageDailyPositionValueUSD30D = DailyAvgCalc.avg(BigInt.fromI32(30), dailyAvgState)
  position.averageDailyPositionValueUSDState = DailyAvgCalc.evictOldEntries(
    BigInt.fromU32(30),
    dailyAvgState,
  ).serialize()
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
  let positionInteraction = new InvestorPositionInteraction(getEventIdentifier(event))
  positionInteraction.vault = vault.id
  positionInteraction.investor = investor.id
  positionInteraction.investorPosition = position.id
  positionInteraction.createdWith = tx.id
  positionInteraction.timestamp = event.block.timestamp
  if (isTransfer) positionInteraction.type = "TRANSFER"
  if (!isTransfer && isDeposit) positionInteraction.type = "DEPOSIT"
  if (!isTransfer && !isDeposit) positionInteraction.type = "WITHDRAW"
  positionInteraction.sharesBalance = position.sharesBalance
  positionInteraction.underlyingBalance0 = position.underlyingBalance0
  positionInteraction.underlyingBalance1 = position.underlyingBalance1
  positionInteraction.underlyingBalance0USD = position.underlyingBalance0USD
  positionInteraction.underlyingBalance1USD = position.underlyingBalance1USD
  positionInteraction.positionValueUSD = position.positionValueUSD
  positionInteraction.sharesBalanceDelta = sharesBalanceDelta
  positionInteraction.underlyingBalance0Delta = underlyingBalance0Delta
  positionInteraction.underlyingBalance1Delta = underlyingBalance1Delta
  positionInteraction.underlyingBalance0DeltaUSD = underlyingBalance0DeltaUSD
  positionInteraction.underlyingBalance1DeltaUSD = underlyingBalance1DeltaUSD
  positionInteraction.positionValueUSDDelta = positionValueUSDDelta
  positionInteraction.save()

  ///////
  // update investor entities
  if (isNewPosition) investor.activePositionCount += 1
  if (isClosingPosition) investor.activePositionCount -= 1
  if (isEnteringTheProtocol) investor.currentInvestmentOpenAtTimestamp = event.block.timestamp
  if (!isExitingTheProtocol) {
    investor.closedInvestmentDuration = investor.closedInvestmentDuration.plus(
      event.block.timestamp.minus(investor.currentInvestmentOpenAtTimestamp),
    )
    investor.currentInvestmentOpenAtTimestamp = ZERO_BI
  }
  investor.lastInteractionAt = event.block.timestamp
  investor.totalPositionValueUSD = investor.totalPositionValueUSD.plus(positionValueUSDDelta)
  investor.cumulativeInteractionsCount += 1
  if (!isTransfer && isDeposit) investor.cumulativeDepositCount += 1
  if (!isTransfer && !isDeposit) investor.cumulativeWithdrawCount += 1
  dailyAvgState = DailyAvgState.deserialize(investor.averageDailyTotalPositionValueUSDState)
  dailyAvgState.setPendingValue(investor.totalPositionValueUSD, event.block.timestamp)
  investor.averageDailyTotalPositionValueUSD30D = DailyAvgCalc.avg(BigInt.fromI32(30), dailyAvgState)
  investor.averageDailyTotalPositionValueUSDState = DailyAvgCalc.evictOldEntries(
    BigInt.fromU32(30),
    dailyAvgState,
  ).serialize()
  investor.save()
  for (let i = 0; i < INVESTOR_SNAPSHOT_PERIODS.length; i++) {
    const period = INVESTOR_SNAPSHOT_PERIODS[i]
    const investorSnapshot = getInvestorSnapshot(investor, event.block.timestamp, period)
    investorSnapshot.totalPositionValueUSD = investor.totalPositionValueUSD
    investorSnapshot.interactionsCount += 1
    if (!isTransfer && isDeposit) investorSnapshot.depositCount += 1
    if (!isTransfer && !isDeposit) investorSnapshot.withdrawCount += 1
    investorSnapshot.save()
  }

  ///////
  // update vault entities
  if (isNewPosition) vault.activeInvestorCount += 1
  if (isClosingPosition) vault.activeInvestorCount -= 1
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
  // due to price changes, the total value locked in USD plus a big % negative change in the position value
  // can be negative, so we take the max with 0. This is OK as our clock will reset it to the right value
  // on the next tick anyway.
  vault.totalValueLockedUSD = bigDecMax(ZERO_BD, vault.underlyingAmount0USD.plus(positionValueUSDDelta))
  if (!isTransfer && isDeposit) vault.cumulativeDepositCount += 1
  if (!isTransfer && !isDeposit) vault.cumulativeWithdrawCount += 1
  vault.save()
  for (let i = 0; i < VAULT_SNAPSHOT_PERIODS.length; i++) {
    const period = VAULT_SNAPSHOT_PERIODS[i]
    const vaultSnapshot = getBeefyCLVaultSnapshot(vault, event.block.timestamp, period)
    vaultSnapshot.activeInvestorCount = vault.activeInvestorCount
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
    if (!isTransfer && isDeposit) vaultSnapshot.depositCount += 1
    if (!isTransfer && !isDeposit) vaultSnapshot.withdrawCount += 1
    vaultSnapshot.save()
  }

  ///////
  // update protocol entities
  const protocol = getBeefyCLProtocol()
  if (!isTransfer || isDeposit) protocol.cumulativeTransactionCount += 1
  if (!isTransfer || isDeposit) protocol.cumulativeInvestorInteractionsCount += 1
  protocol.totalValueLockedUSD = protocol.totalValueLockedUSD.plus(positionValueUSDDelta)
  if (isEnteringTheProtocol) protocol.activeInvestorCount += 1
  else if (isExitingTheProtocol) protocol.activeInvestorCount -= 1
  protocol.save()
  for (let i = 0; i < PROTOCOL_SNAPSHOT_PERIODS.length; i++) {
    const period = PROTOCOL_SNAPSHOT_PERIODS[i]
    const protocolSnapshot = getBeefyCLProtocolSnapshot(event.block.timestamp, period)
    protocolSnapshot.totalValueLockedUSD = protocol.totalValueLockedUSD
    if (isEnteringTheProtocol) protocolSnapshot.newInvestorCount += 1
    if (previousInteractionAt.lt(protocolSnapshot.roundedTimestamp)) protocolSnapshot.uniqueActiveInvestorCount += 1
    if (!isTransfer || isDeposit) protocolSnapshot.transactionCount += 1
    if (!isTransfer || isDeposit) protocolSnapshot.investorInteractionsCount += 1
    protocolSnapshot.save()
  }
}
