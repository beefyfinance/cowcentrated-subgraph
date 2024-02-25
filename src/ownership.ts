import { OwnershipTransferred as StrategyOwnershipTransferred } from '../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap'
import { OwnershipTransferred as VaultOwnershipTransferred } from '../generated/templates/BeefyCLVault/BeefyVaultConcLiq'
import { getBeefyCLStrategy, getBeefyCLVault } from './entity/vault'

export function handleStrategyOwnershipTransferred(event: StrategyOwnershipTransferred): void {
  const strategy = getBeefyCLStrategy(event.address.toHexString())
  strategy.owner = event.params.newOwner
  strategy.save()
}

export function handleVaultOwnershipTransferred(event: VaultOwnershipTransferred): void {
  const vault = getBeefyCLVault(event.address.toHexString())
  vault.owner = event.params.newOwner
  vault.save()
}
