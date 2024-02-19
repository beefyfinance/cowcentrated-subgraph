import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'
import { Account, BeefyVaultConcLiq, Token, BeefyVaultConcLiqStrategy, Transaction } from '../generated/schema'
import { IERC20 } from '../generated/templates/BeefyVaultConcLiq/IERC20'

export function getOrCreateAccount(accountAddress: Bytes): Account {
  let accountId = accountAddress
  let account = Account.load(accountId)
  if (account == null) {
    account = new Account(accountId)
    account.createdVaultCount = 0
    account.save()
  }

  return account
}

export function getOrCreateToken(tokenAddress: Bytes): Token {
  let token = Token.load(tokenAddress)
  if (token == null) {
    let tokenContract = IERC20.bind(Address.fromBytes(tokenAddress))
    token = new Token(tokenAddress)

    let nameRes = tokenContract.try_name()
    if (!nameRes.reverted) {
      token.name = nameRes.value
    }

    let symbolRes = tokenContract.try_symbol()
    if (!symbolRes.reverted) {
      token.symbol = symbolRes.value
    }

    // at least ensure that decimals and totalSupply are set
    token.decimals = tokenContract.decimals()
    token.totalSupply = BigInt.fromI32(0)

    token.save()
  }

  return token
}

export function getExistingVault(vaultAddress: Bytes): BeefyVaultConcLiq {
  let vault = BeefyVaultConcLiq.load(vaultAddress)
  if (vault == null) {
    throw Error('Vault not found')
  }

  return vault
}

export function getExistingStrategy(strategyAddress: Bytes): BeefyVaultConcLiqStrategy {
  let strategy = BeefyVaultConcLiqStrategy.load(strategyAddress)
  if (strategy == null) {
    throw Error('Vault not found')
  }

  return strategy
}

export function getEventIdentifier(event: ethereum.Event): Bytes {
  return event.transaction.hash.concat(Bytes.fromI32(event.logIndex.toI32()))
}

export function getOrCreateTransaction(block: ethereum.Block, transaction: ethereum.Transaction): Transaction {
  let transactionId = transaction.hash
  let tx = Transaction.load(transactionId)
  if (tx == null) {
    tx = new Transaction(transactionId)
    tx.blockNumber = block.number
    tx.blockTimestamp = block.timestamp
    tx.sender = getOrCreateAccount(transaction.from).id
    tx.save()
  }

  return tx
}
