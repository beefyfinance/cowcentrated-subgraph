import { Address, log } from "@graphprotocol/graph-ts"
import { ProxyCreated as VaultOrStrategyCreated } from "../../generated/ClassicVaultFactory/ClassicVaultFactory"
import {
  ClassicVault as ClassicVaultContract,
  Initialized as ClassicVaultInitialized,
  UpgradeStrat as ClassicVaultUpgradeStrategy,
} from "../../generated/ClassicVaultFactory/ClassicVault"
import {
  ClassicStrategy as ClassicStrategyContract,
  Initialized as ClassicStrategyInitialized,
  Paused as ClassicStrategyPaused,
  Unpaused as ClassicStrategyUnpaused,
} from "../../generated/ClassicVaultFactory/ClassicStrategy"
import {
  ClassicVault as ClassicVaultTemplate,
  ClassicStrategy as ClassicStrategyTemplate,
} from "../../generated/templates"
import { getClassic, getClassicStrategy, getClassicVault } from "./entity/classic"
import { Classic } from "../../generated/schema"
import { getTransaction } from "../common/entity/transaction"
import { fetchAndSaveTokenData } from "../common/utils/token"
import { PRODUCT_LIFECYCLE_PAUSED, PRODUCT_LIFECYCLE_RUNNING } from "../common/entity/lifecycle"
import { ADDRESS_ZERO } from "../common/utils/address"

export function handleClassicVaultOrStrategyCreated(event: VaultOrStrategyCreated): void {
  const address = event.params.proxy

  const tx = getTransaction(event.block, event.transaction)
  tx.save()

  // test if we are creating a vault or a strategy
  const vaultContract = ClassicVaultContract.bind(address)
  const vaultStrategyRes = vaultContract.try_strategy()
  // proxy also creates the strategies
  if (vaultStrategyRes.reverted) {
    log.debug("`strategy()` method does not exist on contract: {}. It's not a vault", [address.toHexString()])
  } else {
    log.info("Creating Classic Vault: {}", [address.toHexString()])
    const vault = getClassicVault(address)
    vault.isInitialized = false
    vault.createdWith = tx.id
    vault.save()

    ClassicVaultTemplate.create(address)
  }

  const strategyContract = ClassicStrategyContract.bind(address)
  const strategyVaultRes = strategyContract.try_vault()
  if (strategyVaultRes.reverted) {
    log.debug("`vault()` method does not exist on contract: {}. It's not a strategy", [address.toHexString()])
  } else {
    log.info("Creating Classic Strategy: {}", [address.toHexString()])

    const strategy = getClassicStrategy(address)
    strategy.isInitialized = false
    strategy.createdWith = tx.id
    strategy.save()

    ClassicStrategyTemplate.create(address)
  }
}

export function handleClassicVaultInitialized(event: ClassicVaultInitialized): void {
  const vaultAddress = event.address
  log.debug("Vault initialized: {}", [vaultAddress.toHexString()])

  let classic = getClassic(vaultAddress)
  let vault = getClassicVault(vaultAddress)
  // some chains don't have a proper initialized event so
  // we hook into another event that may trigger multiple times
  if (vault.isInitialized) {
    return
  }
  const vaultContract = ClassicVaultContract.bind(vaultAddress)
  const strategyAddress = vaultContract.strategy()

  vault.isInitialized = true
  vault.save()

  classic.strategy = strategyAddress
  classic.save()

  const strategy = getClassicStrategy(strategyAddress)

  if (strategy.isInitialized && vault.isInitialized) {
    fetchInitialClassicDataAndSave(classic)
  }
}

export function handleClassicStrategyInitialized(event: ClassicStrategyInitialized): void {
  const strategyAddress = event.address
  log.debug("Strategy initialized: {}", [strategyAddress.toHexString()])

  let strategy = getClassicStrategy(strategyAddress)
  // some chains don't have a proper initialized event so
  // we hook into another event that may trigger multiple times
  if (strategy.isInitialized) {
    return
  }

  const strategyContract = ClassicStrategyContract.bind(strategyAddress)
  const vaultAddress = strategyContract.vault()

  let classic = getClassic(vaultAddress)
  const vault = getClassicVault(vaultAddress)

  strategy.isInitialized = true
  strategy.classic = classic.id
  strategy.vault = vaultAddress
  strategy.save()

  classic.vault = vaultAddress
  classic.save()

  if (strategy.isInitialized && vault.isInitialized) {
    fetchInitialClassicDataAndSave(classic)
  }
}

function fetchInitialClassicDataAndSave(classic: Classic): void {
  const vaultAddress = Address.fromBytes(classic.vault)
  const vaultContract = ClassicVaultContract.bind(vaultAddress)

  const underlyingTokenAddress = vaultContract.want()

  const vaultSharesToken = fetchAndSaveTokenData(vaultAddress)
  const underlyingToken = fetchAndSaveTokenData(underlyingTokenAddress)

  classic.vaultSharesToken = vaultSharesToken.id
  classic.underlyingToken = underlyingToken.id
  classic.lifecycle = PRODUCT_LIFECYCLE_RUNNING
  classic.save()
}

export function handleClassicStrategyPaused(event: ClassicStrategyPaused): void {
  const strategyAddress = event.address
  log.debug("Strategy paused: {}", [strategyAddress.toHexString()])

  const strategy = getClassicStrategy(strategyAddress)
  let classic = getClassic(strategy.vault)
  classic.lifecycle = PRODUCT_LIFECYCLE_PAUSED
  classic.save()
}

export function handleClassicStrategyUnpaused(event: ClassicStrategyUnpaused): void {
  const strategyAddress = event.address
  log.debug("Strategy unpaused: {}", [strategyAddress.toHexString()])

  const strategy = getClassicStrategy(strategyAddress)
  let classic = getClassic(strategy.vault)
  classic.lifecycle = PRODUCT_LIFECYCLE_RUNNING
  classic.save()
}

export function handleClassicVaultUpgradeStrategy(event: ClassicVaultUpgradeStrategy): void {
  const vaultAddress = event.address
  const classic = getClassic(vaultAddress)
  const newStrategyAddress = event.params.implementation
  const oldStrategyAddress = classic.strategy
  classic.strategy = newStrategyAddress
  classic.save()

  // create the new strategy entity
  const newStrategy = getClassicStrategy(newStrategyAddress)
  newStrategy.isInitialized = true // once the vault is upgraded, the strategy is initialized
  newStrategy.vault = classic.id
  newStrategy.classic = classic.id
  newStrategy.save()

  // we start watching the new strategy events
  ClassicStrategyTemplate.create(newStrategyAddress)

  // make sure we deprecated the old strategy
  // so events are ignored
  const oldStrategy = getClassicStrategy(oldStrategyAddress)
  oldStrategy.isInitialized = false
  oldStrategy.vault = ADDRESS_ZERO
  oldStrategy.classic = ADDRESS_ZERO
  oldStrategy.save()
}
