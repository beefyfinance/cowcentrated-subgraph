import { Address, Bytes, log } from "@graphprotocol/graph-ts"
import { ProxyCreated as VaultOrStrategyCreated } from "../../generated/ClassicVaultFactory/ClassicVaultFactory"
import {
  ClassicVault as ClassicVaultContract,
  Initialized as ClassicVaultInitialized,
  UpgradeStrat as ClassicVaultUpgradeStrategy,
} from "../../generated/ClassicVaultFactory/ClassicVault"
import {
  ProxyCreated as ClassicStrategyCreated,
  ClassicStrategyFactory as ClassicStrategyFactoryContract,
} from "../../generated/ClassicStrategyFactory/ClassicStrategyFactory"
import { ProxyCreated as ClassicErc4626AdapterCreated } from "../../generated/ClassicErc4626AdapterFactory/ClassicErc4626AdapterFactory"
import {
  Initialized as ClassicErc4626AdapterInitialized,
  ClassicErc4626Adapter as ClassicErc4626AdapterContract,
} from "../../generated/templates/ClassicErc4626Adapter/ClassicErc4626Adapter"
import { BoostDeployed as ClassicBoostDeployed } from "../../generated/ClassicBoostFactory/ClassicBoostFactory"
import {
  Initialized as ClassicBoostInitialized,
  ClassicBoost as ClassicBoostContract,
} from "../../generated/ClassicBoostFactory/ClassicBoost"
import {
  ClassicStrategy as ClassicStrategyContract,
  Initialized as ClassicStrategyInitialized,
  Paused as ClassicStrategyPaused,
  Unpaused as ClassicStrategyUnpaused,
} from "../../generated/ClassicVaultFactory/ClassicStrategy"
import {
  ClassicVault as ClassicVaultTemplate,
  ClassicStrategy as ClassicStrategyTemplate,
  ClassicStrategyStratHarvest0 as ClassicStrategyStratHarvest0Template,
  ClassicStrategyStratHarvest1 as ClassicStrategyStratHarvest1Template,
  ClassicBoost as ClassicBoostTemplate,
  ClassicErc4626Adapter as ClassicErc4626AdapterTemplate,
} from "../../generated/templates"
import {
  getClassic,
  getClassicBoost,
  getClassicErc4626Adapter,
  getClassicStrategy,
  getClassicVault,
  hasClassicBeenRemoved,
  isClassicInitialized,
  removeClassicAndDependencies,
} from "./entity/classic"
import { Classic } from "../../generated/schema"
import { getAndSaveTransaction } from "../common/entity/transaction"
import { fetchAndSaveTokenData } from "../common/utils/token"
import { PRODUCT_LIFECYCLE_PAUSED, PRODUCT_LIFECYCLE_RUNNING } from "../common/entity/lifecycle"
import { ADDRESS_ZERO } from "../common/utils/address"
import { isClmManager, isClmRewardPool } from "../clm/entity/clm"
import { fetchClassicUnderlyingCLM } from "./utils/classic-data"
import { CLASSIC_STRAT_HARVEST_1_FOR_ADDRESSES, ONLY_KEEP_CLM_CLASSIC_VAULTS } from "../config"
import { detectClassicVaultUnderlyingPlatform, getVaultTokenBreakdown } from "./platform"

export function handleClassicVaultOrStrategyCreated(event: VaultOrStrategyCreated): void {
  const address = event.params.proxy

  const tx = getAndSaveTransaction(event.block, event.transaction)

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
    for (let i = 0; i < CLASSIC_STRAT_HARVEST_1_FOR_ADDRESSES.length; i++) {
      const harvest1ForAddress = CLASSIC_STRAT_HARVEST_1_FOR_ADDRESSES[i]
      if (harvest1ForAddress.equals(address)) {
        ClassicStrategyStratHarvest1Template.create(address)
      } else {
        // most common case
        ClassicStrategyStratHarvest0Template.create(address)
      }
    }
  }
}

export function handleClassicStrategyCreated(event: ClassicStrategyCreated): void {
  const address = event.params.proxy
  log.info("Creating Classic Strategy: {}", [address.toHexString()])

  const tx = getAndSaveTransaction(event.block, event.transaction)

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
  const strategyAddressRes = vaultContract.try_strategy()
  if (strategyAddressRes.reverted) {
    log.error("Failed to fetch strategy address for vault: {}", [vaultAddress.toHexString()])
    return
  }
  const strategyAddress = strategyAddressRes.value

  vault.isInitialized = true
  vault.save()

  classic.strategy = strategyAddress
  classic.save()

  const strategy = getClassicStrategy(strategyAddress)

  // the strategy may or may not be initialized
  // this is a test to know if it is the case
  const strategyContract = ClassicStrategyContract.bind(strategyAddress)
  const strategyVaultAddressRes = strategyContract.try_vault()
  if (strategyVaultAddressRes.reverted) {
    log.error("Failed to fetch vault address for strategy: {}", [strategyAddress.toHexString()])
    return
  }
  const strategyVaultAddress = strategyVaultAddressRes.value

  strategy.isInitialized = !strategyVaultAddress.equals(ADDRESS_ZERO)
  strategy.save()

  // we start watching strategy events
  ClassicStrategyTemplate.create(strategyAddress)

  log.info("handleClassicVaultInitialized: ClassicVault {} initialized with strategy {} on block {}", [
    vaultAddress.toHexString(),
    strategyAddress.toHexString(),
    event.block.number.toString(),
  ])

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
  const vaultAddressRes = strategyContract.try_vault()
  if (vaultAddressRes.reverted) {
    log.error("Failed to fetch vault address for strategy: {}", [strategyAddress.toHexString()])
    return
  }
  const vaultAddress = vaultAddressRes.value

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

  const underlyingTokenAddressRes = vaultContract.try_want()
  if (underlyingTokenAddressRes.reverted) {
    log.error("Failed to fetch underlying token address for Classic: {}", [vaultAddress.toHexString()])
    return
  }
  const underlyingTokenAddress = underlyingTokenAddressRes.value

  const isClmUnderlying = isClmRewardPool(underlyingTokenAddress) || isClmManager(underlyingTokenAddress)
  if (!isClmUnderlying && ONLY_KEEP_CLM_CLASSIC_VAULTS) {
    log.info("Underlying token address is not related to clm, removing: {}", [underlyingTokenAddress.toHexString()])
    removeClassicAndDependencies(classic)
    return
  }

  const vaultSharesToken = fetchAndSaveTokenData(vaultAddress)
  const underlyingToken = fetchAndSaveTokenData(underlyingTokenAddress)

  classic.vaultSharesToken = vaultSharesToken.id
  classic.underlyingToken = underlyingToken.id
  classic.lifecycle = PRODUCT_LIFECYCLE_RUNNING
  classic.underlyingPlatform = detectClassicVaultUnderlyingPlatform(classic)
  classic.save()

  const clm = fetchClassicUnderlyingCLM(classic)
  if (clm == null) {
    if (ONLY_KEEP_CLM_CLASSIC_VAULTS) {
      log.error("Failed to fetch CLM data for Classic: {}", [classic.id.toHexString()])
      removeClassicAndDependencies(classic)
    } else {
      const breakdown = getVaultTokenBreakdown(classic)
      const underlyingBreakdownTokens = new Array<Bytes>()
      const underlyingBreakdownTokensOrder = new Array<Bytes>()
      for (let i = 0; i < breakdown.length; i++) {
        underlyingBreakdownTokens.push(breakdown[i].tokenAddress)
        underlyingBreakdownTokensOrder.push(breakdown[i].tokenAddress)
      }
      classic.underlyingBreakdownTokens = underlyingBreakdownTokens
      classic.underlyingBreakdownTokensOrder = underlyingBreakdownTokensOrder
      classic.save()
    }
  } else {
    classic.underlyingBreakdownTokens = [clm.underlyingToken0, clm.underlyingToken1]
    classic.underlyingBreakdownTokensOrder = [clm.underlyingToken0, clm.underlyingToken1]
    classic.save()
  }
}

export function handleClassicStrategyPaused(event: ClassicStrategyPaused): void {
  const strategyAddress = event.address
  log.debug("Strategy paused: {}", [strategyAddress.toHexString()])

  const strategy = getClassicStrategy(strategyAddress)
  let classic = getClassic(strategy.vault)
  if (!isClassicInitialized(classic)) {
    log.warning("Classic vault {} is not initialized, ignoring handleClassicStrategyPaused", [classic.id.toHexString()])
    return
  }
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring handleClassicStrategyPaused", [classic.id.toHexString()])
    return
  }

  classic.lifecycle = PRODUCT_LIFECYCLE_PAUSED
  classic.save()
}

export function handleClassicStrategyUnpaused(event: ClassicStrategyUnpaused): void {
  const strategyAddress = event.address
  log.debug("Strategy unpaused: {}", [strategyAddress.toHexString()])

  const strategy = getClassicStrategy(strategyAddress)
  let classic = getClassic(strategy.vault)
  if (!isClassicInitialized(classic)) {
    log.warning("Classic vault {} is not initialized, ignoring handleClassicStrategyUnpaused", [
      classic.id.toHexString(),
    ])
    return
  }
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring handleClassicStrategyUnpaused", [classic.id.toHexString()])
    return
  }
  classic.lifecycle = PRODUCT_LIFECYCLE_RUNNING
  classic.save()
}

export function handleClassicVaultUpgradeStrategy(event: ClassicVaultUpgradeStrategy): void {
  const vaultAddress = event.address
  const classic = getClassic(vaultAddress)
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring handleClassicVaultUpgradeStrategy", [
      classic.id.toHexString(),
    ])
    return
  }

  const newStrategyAddress = event.params.implementation
  const oldStrategyAddress = classic.strategy
  classic.strategy = newStrategyAddress
  classic.save()

  // create the new strategy entity
  const newStrategy = getClassicStrategy(newStrategyAddress)
  const newStrategyContract = ClassicStrategyContract.bind(newStrategyAddress)
  let newStrategyInitialized = false
  const vaultAddressRes = newStrategyContract.try_vault()
  if (!vaultAddressRes.reverted && vaultAddressRes.value.equals(vaultAddress)) {
    newStrategyInitialized = true
  }
  newStrategy.isInitialized = newStrategyInitialized
  newStrategy.vault = classic.id
  newStrategy.classic = classic.id
  if (newStrategy.createdWith.equals(ADDRESS_ZERO)) {
    const tx = getAndSaveTransaction(event.block, event.transaction)
    newStrategy.createdWith = tx.id
  }
  newStrategy.save()

  // we start watching the new strategy events
  ClassicStrategyTemplate.create(newStrategyAddress)

  // make sure we deprecated the old strategy
  // so events are ignored
  if (!oldStrategyAddress.equals(ADDRESS_ZERO)) {
    const oldStrategy = getClassicStrategy(oldStrategyAddress)
    oldStrategy.isInitialized = false
    oldStrategy.vault = ADDRESS_ZERO
    oldStrategy.classic = ADDRESS_ZERO
    oldStrategy.save()
  }

  const vault = getClassicVault(vaultAddress)
  if (!isClassicInitialized(classic) && newStrategy.isInitialized && vault.isInitialized) {
    fetchInitialClassicDataAndSave(classic)
  }
}

export function handleClassicBoostCreated(event: ClassicBoostDeployed): void {
  const boostAddress = event.params.boost
  log.info("Creating Classic Boost: {}", [boostAddress.toHexString()])

  const boost = getClassicBoost(boostAddress)
  boost.save()

  ClassicBoostTemplate.create(boostAddress)
}

export function handleClassicBoostInitialized(event: ClassicBoostInitialized): void {
  const boostAddress = event.address
  log.debug("Boost initialized: {}", [boostAddress.toHexString()])

  const boostContract = ClassicBoostContract.bind(boostAddress)
  const rewardTokenAddressRes = boostContract.try_rewardToken()
  if (rewardTokenAddressRes.reverted) {
    log.error("Failed to fetch reward token address for Classic Boost: {}", [boostAddress.toHexString()])
    return
  }
  const rewardTokenAddress = rewardTokenAddressRes.value
  const rewardToken = fetchAndSaveTokenData(rewardTokenAddress)

  const stakedTokenAddressRes = boostContract.try_stakedToken()
  if (stakedTokenAddressRes.reverted) {
    log.error("Failed to fetch staked token address for Classic Boost: {}", [boostAddress.toHexString()])
    return
  }
  const stakedTokenAddress = stakedTokenAddressRes.value

  const classic = getClassic(stakedTokenAddress)
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring handleClassicBoostInitialized", [classic.id.toHexString()])
    return
  }

  const boost = getClassicBoost(boostAddress)
  boost.isInitialized = true
  boost.rewardToken = rewardToken.id
  boost.classic = classic.id
  boost.save()

  const currentRewardTokenAddresses = classic.boostRewardTokensOrder
  let foundToken = false
  for (let i = 0; i < currentRewardTokenAddresses.length; i++) {
    if (currentRewardTokenAddresses[i].equals(rewardTokenAddress)) {
      foundToken = true
      break
    }
  }

  if (!foundToken) {
    const boostRewardTokens = classic.boostRewardTokens
    const boostRewardTokensOrder = classic.boostRewardTokensOrder

    boostRewardTokens.push(rewardTokenAddress)
    boostRewardTokensOrder.push(rewardTokenAddress)

    classic.boostRewardTokens = boostRewardTokens
    classic.boostRewardTokensOrder = boostRewardTokensOrder

    classic.save()
  }
}

export function handleClassicErc4626AdapterCreated(event: ClassicErc4626AdapterCreated): void {
  const erc4626AdapterAddress = event.params.proxy
  log.info("Creating Classic Erc4626 Adapter: {}", [erc4626AdapterAddress.toHexString()])

  const erc4626Adapter = getClassicErc4626Adapter(erc4626AdapterAddress)

  // check if the erc4626 adapter is already initialized
  const erc4626AdapterContract = ClassicErc4626AdapterContract.bind(erc4626AdapterAddress)
  const vaultAddressRes = erc4626AdapterContract.try_vault()
  if (!vaultAddressRes.reverted && !vaultAddressRes.value.equals(ADDRESS_ZERO)) {
    erc4626Adapter.isInitialized = true
  } else {
    erc4626Adapter.isInitialized = false
  }
  erc4626Adapter.save()

  ClassicErc4626AdapterTemplate.create(erc4626AdapterAddress)
}

export function handleClassicErc4626AdapterInitialized(event: ClassicErc4626AdapterInitialized): void {
  const erc4626AdapterAddress = event.address
  log.debug("Erc4626 Adapter initialized: {}", [erc4626AdapterAddress.toHexString()])

  fetchAndSaveTokenData(erc4626AdapterAddress)

  const erc4626AdapterContract = ClassicErc4626AdapterContract.bind(erc4626AdapterAddress)
  const vaultAddressRes = erc4626AdapterContract.try_vault()
  if (vaultAddressRes.reverted) {
    log.error("Failed to fetch vault address for Classic Erc4626 Adapter: {}", [erc4626AdapterAddress.toHexString()])
    return
  }
  const vaultAddress = vaultAddressRes.value
  const classic = getClassic(vaultAddress)
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring handleClassicErc4626AdapterInitialized", [
      classic.id.toHexString(),
    ])
    return
  }

  const tx = getAndSaveTransaction(event.block, event.transaction)

  const erc4626Adapter = getClassicErc4626Adapter(erc4626AdapterAddress)
  erc4626Adapter.isInitialized = true
  erc4626Adapter.vault = classic.id
  erc4626Adapter.classic = classic.id
  if (erc4626Adapter.createdWith.equals(ADDRESS_ZERO)) {
    erc4626Adapter.createdWith = tx.id
  }
  erc4626Adapter.save()

  const currentErc4626AdapterAddresses = classic.erc4626AdapterTokensOrder
  let foundToken = false
  for (let i = 0; i < currentErc4626AdapterAddresses.length; i++) {
    if (currentErc4626AdapterAddresses[i].equals(erc4626AdapterAddress)) {
      foundToken = true
      break
    }
  }

  if (!foundToken) {
    const erc4626AdapterTokens = classic.erc4626AdapterTokens
    const erc4626AdapterTokensOrder = classic.erc4626AdapterTokensOrder

    erc4626AdapterTokens.push(erc4626AdapterAddress)
    erc4626AdapterTokensOrder.push(erc4626AdapterAddress)

    classic.erc4626AdapterTokens = erc4626AdapterTokens
    classic.erc4626AdapterTokensOrder = erc4626AdapterTokensOrder

    classic.save()
  }
}
