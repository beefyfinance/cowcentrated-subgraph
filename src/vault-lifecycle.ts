import { Address } from "@graphprotocol/graph-ts"
import { BeefyCLVault, BeefyCLRewardPool } from "../generated/schema"
import {
  BeefyCLVault as BeefyCLVaultContract,
  Initialized as CLMVaultInitialized,
} from "../generated/templates/BeefyCLVault/BeefyCLVault"
import {
  BEEFY_CL_VAULT_LIFECYCLE_PAUSED,
  BEEFY_CL_VAULT_LIFECYCLE_RUNNING,
  getBeefyCLRewardPool,
  getBeefyCLStrategy,
  getBeefyCLVault,
} from "./entity/vault"
import { log } from "@graphprotocol/graph-ts"
import {
  BeefyCLStrategy as BeefyCLStrategyTemplate,
  BeefyCLVault as BeefyCLVaultTemplate,
  BeefyCLRewardPool as BeefyCLRewardPoolTemplate,
} from "../generated/templates"
import { ADDRESS_ZERO } from "./utils/address"
import {
  Initialized as StrategyInitializedEvent,
  BeefyCLStrategy as BeefyCLStrategyContract,
  Paused as PausedEvent,
  Unpaused as UnpausedEvent,
} from "../generated/templates/BeefyCLStrategy/BeefyCLStrategy"
import { ProxyCreated as CLMVaultCreatedEvent } from "../generated/BeefyCLVaultFactory/BeefyCLVaultFactory"
import { ProxyCreated as RewardPoolCreatedEvent } from "../generated/BeefyRewardPoolFactory/BeefyRewardPoolFactory"
import {
  Initialized as RewardPoolInitialized,
  BeefyRewardPool as BeefyCLRewardPoolContract,
} from "../generated/BeefyRewardPoolFactory/BeefyRewardPool"
import { GlobalPause as GlobalPauseEvent } from "../generated/BeefyCLStrategyFactory/BeefyCLStrategyFactory"
import { getTransaction } from "./entity/transaction"
import { fetchAndSaveTokenData } from "./utils/token"
import { getBeefyCLProtocol } from "./entity/protocol"

export function handleClmVaultCreated(event: CLMVaultCreatedEvent): void {
  const tx = getTransaction(event.block, event.transaction)
  tx.save()

  const vaultAddress = event.params.proxy
  const vault = getBeefyCLVault(vaultAddress)
  vault.createdWith = tx.id
  vault.save()

  // start indexing the new vault
  BeefyCLVaultTemplate.create(vaultAddress)

  log.info("handleClmVaultCreated: Vault was {} created on block {}", [
    vault.id.toHexString(),
    event.block.number.toString(),
  ])
}

export function handleClmVaultInitialized(event: CLMVaultInitialized): void {
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

  log.info("handleClmVaultInitialized: Vault {} initialized with strategy {} on block {}", [
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
    vault = fetchInitialClmVaultData(vault)
    vault.save()
  }
}

export function handleClmStrategyInitialized(event: StrategyInitializedEvent): void {
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
    vault = fetchInitialClmVaultData(vault)
    vault.save()
  }
}

/**
 * Initialize the vault data.
 * Call this when both the vault and the strategy are initialized.
 */
function fetchInitialClmVaultData(vault: BeefyCLVault): BeefyCLVault {
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

  // maaaaybe we have an output token
  const strategyAddress = Address.fromBytes(vault.strategy)
  const strategyContract = BeefyCLStrategyContract.bind(strategyAddress)
  const outputTokenRes = strategyContract.try_output()
  if (!outputTokenRes.reverted) {
    const outputToken0 = fetchAndSaveTokenData(outputTokenRes.value)
    vault.outputToken0 = outputToken0.id
  }

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

export function handleGlobalClmStrategyPause(event: GlobalPauseEvent): void {
  const protocol = getBeefyCLProtocol()
  const vaults = protocol.vaults.load()
  for (let i = 0; i < vaults.length; i++) {
    const vault = vaults[i]
    if (event.params.paused) vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_PAUSED
    if (!event.params.paused) vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_RUNNING
    vault.save()
  }
}

export function handleClmStrategyPaused(event: PausedEvent): void {
  const strategy = getBeefyCLStrategy(event.address)
  const vault = getBeefyCLVault(strategy.vault)
  vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_PAUSED
  vault.save()
}

export function handleClmStrategyUnpaused(event: UnpausedEvent): void {
  const strategy = getBeefyCLStrategy(event.address)
  const vault = getBeefyCLVault(strategy.vault)
  vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_RUNNING
  vault.save()
}

export function handleRewardPoolCreated(event: RewardPoolCreatedEvent): void {
  const rewardPoolAddress = event.params.proxy

  const rewardPool = getBeefyCLRewardPool(rewardPoolAddress)
  rewardPool.isInitialized = false
  rewardPool.save()

  // start indexing the new reward pool
  BeefyCLRewardPoolTemplate.create(rewardPoolAddress)
}

export function handleRewardPoolInitialized(event: RewardPoolInitialized): void {
  const rewardPoolAddress = event.address
  const rewardPoolContract = BeefyCLRewardPoolContract.bind(rewardPoolAddress)
  const vaultAddress = rewardPoolContract.stakedToken()

  const rewardPool = getBeefyCLRewardPool(rewardPoolAddress)
  rewardPool.isInitialized = true
  rewardPool.vault = vaultAddress
  rewardPool.save()

  const rewardPoolToken = fetchAndSaveTokenData(rewardPoolAddress)

  const vault = getBeefyCLVault(vaultAddress)
  vault.rewardPool = rewardPool.id
  vault.rewardPoolToken = rewardPoolToken.id
  vault.save()

  log.info("handleRewardPoolInitialized: Reward pool {} initialized for vault {} on block {}", [
    rewardPool.id.toHexString(),
    rewardPool.vault.toHexString(),
    event.block.number.toString(),
  ])
}
