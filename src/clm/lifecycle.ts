import { Address } from "@graphprotocol/graph-ts"
import { CLM } from "../../generated/schema"
import {
  ClmManager as ClmManagerContract,
  Initialized as ClmManagerInitialized,
} from "../../generated/templates/ClmManager/ClmManager"
import { getClmRewardPool, getClmStrategy, getCLM, getClmManager } from "./entity/clm"
import { log } from "@graphprotocol/graph-ts"
import {
  ClmStrategy as ClmStrategyTemplate,
  ClmManager as ClmManagerTemplate,
  ClmRewardPool as ClmRewardPoolTemplate,
} from "../../generated/templates"
import { ADDRESS_ZERO } from "../common/utils/address"
import {
  Initialized as ClmStrategyInitializedEvent,
  ClmStrategy as ClmStrategyContract,
  Paused as ClmStrategyPausedEvent,
  Unpaused as ClmStrategyUnpausedEvent,
} from "../../generated/templates/ClmStrategy/ClmStrategy"
import { ProxyCreated as CLMManagerCreatedEvent } from "../../generated/ClmManagerFactory/ClmManagerFactory"
import { GlobalPause as ClmStrategyFactoryGlobalPauseEvent } from "../../generated/ClmStrategyFactory/ClmStrategyFactory"
import { ProxyCreated as RewardPoolCreatedEvent } from "../../generated/RewardPoolFactory/RewardPoolFactory"
import {
  Initialized as RewardPoolInitialized,
  RewardPool as ClmRewardPoolContract,
} from "../../generated/RewardPoolFactory/RewardPool"
import { getTransaction } from "../common/entity/transaction"
import { fetchAndSaveTokenData } from "../common/utils/token"
import { getBeefyCLProtocol } from "../common/entity/protocol"
import {
  PRODUCT_LIFECYCLE_INITIALIZING,
  PRODUCT_LIFECYCLE_PAUSED,
  PRODUCT_LIFECYCLE_RUNNING,
} from "../common/entity/lifecycle"

export function handleClmManagerCreated(event: CLMManagerCreatedEvent): void {
  const tx = getTransaction(event.block, event.transaction)
  tx.save()

  const managerAddress = event.params.proxy

  const clm = getCLM(managerAddress)
  clm.manager = managerAddress
  clm.lifecycle = PRODUCT_LIFECYCLE_INITIALIZING
  clm.save()

  const manager = getClmManager(managerAddress)
  manager.clm = clm.id
  manager.createdWith = tx.id
  manager.isInitialized = false
  manager.save()

  // start indexing the new manager
  ClmManagerTemplate.create(managerAddress)

  log.info("handleClmManagerCreated: CLM was {} created on block number {}", [
    clm.id.toHexString(),
    event.block.number.toString(),
  ])
}

export function handleClmManagerInitialized(event: ClmManagerInitialized): void {
  const managerAddress = event.address

  const managerContract = ClmManagerContract.bind(managerAddress)
  const strategyAddressRes = managerContract.try_strategy()
  if (strategyAddressRes.reverted) {
    log.error("handleClmManagerInitialized: Strategy address is not available for CLM {}", [
      managerAddress.toHexString(),
    ])
    return
  }
  const strategyAddress = strategyAddressRes.value

  let clm = getCLM(managerAddress)
  clm.strategy = strategyAddress
  clm.save()

  let manager = getClmManager(managerAddress)
  manager.isInitialized = true
  manager.save()

  let strategy = getClmStrategy(strategyAddress)
  strategy.clm = clm.id
  strategy.manager = manager.id

  // the strategy may or may not be initialized
  // this is a test to know if that is the case
  const strategyContract = ClmStrategyContract.bind(strategyAddress)
  const strategyPoolRes = strategyContract.try_pool()
  if (strategyAddressRes.reverted) {
    log.error("handleClmManagerInitialized: Strategy pool reverted for CLM {}", [managerAddress.toHexString()])
    return
  }
  const strategyPool = strategyPoolRes.value

  strategy.isInitialized = !strategyPool.equals(ADDRESS_ZERO)
  strategy.save()

  // we start watching strategy events
  ClmStrategyTemplate.create(strategyAddress)

  log.info("handleClmManagerInitialized: ClmManager {} initialized with strategy {} on block {}", [
    clm.id.toHexString(),
    clm.strategy.toHexString(),
    event.block.number.toString(),
  ])

  if (strategy.isInitialized && manager.isInitialized) {
    fetchInitialCLMDataAndSave(clm)
  }
}

export function handleClmStrategyInitialized(event: ClmStrategyInitializedEvent): void {
  const strategyAddress = event.address

  const strategyContract = ClmStrategyContract.bind(strategyAddress)
  const managerAddressRes = strategyContract.try_vault()
  if (managerAddressRes.reverted) {
    log.error("handleClmStrategyInitialized: Manager address is not available for strategy {}", [
      strategyAddress.toHexString(),
    ])
    return
  }
  const managerAddress = managerAddressRes.value

  const clm = getCLM(managerAddress)
  clm.strategy = strategyAddress
  clm.save()

  const strategy = getClmStrategy(strategyAddress)
  strategy.manager = managerAddress
  strategy.isInitialized = true
  strategy.save()

  const manager = getClmManager(managerAddress)

  log.info("handleStrategyInitialized: Strategy {} initialized for CLM {} on block {}", [
    strategy.id.toHexString(),
    clm.id.toHexString(),
    event.block.number.toString(),
  ])

  if (strategy.isInitialized && manager.isInitialized) {
    fetchInitialCLMDataAndSave(clm)
  }
}

/**
 * Initialize the CLM data.
 * Call this when both the manager and the strategy are initialized.
 */
function fetchInitialCLMDataAndSave(clm: CLM): void {
  const managerAddress = Address.fromBytes(clm.manager)
  const managerContract = ClmManagerContract.bind(managerAddress)
  const wantsRes = managerContract.try_wants()
  if (wantsRes.reverted) {
    log.error("fetchInitialCLMDataAndSave: Wants reverted for CLM {}", [clm.id.toHexString()])
    return
  }
  const wants = wantsRes.value

  const underlyingToken0Address = wants.value0
  const underlyingToken1Address = wants.value1

  const managerToken = fetchAndSaveTokenData(managerAddress)
  const underlyingToken0 = fetchAndSaveTokenData(underlyingToken0Address)
  const underlyingToken1 = fetchAndSaveTokenData(underlyingToken1Address)

  // maaaaybe we have a reward token
  const strategyAddress = Address.fromBytes(clm.strategy)
  const strategyContract = ClmStrategyContract.bind(strategyAddress)
  const outputTokenRes = strategyContract.try_output()
  if (outputTokenRes) {
    const rewardToken = fetchAndSaveTokenData(outputTokenRes.value)
    clm.rewardToken = rewardToken.id
  }

  clm.managerToken = managerToken.id
  clm.underlyingToken0 = underlyingToken0.id
  clm.underlyingToken1 = underlyingToken1.id
  clm.lifecycle = PRODUCT_LIFECYCLE_RUNNING
  clm.save()

  log.info("fetchInitialCLMDataAndSave: CLM {} now running with strategy {}.", [
    clm.id.toHexString(),
    clm.strategy.toHexString(),
  ])
}

export function handleClmStrategyGlobalPause(event: ClmStrategyFactoryGlobalPauseEvent): void {
  const protocol = getBeefyCLProtocol()
  const clms = protocol.clms.load()
  for (let i = 0; i < clms.length; i++) {
    const clm = clms[i]
    if (event.params.paused) clm.lifecycle = PRODUCT_LIFECYCLE_PAUSED
    if (!event.params.paused) clm.lifecycle = PRODUCT_LIFECYCLE_RUNNING
    clm.save()
  }
}

export function handleClmStrategyPaused(event: ClmStrategyPausedEvent): void {
  const strategy = getClmStrategy(event.address)
  const clm = getCLM(strategy.clm)
  clm.lifecycle = PRODUCT_LIFECYCLE_PAUSED
  clm.save()
}

export function handleClmStrategyUnpaused(event: ClmStrategyUnpausedEvent): void {
  const strategy = getClmStrategy(event.address)
  const clm = getCLM(strategy.clm)
  clm.lifecycle = PRODUCT_LIFECYCLE_RUNNING
  clm.save()
}

export function handleRewardPoolCreated(event: RewardPoolCreatedEvent): void {
  const rewardPoolAddress = event.params.proxy

  const rewardPool = getClmRewardPool(rewardPoolAddress)
  rewardPool.isInitialized = false
  rewardPool.save()

  // start indexing the new reward pool
  ClmRewardPoolTemplate.create(rewardPoolAddress)
}

export function handleRewardPoolInitialized(event: RewardPoolInitialized): void {
  const rewardPoolAddress = event.address
  const rewardPoolContract = ClmRewardPoolContract.bind(rewardPoolAddress)
  const managerAddressRes = rewardPoolContract.try_stakedToken()
  if (managerAddressRes.reverted) {
    log.error("handleRewardPoolInitialized: Manager address is not available for reward pool {}", [
      rewardPoolAddress.toHexString(),
    ])
    return
  }
  const managerAddress = managerAddressRes.value

  const tx = getTransaction(event.block, event.transaction)
  tx.save()

  const rewardPool = getClmRewardPool(rewardPoolAddress)
  rewardPool.isInitialized = true
  rewardPool.clm = managerAddress
  rewardPool.manager = managerAddress
  rewardPool.createdWith = tx.id
  rewardPool.save()

  const rewardPoolToken = fetchAndSaveTokenData(rewardPoolAddress)

  const clm = getCLM(managerAddress)
  clm.rewardPool = rewardPool.id
  clm.rewardPoolToken = rewardPoolToken.id
  clm.save()

  log.info("handleRewardPoolInitialized: Reward pool {} initialized for CLM {} on block {}", [
    rewardPool.id.toHexString(),
    clm.id.toHexString(),
    event.block.number.toString(),
  ])
}
