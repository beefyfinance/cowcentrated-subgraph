import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { BeefyVaultConcLiqStrategy, UserPosition, UserPositionChanged } from '../generated/schema'
import {
  BeefyVaultConcLiq as BeefyVaultConcLiqContract,
  Deposit,
  Initialized,
  OwnershipTransferred,
  Transfer,
  Withdraw,
} from '../generated/templates/BeefyVaultConcLiq/BeefyVaultConcLiq'
import {
  getExistingVault,
  getOrCreateAccount,
  getOrCreateToken,
  getEventIdentifier,
  getOrCreateTransaction,
} from './common'

import { BeefyVaultConcLiqStrategy as BeefyVaultConcLiqStrategyTemplate } from '../generated/templates'

export function handleInitialized(event: Initialized): void {
  // TODO: add a view function to get all these values in one call

  let vault = getExistingVault(event.address)
  let vaultContract = BeefyVaultConcLiqContract.bind(event.address)
  let strategyAddress = vaultContract.strategy()
  let strategy = BeefyVaultConcLiqStrategy.load(strategyAddress)
  if (strategy == null) {
    strategy = new BeefyVaultConcLiqStrategy(strategyAddress)
    strategy.vault = vault.id
    strategy.save()
  }
  // start indexing the strategy  let strategyId = strategyAddress
  BeefyVaultConcLiqStrategyTemplate.create(strategyAddress)

  let sharesToken = getOrCreateToken(event.address)
  let wants = vaultContract.wants()
  let token0Address = wants.value0
  let token0 = getOrCreateToken(token0Address)
  let token1Address = wants.value0
  let token1 = getOrCreateToken(token1Address)

  vault.sharesToken = sharesToken.id
  vault.underlyingToken0 = token0.id
  vault.underlyingToken1 = token1.id
  vault.underlyingAmount0 = BigInt.fromI32(0)
  vault.underlyingAmount1 = BigInt.fromI32(0)
  vault.save()
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  let vault = getExistingVault(event.address)
  let owner = getOrCreateAccount(event.params.newOwner)
  vault.owner = owner.id
  vault.save()
}

export function handleDeposit(event: Deposit): void {
  updateUserPosition(event, event.params.user, event.params.shares, event.params.amount0, event.params.amount1)
}

export function handleWithdraw(event: Withdraw): void {
  updateUserPosition(
    event,
    event.params.user,
    event.params.shares.neg(),
    event.params.amount0.neg(),
    event.params.amount1.neg(),
  )
}
export function handleTransfer(event: Transfer): void {
  let sharesDelta = event.params.value
  let underlyingDelta0 = BigInt.fromI32(0)
  let underlyingDelta1 = BigInt.fromI32(0)

  // TODO: this will fetch accounts and vaults twice
  //updateUserPosition(event, event.params.to, sharesDelta, underlyingDelta0, underlyingDelta1)
  //updateUserPosition(event, event.params.from, sharesDelta.neg(), underlyingDelta0.neg(), underlyingDelta1.neg())
}

function updateUserPosition(
  event: ethereum.Event,
  userAddress: Address,
  sharesDelta: BigInt,
  underlyingDelta0: BigInt,
  underlyingDelta1: BigInt,
): void {
  let vault = getExistingVault(event.address)
  let user = getOrCreateAccount(userAddress)
  let tx = getOrCreateTransaction(event.block, event.transaction)

  // fetch needed values
  // TODO: use a view function to get these values in one call
  let vaultContract = BeefyVaultConcLiqContract.bind(event.address)
  let sharesBalance = vaultContract.balanceOf(userAddress)
  let tokenShares = vaultContract.getTokensPerShare(sharesBalance)

  // update vault stats
  let currentUnderlyingAmount0 = vault.underlyingAmount0
  if (currentUnderlyingAmount0 === null) throw Error('Vault not initialized')
  vault.underlyingAmount0 = currentUnderlyingAmount0.plus(underlyingDelta0)
  let currentUnderlyingAmount1 = vault.underlyingAmount1
  if (currentUnderlyingAmount1 === null) throw Error('Vault not initialized')
  vault.underlyingAmount1 = currentUnderlyingAmount1.plus(underlyingDelta1)
  vault.save()
  let sharesToken = getOrCreateToken(vault.id)
  sharesToken.totalSupply = sharesToken.totalSupply.plus(sharesDelta)
  sharesToken.save()

  // init user position
  let id = vault.id.concat(user.id)
  let userPosition = UserPosition.load(id)
  if (userPosition == null) {
    userPosition = new UserPosition(id)
    userPosition.vault = vault.id
    userPosition.user = user.id
    userPosition.createdWith = tx.id
    userPosition.sharesBalance = BigInt.fromI32(0)
    userPosition.underlyingBalance0 = BigInt.fromI32(0)
    userPosition.underlyingBalance1 = BigInt.fromI32(0)
  }
  userPosition.sharesBalance = sharesBalance
  userPosition.underlyingBalance0 = tokenShares.value0
  userPosition.underlyingBalance1 = tokenShares.value1
  userPosition.save()

  // create a new change
  let changedEvent = new UserPositionChanged(getEventIdentifier(event))
  changedEvent.vault = vault.id
  changedEvent.userPosition = userPosition.id
  changedEvent.createdWith = tx.id
  changedEvent.sharesDelta = sharesDelta
  changedEvent.underlyingDelta0 = underlyingDelta0
  changedEvent.underlyingDelta1 = underlyingDelta1
  changedEvent.sharesBalance = sharesBalance
  changedEvent.underlyingBalance0 = tokenShares.value0
  changedEvent.underlyingBalance1 = tokenShares.value1
  changedEvent.save()
}
