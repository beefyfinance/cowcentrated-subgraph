import { ProxyCreated } from '../generated/BeefyVaultConcLiqFactory/BeefyVaultConcLiqFactory'
import { BeefyVaultConcLiqFactory, BeefyVaultConcLiq, Account } from '../generated/schema'
import { BeefyVaultConcLiq as BeefyVaultConcLiqTemplate } from '../generated/templates'
import { getOrCreateTransaction } from './common'

export function handleNewBeefyVaultConcLiq(event: ProxyCreated): void {
  let factoryId = event.address
  let factory = BeefyVaultConcLiqFactory.load(factoryId)
  if (factory == null) {
    factory = new BeefyVaultConcLiqFactory(factoryId)
    factory.vaultCount = 0
  }

  let creatorAccountId = event.transaction.from
  let creatorAccount = Account.load(creatorAccountId)
  if (creatorAccount == null) {
    creatorAccount = new Account(creatorAccountId)
  }
  creatorAccount.createdVaultCount = creatorAccount.createdVaultCount + 1
  creatorAccount.save()

  let tx = getOrCreateTransaction(event.block, event.transaction)

  let vaultId = event.params.proxy
  let vault = new BeefyVaultConcLiq(vaultId)
  vault.factory = factory.id
  vault.createdWith = tx.id
  vault.save()

  factory.vaultCount = factory.vaultCount + 1
  factory.save()

  // start indexing the new vault
  BeefyVaultConcLiqTemplate.create(event.params.proxy)
}
