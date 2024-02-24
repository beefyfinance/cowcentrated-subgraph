import { OwnershipTransferred as StrategyOwnershipTransferred } from '../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap'
import { OwnershipTransferred as VaultOwnershipTransferred } from '../generated/templates/BeefyCLVault/BeefyVaultConcLiq'
import { getUserAccount } from './entity/user-account'
import { getBeefyCLStrategy, getBeefyCLVault } from './entity/vault'

export function handleStrategyOwnershipTransferred(event: StrategyOwnershipTransferred): void {
  const strategy = getBeefyCLStrategy(event.address)
  const owner = getUserAccount(event.params.newOwner)
  owner.lastInteractionTimestamp = event.block.timestamp
  owner.interactionsCount = owner.interactionsCount + 1
  owner.save()

  strategy.owner = owner.id
  strategy.save()
}

export function handleVaultOwnershipTransferred(event: VaultOwnershipTransferred): void {
  const vault = getBeefyCLVault(event.address)
  const owner = getUserAccount(event.params.newOwner)
  owner.lastInteractionTimestamp = event.block.timestamp
  owner.interactionsCount = owner.interactionsCount + 1
  owner.save()

  vault.owner = owner.id
  vault.save()
}
