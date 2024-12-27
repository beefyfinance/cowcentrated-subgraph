import { Address, Bytes, log } from "@graphprotocol/graph-ts"
import {
  RewardPool as RewardPoolTemplate,
  ClmRewardPool as ClmRewardPoolTemplate,
  ClassicRewardPool as ClassicRewardPoolTemplate,
} from "../../generated/templates"
import { ProxyCreated as RewardPoolCreatedEvent } from "../../generated/RewardPoolFactory/RewardPoolFactory"
import {
  Initialized as RewardPoolInitialized,
  RewardPool as ClmRewardPoolContract,
  AddReward as RewardPoolAddRewardEvent,
  RemoveReward as RewardPoolRemoveRewardEvent,
} from "../../generated/RewardPoolFactory/RewardPool"
import { getAndSaveTransaction } from "../common/entity/transaction"
import { fetchAndSaveTokenData } from "../common/utils/token"
import { ZERO_BI } from "../common/utils/decimal"
import { getCLM, getClmRewardPool, isClmManagerAddress, isClmRewardPool, removeClmRewardPool } from "../clm/entity/clm"
import {
  getClassic,
  getClassicRewardPool,
  hasClassicBeenRemoved,
  isClassicRewardPool,
  isClassicVaultAddress,
  removeClassicRewardPool,
} from "../classic/entity/classic"
import { getNullToken } from "../common/entity/token"

export function handleRewardPoolCreated(event: RewardPoolCreatedEvent): void {
  const rewardPoolAddress = event.params.proxy

  // create both as we don't know which one it will be yet
  const clmRewardPool = getClmRewardPool(rewardPoolAddress)
  clmRewardPool.isInitialized = false
  clmRewardPool.save()

  const classicRewardPool = getClassicRewardPool(rewardPoolAddress)
  classicRewardPool.isInitialized = false
  classicRewardPool.save()

  RewardPoolTemplate.create(rewardPoolAddress)
}

export function handleRewardPoolInitialized(event: RewardPoolInitialized): void {
  const rewardPoolAddress = event.address
  const rewardPoolContract = ClmRewardPoolContract.bind(rewardPoolAddress)
  const stakedTokenAddressRes = rewardPoolContract.try_stakedToken()
  if (stakedTokenAddressRes.reverted) {
    log.error("handleRewardPoolInitialized: Manager address is not available for reward pool {}", [
      rewardPoolAddress.toHexString(),
    ])
    return
  }
  const stakedTokenAddress = stakedTokenAddressRes.value

  const tx = getAndSaveTransaction(event.block, event.transaction)

  const rewardPoolToken = fetchAndSaveTokenData(rewardPoolAddress)

  if (isClmManagerAddress(stakedTokenAddress)) {
    const rewardPool = getClmRewardPool(rewardPoolAddress)
    rewardPool.isInitialized = true
    rewardPool.clm = stakedTokenAddress
    rewardPool.manager = stakedTokenAddress
    rewardPool.createdWith = tx.id
    rewardPool.save()

    const clm = getCLM(stakedTokenAddress)
    const rewardPoolTokens = clm.rewardPoolTokens
    const rewardPoolTokensOrder = clm.rewardPoolTokensOrder
    rewardPoolTokens.push(rewardPoolToken.id)
    rewardPoolTokensOrder.push(rewardPoolToken.id)
    clm.rewardPoolTokens = rewardPoolTokens
    clm.rewardPoolTokensOrder = rewardPoolTokensOrder
    const rewardPoolsTotalSupply = clm.rewardPoolsTotalSupply
    rewardPoolsTotalSupply.push(ZERO_BI)
    clm.rewardPoolsTotalSupply = rewardPoolsTotalSupply
    clm.save()

    removeClassicRewardPool(rewardPoolAddress)
    ClmRewardPoolTemplate.create(rewardPoolAddress)

    log.info("handleRewardPoolInitialized: Reward pool {} initialized for CLM {} on block {}", [
      rewardPool.id.toHexString(),
      clm.id.toHexString(),
      event.block.number.toString(),
    ])
  } else if (isClassicVaultAddress(stakedTokenAddress)) {
    const rewardPool = getClassicRewardPool(rewardPoolAddress)
    rewardPool.isInitialized = true
    rewardPool.classic = stakedTokenAddress
    rewardPool.vault = stakedTokenAddress
    rewardPool.createdWith = tx.id
    rewardPool.save()

    const classic = getClassic(stakedTokenAddress)
    const rewardPoolTokens = classic.rewardPoolTokens
    const rewardPoolTokensOrder = classic.rewardPoolTokensOrder
    rewardPoolTokens.push(rewardPoolToken.id)
    rewardPoolTokensOrder.push(rewardPoolToken.id)
    classic.rewardPoolTokens = rewardPoolTokens
    classic.rewardPoolTokensOrder = rewardPoolTokensOrder
    const rewardPoolsTotalSupply = classic.rewardPoolsTotalSupply
    rewardPoolsTotalSupply.push(ZERO_BI)
    classic.rewardPoolsTotalSupply = rewardPoolsTotalSupply
    classic.save()

    removeClmRewardPool(rewardPoolAddress)
    ClassicRewardPoolTemplate.create(rewardPoolAddress)

    log.info("handleRewardPoolInitialized: Reward pool {} initialized for Classic {} on block {}", [
      rewardPool.id.toHexString(),
      classic.id.toHexString(),
      event.block.number.toString(),
    ])
  } else {
    log.error("handleRewardPoolInitialized: Staked token address {} is not a CLM or Classic vault", [
      stakedTokenAddress.toHexString(),
    ])
    removeClmRewardPool(rewardPoolAddress)
    removeClassicRewardPool(rewardPoolAddress)
    return
  }
}

export function handleClassicRewardPoolAddReward(event: RewardPoolAddRewardEvent): void {
  const rewardPoolAddress = event.address
  if (!isClassicRewardPool(rewardPoolAddress)) {
    log.error("handleClassicRewardPoolAddReward: Reward pool address {} is not a Classic reward pool", [
      rewardPoolAddress.toHexString(),
    ])
    return
  }
  const rewardPool = getClassicRewardPool(rewardPoolAddress)
  const classic = getClassic(rewardPool.classic)
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring handleClassicRewardPoolAddReward", [
      classic.id.toHexString(),
    ])
    return
  }

  const rewardTokens = classic.rewardTokens
  const rewardTokensOrder = classic.rewardTokensOrder
  rewardTokens.push(event.params.reward)
  rewardTokensOrder.push(event.params.reward)
  classic.rewardTokens = rewardTokens
  classic.rewardTokensOrder = rewardTokensOrder
  classic.save()
}

export function handleClmRewardPoolAddReward(event: RewardPoolAddRewardEvent): void {
  const rewardPoolAddress = event.address

  if (!isClmRewardPool(rewardPoolAddress)) {
    log.error("handleClmRewardPoolAddReward: Reward pool address {} is not a CLM reward pool", [
      rewardPoolAddress.toHexString(),
    ])
    return
  }

  const rewardPool = getClmRewardPool(rewardPoolAddress)
  const clm = getCLM(rewardPool.clm)

  const rewardToken = fetchAndSaveTokenData(event.params.reward)

  const rewardTokens = clm.rewardTokens
  const rewardTokensOrder = clm.rewardTokensOrder
  // skip if already added
  for (let i = 0; i < rewardTokensOrder.length; i++) {
    if (rewardTokensOrder[i].equals(rewardToken.id)) {
      return
    }
  }
  rewardTokens.push(rewardToken.id)
  rewardTokensOrder.push(rewardToken.id)
  clm.rewardTokens = rewardTokens
  clm.rewardTokensOrder = rewardTokensOrder
  clm.save()
}

export function handleClassicRewardPoolRemoveReward(event: RewardPoolRemoveRewardEvent): void {
  const rewardPoolAddress = event.address

  if (!isClassicRewardPool(rewardPoolAddress)) {
    log.error("handleClassicRewardPoolRemoveReward: Reward pool address {} is not a Classic reward pool", [
      rewardPoolAddress.toHexString(),
    ])
    return
  }

  const rewardPool = getClassicRewardPool(rewardPoolAddress)
  const classic = getClassic(rewardPool.classic)
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring handleClassicRewardPoolRemoveReward", [
      classic.id.toHexString(),
    ])
    return
  }
  const rewardTokenAddresses = classic.rewardTokensOrder
  const tokens = new Array<Bytes>()
  for (let i = 0; i < rewardTokenAddresses.length; i++) {
    if (rewardTokenAddresses[i].equals(event.params.reward)) {
      tokens.push(getNullToken().id)
    } else {
      tokens.push(rewardTokenAddresses[i])
    }
  }
  classic.rewardTokens = tokens
  classic.rewardTokensOrder = tokens
  classic.save()
}

export function handleClmRewardPoolRemoveReward(event: RewardPoolRemoveRewardEvent): void {
  const rewardPoolAddress = event.address

  if (!isClmRewardPool(rewardPoolAddress)) {
    log.error("handleClmRewardPoolRemoveReward: Reward pool address {} is not a CLM reward pool", [
      rewardPoolAddress.toHexString(),
    ])
    return
  }

  const rewardPool = getClmRewardPool(rewardPoolAddress)
  const clm = getCLM(rewardPool.clm)
  const rewardTokenAddresses = clm.rewardTokensOrder
  const tokens = new Array<Bytes>()
  for (let i = 0; i < rewardTokenAddresses.length; i++) {
    if (rewardTokenAddresses[i].equals(event.params.reward)) {
      tokens.push(getNullToken().id)
    } else {
      tokens.push(rewardTokenAddresses[i])
    }
  }
  clm.rewardTokens = tokens
  clm.rewardTokensOrder = tokens
  clm.save()
}
