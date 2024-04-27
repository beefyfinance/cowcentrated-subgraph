import { Address, BigInt } from "@graphprotocol/graph-ts"
import { BeefyCLVault } from "../generated/schema"
import { BeefyVaultConcLiq as BeefyCLVaultContract } from "../generated/templates/BeefyCLVault/BeefyVaultConcLiq"
import { BEEFY_CL_VAULT_LIFECYCLE_PAUSED, BEEFY_CL_VAULT_LIFECYCLE_RUNNING } from "./entity/vault"
import { Initialized as VaultInitialized } from "../generated/templates/BeefyCLVault/BeefyVaultConcLiq"
import { getBeefyCLStrategy, getBeefyCLVault } from "./entity/vault"
import { log } from "@graphprotocol/graph-ts"
import { BeefyCLStrategy as BeefyCLStrategyTemplate } from "../generated/templates"
import { ADDRESS_ZERO } from "./utils/address"
import {
  Initialized as StrategyInitializedEvent,
  BeefyStrategy as BeefyCLStrategyContract,
  Paused as PausedEvent,
  Unpaused as UnpausedEvent,
} from "../generated/templates/BeefyCLStrategy/BeefyStrategy"
import { ProxyCreated as VaultCreatedEvent } from "../generated/BeefyCLVaultFactory/BeefyVaultConcLiqFactory"
import { GlobalPause as GlobalPauseEvent } from "../generated/BeefyCLStrategyFactory/BeefyStrategyFactory"
import { BeefyCLVault as BeefyCLVaultTemplate } from "../generated/templates"
import { getTransaction } from "./entity/transaction"
import { fetchAndSaveTokenData } from "./utils/token"
import { getBeefyCLProtocol } from "./entity/protocol"

export function handleVaultCreated(event: VaultCreatedEvent): void {
  const tx = getTransaction(event.block, event.transaction)
  tx.save()

  const vaultAddress = event.params.proxy
  const vault = getBeefyCLVault(vaultAddress)
  vault.createdWith = tx.id
  vault.save()

  // start indexing the new vault
  BeefyCLVaultTemplate.create(vaultAddress)

  log.info("handleVaultCreated: Vault {} created on block {}", [vault.id.toHexString(), event.block.number.toString()])
}

export function handleVaultInitialized(event: VaultInitialized): void {
  const vaultAddress = event.address

  const vaultContract = BeefyCLVaultContract.bind(vaultAddress)
  const strategyAddressRes = vaultContract.try_strategy()
  if (strategyAddressRes.reverted) {
    log.error("handleInitialized: strategy() reverted for vault {} on block {}", [
      vaultAddress.toHexString(),
      event.block.number.toString(),
    ])
    throw Error("handleInitialized: strategy() reverted")
  }
  const strategyAddress = strategyAddressRes.value

  let vault = getBeefyCLVault(vaultAddress)
  vault.isInitialized = true
  vault.strategy = strategyAddress
  vault.save() // needs to be saved before we can use it in the strategy events

  // we start watching strategy events
  BeefyCLStrategyTemplate.create(strategyAddress)

  log.info("handleVaultInitialized: Vault {} initialized with strategy {} on block {}", [
    vault.id.toHexString(),
    vault.strategy.toHexString(),
    event.block.number.toString(),
  ])

  const strategy = getBeefyCLStrategy(strategyAddress)
  // the strategy may or may not be initialized
  // this is a test to know if that is the case
  const strategyContract = BeefyCLStrategyContract.bind(strategyAddress)
  const strategyPool = strategyContract.try_pool()
  if (strategyPool.reverted) {
    log.error("handleInitialized: pool() reverted for strategy {} on block {}", [
      strategyAddress.toHexString(),
      event.block.number.toString(),
    ])
    throw Error("handleInitialized: pool() reverted")
  }
  strategy.isInitialized = !strategyPool.value.equals(ADDRESS_ZERO)

  if (strategy.isInitialized) {
    vault = fetchInitialVaultData(event.block.timestamp, vault)
    vault.save()
  }
}

export function handleStrategyInitialized(event: StrategyInitializedEvent): void {
  const strategyAddress = event.address

  const strategyContract = BeefyCLStrategyContract.bind(strategyAddress)
  const vaultAddressRes = strategyContract.try_vault()
  if (vaultAddressRes.reverted) {
    log.error("handleInitialized: vault() reverted for strategy {} on block {}", [
      strategyAddress.toHexString(),
      event.block.number.toString(),
    ])
    throw Error("handleInitialized: vault() reverted")
  }
  const vaultAddress = vaultAddressRes.value

  const strategy = getBeefyCLStrategy(strategyAddress)
  strategy.isInitialized = true
  strategy.vault = vaultAddress
  strategy.save()

  log.info("handleStrategyInitialized: Strategy {} initialized for vault {} on block {}", [
    strategy.id.toHexString(),
    strategy.vault.toHexString(),
    event.block.number.toString(),
  ])

  let vault = getBeefyCLVault(vaultAddress)
  if (vault.isInitialized) {
    vault = fetchInitialVaultData(event.block.timestamp, vault)
    vault.save()
  }
}

/**
 * Initialize the vault data.
 * Call this when both the vault and the strategy are initialized.
 */
function fetchInitialVaultData(timestamp: BigInt, vault: BeefyCLVault): BeefyCLVault {
  const vaultAddress = Address.fromBytes(vault.id)
  const vaultContract = BeefyCLVaultContract.bind(vaultAddress)

  const wantsRes = vaultContract.try_wants()
  if (wantsRes.reverted) {
    log.error("fetchInitialVaultData: wants() reverted for vault {}.", [vaultAddress.toHexString()])
    throw Error("fetchInitialVaultData: wants() reverted")
  }
  const wants = wantsRes.value
  const underlyingToken0Address = wants.value0
  const underlyingToken1Address = wants.value1

  const sharesToken = fetchAndSaveTokenData(vaultAddress)
  const underlyingToken0 = fetchAndSaveTokenData(underlyingToken0Address)
  const underlyingToken1 = fetchAndSaveTokenData(underlyingToken1Address)

  vault.sharesToken = sharesToken.id
  vault.underlyingToken0 = underlyingToken0.id
  vault.underlyingToken1 = underlyingToken1.id
  vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_RUNNING

  log.info("fetchInitialVaultData: Vault {} now running with strategy {}.", [
    vault.id.toHexString(),
    vault.strategy.toHexString(),
  ])

  return vault
}

export function handleGlobalStrategyPause(event: GlobalPauseEvent): void {
  const protocol = getBeefyCLProtocol()
  const vaults = protocol.vaults.load()
  for (let i = 0; i < vaults.length; i++) {
    const vault = vaults[i]
    if (event.params.paused) vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_PAUSED
    if (!event.params.paused) vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_RUNNING
    vault.save()
  }
}

export function handleStrategyPaused(event: PausedEvent): void {
  const strategy = getBeefyCLStrategy(event.address)
  const vault = getBeefyCLVault(strategy.vault)
  vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_PAUSED
  vault.save()
}

export function handleStrategyUnpaused(event: UnpausedEvent): void {
  const strategy = getBeefyCLStrategy(event.address)
  const vault = getBeefyCLVault(strategy.vault)
  vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_RUNNING
  vault.save()
}
