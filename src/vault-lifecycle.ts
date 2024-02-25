import { Address, BigInt } from '@graphprotocol/graph-ts'
import { BeefyCLVault } from '../generated/schema'
import { BeefyVaultConcLiq as BeefyCLVaultContract } from '../generated/templates/BeefyCLVault/BeefyVaultConcLiq'
import { IERC20 as IERC20Contract } from '../generated/templates/BeefyCLVault/IERC20'
import { getToken } from './entity/token'
import { getBeefyCLProtocol, getBeefyCLProtocolSnapshot } from './entity/protocol'
import { PERIODS } from './utils/time'
import { BEEFY_CL_VAULT_LIFECYCLE_PAUSED, BEEFY_CL_VAULT_LIFECYCLE_RUNNING } from './entity/vault'
import { Initialized as VaultInitialized } from '../generated/templates/BeefyCLVault/BeefyVaultConcLiq'
import { getBeefyCLStrategy, getBeefyCLVault } from './entity/vault'
import { log } from '@graphprotocol/graph-ts'
import { BeefyCLStrategy as BeefyCLStrategyTemplate } from '../generated/templates'
import { ADDRESS_ZERO } from './utils/address'
import {
  Initialized as StrategyInitializedEvent,
  StrategyPassiveManagerUniswap as BeefyCLStrategyContract,
  Paused as PausedEvent,
  Unpaused as UnpausedEvent,
} from '../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap'
import { ProxyCreated as VaultCreatedEvent } from '../generated/BeefyCLVaultFactory/BeefyVaultConcLiqFactory'
import { BeefyCLVault as BeefyCLVaultTemplate } from '../generated/templates'
import { getTransaction } from './entity/transaction'

export function handleVaultCreated(event: VaultCreatedEvent): void {
  const tx = getTransaction(event.block, event.transaction, event.receipt)
  tx.save()

  const vaultAddress = event.params.proxy
  const vault = getBeefyCLVault(vaultAddress.toHexString())
  vault.createdWith = tx.id
  vault.save()

  // start indexing the new vault
  BeefyCLVaultTemplate.create(vaultAddress)

  log.info('handleVaultCreated: Vault {} created on block {}', [vault.id, event.block.number.toString()])
}

export function handleVaultInitialized(event: VaultInitialized): void {
  const vaultAddress = event.address

  const vaultContract = BeefyCLVaultContract.bind(vaultAddress)
  const strategyAddressRes = vaultContract.try_strategy()
  if (strategyAddressRes.reverted) {
    log.error('handleInitialized: strategy() reverted for vault {} on block {}', [
      vaultAddress.toHexString(),
      event.block.number.toString(),
    ])
    throw Error('handleInitialized: strategy() reverted')
  }
  const strategyAddress = strategyAddressRes.value

  let vault = getBeefyCLVault(vaultAddress.toHexString())
  vault.isInitialized = true
  vault.strategy = strategyAddress.toHexString()
  vault.save() // needs to be saved before we can use it in the strategy events

  // we start watching strategy events
  BeefyCLStrategyTemplate.create(strategyAddress)

  log.info('handleVaultInitialized: Vault {} initialized with strategy {} on block {}', [
    vault.id,
    vault.strategy,
    event.block.number.toString(),
  ])

  const strategy = getBeefyCLStrategy(strategyAddress.toHexString())
  // the strategy may or may not be initialized
  // this is a test to know if that is the case
  const strategyContract = BeefyCLStrategyContract.bind(strategyAddress)
  const strategyPool = strategyContract.try_pool()
  if (strategyPool.reverted) {
    log.error('handleInitialized: pool() reverted for strategy {} on block {}', [
      strategyAddress.toHexString(),
      event.block.number.toString(),
    ])
    throw Error('handleInitialized: pool() reverted')
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
    log.error('handleInitialized: vault() reverted for strategy {} on block {}', [
      strategyAddress.toHexString(),
      event.block.number.toString(),
    ])
    throw Error('handleInitialized: vault() reverted')
  }
  const vaultAddress = vaultAddressRes.value

  const strategy = getBeefyCLStrategy(strategyAddress.toHexString())
  strategy.isInitialized = true
  strategy.vault = vaultAddress.toHexString()
  strategy.save()

  log.info('handleStrategyInitialized: Strategy {} initialized for vault {} on block {}', [
    strategy.id,
    strategy.vault,
    event.block.number.toString(),
  ])

  let vault = getBeefyCLVault(vaultAddress.toHexString())
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
  const vaultAddress = Address.fromBytes(Address.fromHexString(vault.id))
  const vaultContract = BeefyCLVaultContract.bind(vaultAddress)
  const wants = vaultContract.wants()
  const underlyingToken0Address = wants.value0
  const underlyingToken1Address = wants.value1

  const shareTokenContract = IERC20Contract.bind(vaultAddress)
  const shareTokenSymbol = shareTokenContract.symbol()
  const shareTokenName = shareTokenContract.name()
  const shareTokenDecimals = shareTokenContract.decimals()

  const underlyingToken0Contract = IERC20Contract.bind(underlyingToken0Address)
  const underlyingToken0Decimals = underlyingToken0Contract.decimals()
  const underlyingToken0Name = underlyingToken0Contract.name()
  const underlyingToken0Symbol = underlyingToken0Contract.symbol()

  const underlyingToken1Contract = IERC20Contract.bind(underlyingToken1Address)
  const underlyingToken1Decimals = underlyingToken1Contract.decimals()
  const underlyingToken1Name = underlyingToken1Contract.name()
  const underlyingToken1Symbol = underlyingToken1Contract.symbol()

  const sharesToken = getToken(vaultAddress.toHexString())
  sharesToken.name = shareTokenName
  sharesToken.symbol = shareTokenSymbol
  sharesToken.decimals = BigInt.fromI32(shareTokenDecimals)
  sharesToken.save()

  const underlyingToken0 = getToken(underlyingToken0Address.toHexString())
  underlyingToken0.name = underlyingToken0Name
  underlyingToken0.symbol = underlyingToken0Symbol
  underlyingToken0.decimals = BigInt.fromI32(underlyingToken0Decimals)
  underlyingToken0.save()

  const underlyingToken1 = getToken(underlyingToken1Address.toHexString())
  underlyingToken1.name = underlyingToken1Name
  underlyingToken1.symbol = underlyingToken1Symbol
  underlyingToken1.decimals = BigInt.fromI32(underlyingToken1Decimals)
  underlyingToken1.save()

  const protocol = getBeefyCLProtocol()
  protocol.activeVaultCount += 1
  protocol.save()

  const periods = PERIODS
  for (let i = 0; i < periods.length; i++) {
    const protocolSnapshot = getBeefyCLProtocolSnapshot(timestamp, periods[i])
    protocolSnapshot.activeVaultCount += 1
    protocolSnapshot.save()
  }

  vault.sharesToken = sharesToken.id
  vault.underlyingToken0 = underlyingToken0.id
  vault.underlyingToken1 = underlyingToken1.id
  vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_RUNNING

  log.info('fetchInitialVaultData: Vault {} now running with strategy {}.', [vault.id, vault.strategy])

  return vault
}

export function handleStrategyPaused(event: PausedEvent): void {
  const strategy = getBeefyCLStrategy(event.address.toHexString())
  const vault = getBeefyCLVault(strategy.vault)
  vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_PAUSED
  vault.save()

  log.info('handleStrategyPaused: Strategy {} paused for vault {}.', [strategy.id, vault.id])
}

export function handleStrategyUnpaused(event: UnpausedEvent): void {
  const strategy = getBeefyCLStrategy(event.address.toHexString())
  const vault = getBeefyCLVault(strategy.vault)
  vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_RUNNING
  vault.save()

  log.info('handleStrategyUnpaused: Strategy {} unpaused for vault {}.', [strategy.id, vault.id])
}
