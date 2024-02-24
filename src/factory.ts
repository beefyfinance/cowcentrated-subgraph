import { ProxyCreated as VaultCreatedEvent } from '../generated/BeefyCLVaultFactory/BeefyVaultConcLiqFactory'
import { ProxyCreated as StrategyCreatedEvent } from '../generated/BeefyCLStrategyFactory/StrategyPassiveManagerUniswapFactory'
import {
  BeefyCLVault as BeefyCLVaultTemplate,
  BeefyCLStrategy as BeefyCLStrategyTemplate,
} from '../generated/templates'
import { getUserAccount } from './entity/user-account'
import { getTransaction } from './entity/transaction'
import { getBeefyCLStrategy, getBeefyCLVault } from './entity/vault'

export function handleVaultCreated(event: VaultCreatedEvent): void {
  const accountAddress = event.transaction.from
  const account = getUserAccount(accountAddress)
  account.lastInteractionTimestamp = event.block.timestamp
  account.interactionsCount = account.interactionsCount + 1
  account.save()

  const tx = getTransaction(event.block, event.transaction, event.receipt, account)
  tx.save()

  const vaultAddress = event.params.proxy
  const vault = getBeefyCLVault(vaultAddress)
  vault.createdWith = tx.id
  vault.save()

  // start indexing the new vault
  BeefyCLVaultTemplate.create(vaultAddress)
}

export function handleStrategyCreated(event: StrategyCreatedEvent): void {
  const accountAddress = event.transaction.from
  const account = getUserAccount(accountAddress)
  account.lastInteractionTimestamp = event.block.timestamp
  account.interactionsCount = account.interactionsCount + 1
  account.save()

  const tx = getTransaction(event.block, event.transaction, event.receipt, account)
  tx.save()

  const strategyAddress = event.params.proxy
  const strategy = getBeefyCLStrategy(strategyAddress)
  strategy.createdWith = tx.id
  strategy.save()

  // start indexing the new strategy
  BeefyCLStrategyTemplate.create(strategyAddress)
}
