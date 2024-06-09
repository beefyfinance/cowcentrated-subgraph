import { Address } from "@graphprotocol/graph-ts"
import { CLM, CLManager } from "../../generated/schema"
import {
  CLManager as CLManagerContract,
  Initialized as CLManagerInitialized,
} from "../../generated/templates/CLManager/CLManager"
import {
  getCLRewardPool,
  getCLStrategy,
  getCLM,
  getCLManager,
  CLM_LIFECYCLE_RUNNING,
  CLM_LIFECYCLE_PAUSED,
} from "./entity/clm"
import { log } from "@graphprotocol/graph-ts"
import {
  CLStrategy as CLStrategyTemplate,
  CLManager as CLManagerTemplate,
  CLRewardPool as CLRewardPoolTemplate,
} from "../../generated/templates"
import { ADDRESS_ZERO } from "../common/utils/address"
import {
  Initialized as CLStrategyInitializedEvent,
  CLStrategy as CLStrategyContract,
  Paused as CLStrategyPausedEvent,
  Unpaused as CLStrategyUnpausedEvent,
} from "../../generated/templates/CLStrategy/CLStrategy"
import { ProxyCreated as CLMManagerCreatedEvent } from "../../generated/CLManagerFactory/CLManagerFactory"
import { GlobalPause as CLStrategyFactoryGlobalPauseEvent } from "../../generated/CLStrategyFactory/CLStrategyFactory"
import { ProxyCreated as RewardPoolCreatedEvent } from "../../generated/RewardPoolFactory/RewardPoolFactory"
import {
  Initialized as RewardPoolInitialized,
  RewardPool as CLRewardPoolContract,
} from "../../generated/RewardPoolFactory/RewardPool"
import { getTransaction } from "../common/entity/transaction"
import { fetchAndSaveTokenData } from "../common/utils/token"
import { getBeefyCLProtocol } from "../common/entity/protocol"

export function handleCLManagerCreated(event: CLMManagerCreatedEvent): void {
  const tx = getTransaction(event.block, event.transaction)
  tx.save()

  const managerAddress = event.params.proxy
  const clm = getCLM(managerAddress)
  clm.save()

  const manager = getCLManager(managerAddress)
  manager.clm = clm.id
  manager.createdWith = tx.id
  manager.isInitialized = false
  manager.save()

  // start indexing the new manager
  CLManagerTemplate.create(managerAddress)

  log.info("handleCLManagerCreated: CLM was {} created on block {}", [
    clm.id.toHexString(),
    event.block.number.toString(),
  ])
}

export function handleCLManagerInitialized(event: CLManagerInitialized): void {
  const managerAddress = event.address

  const managerContract = CLManagerContract.bind(managerAddress)
  const strategyAddress = managerContract.strategy()

  let manager = getCLManager(managerAddress)
  manager.isInitialized = true
  manager.save()

  let clm = getCLM(managerAddress)
  clm.strategy = strategyAddress
  clm.save() // needs to be saved before we can use it in the strategy events

  // we start watching strategy events
  CLStrategyTemplate.create(strategyAddress)

  log.info("handleCLManagerInitialized: CLManager {} initialized with strategy {} on block {}", [
    clm.id.toHexString(),
    clm.strategy.toHexString(),
    event.block.number.toString(),
  ])

  const strategy = getCLStrategy(strategyAddress)
  // the strategy may or may not be initialized
  // this is a test to know if that is the case
  const strategyContract = CLStrategyContract.bind(strategyAddress)
  const strategyPool = strategyContract.pool()
  strategy.isInitialized = !strategyPool.equals(ADDRESS_ZERO)

  if (strategy.isInitialized && manager.isInitialized) {
    fetchInitialCLMDataAndSave(clm)
  }
}

export function handleCLStrategyInitialized(event: CLStrategyInitializedEvent): void {
  const strategyAddress = event.address

  const strategyContract = CLStrategyContract.bind(strategyAddress)
  const managerAddress = strategyContract.vault()

  const clm = getCLM(managerAddress)

  const strategy = getCLStrategy(strategyAddress)
  strategy.manager = managerAddress
  strategy.isInitialized = true
  strategy.save()

  const manager = getCLManager(managerAddress)

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
  const managerContract = CLManagerContract.bind(managerAddress)
  const wants = managerContract.wants()

  const underlyingToken0Address = wants.value0
  const underlyingToken1Address = wants.value1

  const managerToken = fetchAndSaveTokenData(managerAddress)
  const underlyingToken0 = fetchAndSaveTokenData(underlyingToken0Address)
  const underlyingToken1 = fetchAndSaveTokenData(underlyingToken1Address)

  // maaaaybe we have a reward token
  const strategyAddress = Address.fromBytes(clm.strategy)
  const strategyContract = CLStrategyContract.bind(strategyAddress)
  const outputTokenRes = strategyContract.try_output()
  if (!outputTokenRes.reverted) {
    const rewardToken = fetchAndSaveTokenData(outputTokenRes.value)
    clm.rewardToken = rewardToken.id
  }

  clm.managerToken = managerToken.id
  clm.underlyingToken0 = underlyingToken0.id
  clm.underlyingToken1 = underlyingToken1.id
  clm.lifecycle = CLM_LIFECYCLE_RUNNING

  log.info("fetchInitialCLMDataAndSave: CLM {} now running with strategy {}.", [
    clm.id.toHexString(),
    clm.strategy.toHexString(),
  ])
}

export function handleCLStrategyGlobalPause(event: CLStrategyFactoryGlobalPauseEvent): void {
  const protocol = getBeefyCLProtocol()
  const clms = protocol.clms.load()
  for (let i = 0; i < clms.length; i++) {
    const clm = clms[i]
    if (event.params.paused) clm.lifecycle = CLM_LIFECYCLE_PAUSED
    if (!event.params.paused) clm.lifecycle = CLM_LIFECYCLE_RUNNING
    clm.save()
  }
}

export function handleCLStrategyPaused(event: CLStrategyPausedEvent): void {
  const strategy = getCLStrategy(event.address)
  const clm = getCLM(strategy.clm)
  clm.lifecycle = CLM_LIFECYCLE_PAUSED
  clm.save()
}

export function handleCLStrategyUnpaused(event: CLStrategyUnpausedEvent): void {
  const strategy = getCLStrategy(event.address)
  const clm = getCLM(strategy.clm)
  clm.lifecycle = CLM_LIFECYCLE_RUNNING
  clm.save()
}

export function handleRewardPoolCreated(event: RewardPoolCreatedEvent): void {
  const rewardPoolAddress = event.params.proxy

  const rewardPool = getCLRewardPool(rewardPoolAddress)
  rewardPool.isInitialized = false
  rewardPool.save()

  // start indexing the new reward pool
  CLRewardPoolTemplate.create(rewardPoolAddress)
}

export function handleRewardPoolInitialized(event: RewardPoolInitialized): void {
  const rewardPoolAddress = event.address
  const rewardPoolContract = CLRewardPoolContract.bind(rewardPoolAddress)
  const managerAddress = rewardPoolContract.stakedToken()

  const tx = getTransaction(event.block, event.transaction)
  tx.save()

  const rewardPool = getCLRewardPool(rewardPoolAddress)
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
