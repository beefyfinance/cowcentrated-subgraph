import { OwnershipTransferred as StrategyOwnershipTransferred } from "../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap"
import { OwnershipTransferred as VaultOwnershipTransferred } from "../generated/templates/BeefyCLVault/BeefyVaultConcLiq"
import { getBeefyCLStrategy, getBeefyCLVault } from "./entity/vault"
import { OwnershipTransferred as BoostOwnershipTransferred } from "../generated/templates/BeefyBoost/BeefyBoost"
import { getBoost } from "./entity/boost"

export function handleStrategyOwnershipTransferred(event: StrategyOwnershipTransferred): void {
  const strategy = getBeefyCLStrategy(event.address)
  strategy.owner = event.params.newOwner
  strategy.save()
}

export function handleVaultOwnershipTransferred(event: VaultOwnershipTransferred): void {
  const vault = getBeefyCLVault(event.address)
  vault.owner = event.params.newOwner
  vault.save()
}

export function handleBoostOwnershipTransferred(event: BoostOwnershipTransferred): void {
  const boost = getBoost(event.address)
  boost.owner = event.params.newOwner
  boost.save()
}
