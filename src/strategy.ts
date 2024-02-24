import { log } from '@graphprotocol/graph-ts'
import {
  Initialized,
  StrategyPassiveManagerUniswap as BeefyCLStrategyContract,
  OwnershipTransferred,
  Paused,
  Unpaused,
} from '../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap'
import {
  BEEFY_CL_VAULT_LIFECYCLE_PAUSED,
  BEEFY_CL_VAULT_LIFECYCLE_RUNNING,
  getBeefyCLStrategy,
  getBeefyCLVault,
} from './entity/vault'
import { fetchInitialVaultData } from './init-vault'
import { getUserAccount } from './entity/user-account'

export function handleInitialized(event: Initialized): void {
  const strategyAddress = event.address

  const strategyContract = BeefyCLStrategyContract.bind(strategyAddress)
  const vaultAddressRes = strategyContract.try_vault()
  if (vaultAddressRes.reverted) {
    log.error('handleInitialized: vault() reverted for strategy {}', [strategyAddress.toHexString()])
    throw Error('handleInitialized: vault() reverted')
  }
  const vaultAddress = vaultAddressRes.value

  const strategy = getBeefyCLStrategy(strategyAddress)
  strategy.isInitialized = true
  strategy.vault = vaultAddress
  strategy.save()

  let vault = getBeefyCLVault(vaultAddress)
  if (vault.isInitialized) {
    vault = fetchInitialVaultData(event.block.timestamp, vault)
    vault.save()
  }
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  const strategy = getBeefyCLStrategy(event.address)
  const owner = getUserAccount(event.params.newOwner)
  owner.lastInteractionTimestamp = event.block.timestamp
  owner.interactionsCount = owner.interactionsCount + 1
  owner.save()

  strategy.owner = owner.id
  strategy.save()
}

export function handlePaused(event: Paused): void {
  const strategy = getBeefyCLStrategy(event.address)
  const vault = getBeefyCLVault(strategy.vault)
  vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_PAUSED
  vault.save()
}

export function handleUnpaused(event: Unpaused): void {
  const strategy = getBeefyCLStrategy(event.address)
  const vault = getBeefyCLVault(strategy.vault)
  vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_RUNNING
  vault.save()
}

/*
export function handleHarvest(event: HarvestEvent): void {
  let strategy = getExistingStrategy(event.address)
  let tx = getOrCreateTransaction(event.block, event.transaction)
  let vault = getExistingVault(strategy.vault)

  let harvest = new HarvestSchema(getEventIdentifier(event))
  harvest.vault = vault.id
  harvest.strategy = strategy.id
  harvest.createdWith = tx.id
  harvest.fee0 = event.params.fee0
  harvest.fee1 = event.params.fee1
  harvest.save()

  // fetch additional data
  let vaultContract = BeefyVaultConcLiqContract.bind(Address.fromBytes(strategy.vault))
  let pricesPerToken = vaultContract.getTokensPerShare(BigInt.fromI32(1))

  // update the vault
  let sharesToken = getOrCreateToken(vault.id)
  let currentTotalSupply = sharesToken.totalSupply
  if (currentTotalSupply === null) throw Error('Vault not initialized')
  vault.underlyingAmount0 = currentTotalSupply.times(pricesPerToken.value0)
  vault.underlyingAmount1 = currentTotalSupply.times(pricesPerToken.value1)
  vault.save()

  // update all the current positions
  let positions = vault.positions.load()
  for (let i = 0; i < positions.length; i++) {
    let userPosition = positions[i]
    userPosition.underlyingBalance0 = userPosition.sharesBalance.times(pricesPerToken.value0)
    userPosition.underlyingBalance1 = userPosition.sharesBalance.times(pricesPerToken.value1)
    userPosition.save()
  }
}
*/
