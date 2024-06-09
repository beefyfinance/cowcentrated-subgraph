import { Address } from "@graphprotocol/graph-ts"
import { CLM } from "../../generated/schema"
import {
  ClManager as ClManagerContract,
  Initialized as ClManagerInitialized,
} from "../../generated/templates/ClManager/ClManager"
import {
  getClRewardPool,
  getClStrategy,
  getCLM,
  getClManager,
  CLM_LIFECYCLE_RUNNING,
  CLM_LIFECYCLE_PAUSED,
  CLM_LIFECYCLE_INITIALIZING,
} from "./entity/clm"
import { log } from "@graphprotocol/graph-ts"
import {
  ClStrategy as ClStrategyTemplate,
  ClManager as ClManagerTemplate,
  ClRewardPool as ClRewardPoolTemplate,
} from "../../generated/templates"
import { ADDRESS_ZERO } from "../common/utils/address"
import {
  Initialized as ClStrategyInitializedEvent,
  ClStrategy as ClStrategyContract,
  Paused as ClStrategyPausedEvent,
  Unpaused as ClStrategyUnpausedEvent,
} from "../../generated/templates/ClStrategy/ClStrategy"
import { ProxyCreated as CLMManagerCreatedEvent } from "../../generated/ClManagerFactory/ClManagerFactory"
import { GlobalPause as ClStrategyFactoryGlobalPauseEvent } from "../../generated/ClStrategyFactory/ClStrategyFactory"
import { ProxyCreated as RewardPoolCreatedEvent } from "../../generated/RewardPoolFactory/RewardPoolFactory"
import {
  Initialized as RewardPoolInitialized,
  RewardPool as ClRewardPoolContract,
} from "../../generated/RewardPoolFactory/RewardPool"
import { getTransaction } from "../common/entity/transaction"
import { fetchAndSaveTokenData } from "../common/utils/token"
import { getBeefyCLProtocol } from "../common/entity/protocol"

export function handleClManagerCreated(event: CLMManagerCreatedEvent): void {
  const tx = getTransaction(event.block, event.transaction)
  tx.save()

  const managerAddress = event.params.proxy

  const clm = getCLM(managerAddress)
  clm.manager = managerAddress
  clm.lifecycle = CLM_LIFECYCLE_INITIALIZING
  clm.save()

  const manager = getClManager(managerAddress)
  manager.clm = clm.id
  manager.createdWith = tx.id
  manager.isInitialized = false
  manager.save()

  // start indexing the new manager
  ClManagerTemplate.create(managerAddress)

  log.info("handleClManagerCreated: CLM was {} created on block {}", [
    clm.id.toHexString(),
    event.block.number.toString(),
  ])
}

export function handleClManagerInitialized(event: ClManagerInitialized): void {
  const managerAddress = event.address

  const managerContract = ClManagerContract.bind(managerAddress)
  const strategyAddress = managerContract.strategy()

  let clm = getCLM(managerAddress)
  clm.strategy = strategyAddress
  clm.save()

  let manager = getClManager(managerAddress)
  manager.isInitialized = true
  manager.save()

  let strategy = getClStrategy(strategyAddress)
  strategy.clm = clm.id
  strategy.manager = manager.id

  // the strategy may or may not be initialized
  // this is a test to know if that is the case
  const strategyContract = ClStrategyContract.bind(strategyAddress)
  const strategyPool = strategyContract.pool()
  strategy.isInitialized = !strategyPool.equals(ADDRESS_ZERO)

  strategy.save()

  // we start watching strategy events
  ClStrategyTemplate.create(strategyAddress)

  log.info("handleClManagerInitialized: ClManager {} initialized with strategy {} on block {}", [
    clm.id.toHexString(),
    clm.strategy.toHexString(),
    event.block.number.toString(),
  ])

  if (strategy.isInitialized && manager.isInitialized) {
    fetchInitialCLMDataAndSave(clm)
  }
}

export function handleClStrategyInitialized(event: ClStrategyInitializedEvent): void {
  const strategyAddress = event.address

  const strategyContract = ClStrategyContract.bind(strategyAddress)
  const managerAddress = strategyContract.vault()

  const clm = getCLM(managerAddress)
  clm.strategy = strategyAddress
  clm.save()

  const strategy = getClStrategy(strategyAddress)
  strategy.manager = managerAddress
  strategy.isInitialized = true
  strategy.save()

  const manager = getClManager(managerAddress)

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
  const managerContract = ClManagerContract.bind(managerAddress)
  const wants = managerContract.wants()

  const underlyingToken0Address = wants.value0
  const underlyingToken1Address = wants.value1

  const managerToken = fetchAndSaveTokenData(managerAddress)
  const underlyingToken0 = fetchAndSaveTokenData(underlyingToken0Address)
  const underlyingToken1 = fetchAndSaveTokenData(underlyingToken1Address)

  // maaaaybe we have a reward token
  const strategyAddress = Address.fromBytes(clm.strategy)
  const strategyContract = ClStrategyContract.bind(strategyAddress)
  const outputTokenRes = strategyContract.try_output()
  if (!outputTokenRes.reverted) {
    const rewardToken = fetchAndSaveTokenData(outputTokenRes.value)
    clm.rewardToken = rewardToken.id
  }

  clm.managerToken = managerToken.id
  clm.underlyingToken0 = underlyingToken0.id
  clm.underlyingToken1 = underlyingToken1.id
  clm.lifecycle = CLM_LIFECYCLE_RUNNING
  clm.save()

  log.info("fetchInitialCLMDataAndSave: CLM {} now running with strategy {}.", [
    clm.id.toHexString(),
    clm.strategy.toHexString(),
  ])
}

export function handleClStrategyGlobalPause(event: ClStrategyFactoryGlobalPauseEvent): void {
  const protocol = getBeefyCLProtocol()
  const clms = protocol.clms.load()
  for (let i = 0; i < clms.length; i++) {
    const clm = clms[i]
    if (event.params.paused) clm.lifecycle = CLM_LIFECYCLE_PAUSED
    if (!event.params.paused) clm.lifecycle = CLM_LIFECYCLE_RUNNING
    clm.save()
  }
}

export function handleClStrategyPaused(event: ClStrategyPausedEvent): void {
  const strategy = getClStrategy(event.address)
  const clm = getCLM(strategy.clm)
  clm.lifecycle = CLM_LIFECYCLE_PAUSED
  clm.save()
}

export function handleClStrategyUnpaused(event: ClStrategyUnpausedEvent): void {
  const strategy = getClStrategy(event.address)
  const clm = getCLM(strategy.clm)
  clm.lifecycle = CLM_LIFECYCLE_RUNNING
  clm.save()
}

export function handleRewardPoolCreated(event: RewardPoolCreatedEvent): void {
  const rewardPoolAddress = event.params.proxy

  const rewardPool = getClRewardPool(rewardPoolAddress)
  rewardPool.isInitialized = false
  rewardPool.save()

  // start indexing the new reward pool
  ClRewardPoolTemplate.create(rewardPoolAddress)
}

export function handleRewardPoolInitialized(event: RewardPoolInitialized): void {
  const rewardPoolAddress = event.address
  const rewardPoolContract = ClRewardPoolContract.bind(rewardPoolAddress)
  const managerAddress = rewardPoolContract.stakedToken()

  const tx = getTransaction(event.block, event.transaction)
  tx.save()

  const rewardPool = getClRewardPool(rewardPoolAddress)
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
