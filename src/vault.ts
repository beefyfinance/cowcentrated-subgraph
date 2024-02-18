import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'
import { Account, BeefyVaultConcLiq, UserPosition, UserPositionChanged, Token } from '../generated/schema'
import { BeefyVaultConcLiq as BeefyVaultConcLiqContract } from '../generated/templates/BeefyVaultConcLiq/BeefyVaultConcLiq'
import { IERC20 } from '../generated/templates/BeefyVaultConcLiq/IERC20'
import {
  Deposit,
  Initialized,
  OwnershipTransferred,
  Transfer,
  Withdraw,
} from '../generated/templates/BeefyVaultConcLiq/BeefyVaultConcLiq'

export function handleInitialized(event: Initialized): void {
  // TODO: add a view function to get all these values in one call

  let vault = getExistingVault(event.address)

  let vaultContract = BeefyVaultConcLiqContract.bind(event.address)
  vault.strategy = vaultContract.strategy()

  let sharesToken = getOrCreateToken(event.address)
  sharesToken.save()

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
  let userPosition = getOrCreateUserPosition(vault, user)

  let changedEvent = new UserPositionChanged(event.transaction.hash.concat(Bytes.fromI32(event.logIndex.toI32())))

  changedEvent.vault = vault.id
  changedEvent.userPosition = userPosition.id

  changedEvent.createdWithTransaction = event.transaction.hash
  changedEvent.createdAtTimestamp = event.block.timestamp
  changedEvent.createdAtBlock = event.block.number

  changedEvent.sharesDelta = sharesDelta
  changedEvent.underlyingDelta0 = underlyingDelta0
  changedEvent.underlyingDelta1 = underlyingDelta1

  // TODO: use a view function to get these values in one call
  let vaultContract = BeefyVaultConcLiqContract.bind(event.address)
  let sharesBalance = vaultContract.balanceOf(userAddress)
  let tokenShares = vaultContract.getTokensPerShare(sharesBalance)

  userPosition.sharesBalance = sharesBalance
  userPosition.underlyingBalance0 = tokenShares.value0
  userPosition.underlyingBalance1 = tokenShares.value1

  changedEvent.sharesBalance = sharesBalance
  changedEvent.underlyingBalance0 = tokenShares.value0
  changedEvent.underlyingBalance1 = tokenShares.value1

  userPosition.save()
  changedEvent.save()
}

function getOrCreateUserPosition(vault: BeefyVaultConcLiq, user: Account): UserPosition {
  let id = vault.id.concat(user.id)
  let userPosition = UserPosition.load(id)
  if (userPosition == null) {
    userPosition = new UserPosition(id)
    userPosition.vault = vault.id
    userPosition.user = user.id
    userPosition.sharesBalance = BigInt.fromI32(0)
    userPosition.underlyingBalance0 = BigInt.fromI32(0)
    userPosition.underlyingBalance1 = BigInt.fromI32(0)
  }

  return userPosition
}

function getOrCreateAccount(accountAddress: Address): Account {
  let accountId = accountAddress
  let account = Account.load(accountId)
  if (account == null) {
    account = new Account(accountId)
    account.createdVaultCount = 0
    account.save()
  }

  return account
}

function getOrCreateToken(tokenAddress: Address): Token {
  let token = Token.load(tokenAddress)
  if (token == null) {
    let tokenContract = IERC20.bind(tokenAddress)
    token = new Token(tokenAddress)

    let nameRes = tokenContract.try_name()
    if (!nameRes.reverted) {
      token.name = nameRes.value
    }

    let symbolRes = tokenContract.try_symbol()
    if (!symbolRes.reverted) {
      token.symbol = symbolRes.value
    }

    let decimalsRes = tokenContract.try_decimals()
    if (!decimalsRes.reverted) {
      token.decimals = decimalsRes.value
    } else {
      token.decimals = 18
    }

    let totalSupplyRes = tokenContract.try_totalSupply()
    if (!totalSupplyRes.reverted) {
      token.totalSupply = totalSupplyRes.value
    } else {
      token.totalSupply = BigInt.fromI32(0)
    }

    token.save()
  }

  return token
}

function getExistingVault(vaultAddress: Address): BeefyVaultConcLiq {
  let vaultId = vaultAddress
  let vault = BeefyVaultConcLiq.load(vaultId)
  if (vault == null) {
    throw Error('Vault not found')
  }

  return vault
}
