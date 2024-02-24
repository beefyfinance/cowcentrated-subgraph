import { Bytes } from '@graphprotocol/graph-ts'
import { BeefyCLStrategy, BeefyCLVault } from '../../generated/schema'
import { ADDRESS_ZERO } from '../utils/address'
import { ZERO_BD } from '../utils/decimal'
import { PROTOCOL_BEEFY_CL } from './protocol'

export const BEEFY_CL_VAULT_LIFECYCLE_INITIALIZING = 'INITIALIZING'
export const BEEFY_CL_VAULT_LIFECYCLE_RUNNING = 'RUNNING'
export const BEEFY_CL_VAULT_LIFECYCLE_PAUSED = 'PAUSED'

export function getBeefyCLVault(vaultAddress: Bytes): BeefyCLVault {
  let vault = BeefyCLVault.load(vaultAddress)
  if (!vault) {
    vault = new BeefyCLVault(vaultAddress)
    vault.protocol = PROTOCOL_BEEFY_CL.toString()
    vault.createdWith = ADDRESS_ZERO
    vault.owner = ADDRESS_ZERO
    vault.sharesToken = ADDRESS_ZERO
    vault.strategy = ADDRESS_ZERO
    vault.underlyingToken0 = ADDRESS_ZERO
    vault.underlyingToken1 = ADDRESS_ZERO
    vault.totalValueLockedUSD = ZERO_BD
    vault.isInitialized = false
    vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_INITIALIZING
  }
  return vault
}

export function getBeefyCLStrategy(strategyAddress: Bytes): BeefyCLStrategy {
  let strategy = BeefyCLStrategy.load(strategyAddress)
  if (!strategy) {
    strategy = new BeefyCLStrategy(strategyAddress)
    strategy.vault = ADDRESS_ZERO
    strategy.owner = ADDRESS_ZERO
    strategy.isInitialized = false
  }
  return strategy
}
