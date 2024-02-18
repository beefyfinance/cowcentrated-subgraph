import { ProxyCreated } from '../generated/BeefyVaultConcLiqFactory/BeefyVaultConcLiqFactory'
import { BeefyVaultConcLiqFactory, BeefyVaultConcLiq, Account } from '../generated/schema'
import { BeefyVaultConcLiq as BeefyVaultConcLiqTemplate } from '../generated/templates'

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

  let vaultId = event.params.proxy
  let vault = new BeefyVaultConcLiq(vaultId)
  vault.factory = factory.id
  vault.createdBy = creatorAccount.id
  vault.createdWithTransaction = event.transaction.hash
  vault.createdAtTimestamp = event.block.timestamp
  vault.createdAtBlock = event.block.number
  vault.save()

  factory.vaultCount = factory.vaultCount + 1
  factory.save()

  // start indexing the new vault
  BeefyVaultConcLiqTemplate.create(event.params.proxy)
}
