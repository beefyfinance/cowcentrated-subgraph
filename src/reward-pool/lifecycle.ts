import { Bytes } from "@graphprotocol/graph-ts"
import { log } from "@graphprotocol/graph-ts"
import { RewardPool as RewardPoolTemplate } from "../../generated/templates"
import { ProxyCreated as RewardPoolCreatedEvent } from "../../generated/RewardPoolFactory/RewardPoolFactory"
import {
  Initialized as RewardPoolInitialized,
  RewardPool as RewardPoolContract,
  AddReward as RewardPoolAddRewardEvent,
  RemoveReward as RewardPoolRemoveRewardEvent,
} from "../../generated/RewardPoolFactory/RewardPool"
import { getTransaction } from "../common/entity/transaction"
import { fetchAndSaveTokenData } from "../common/utils/token"
import { PRODUCT_LIFECYCLE_INITIALIZING, PRODUCT_LIFECYCLE_RUNNING } from "../common/entity/lifecycle"
import { getNullToken } from "../common/entity/token"
import { getRewardPool } from "./entity/reward-pool"
import { isClassicVault } from "../classic/entity/classic"
import { isCLMManager } from "../clm/entity/clm"

export function handleRewardPoolCreated(event: RewardPoolCreatedEvent): void {
  const rewardPoolAddress = event.params.proxy

  const rewardPool = getRewardPool(rewardPoolAddress)
  rewardPool.lifecycle = PRODUCT_LIFECYCLE_INITIALIZING
  rewardPool.save()

  // start indexing the new reward pool
  RewardPoolTemplate.create(rewardPoolAddress)
}

export function handleRewardPoolInitialized(event: RewardPoolInitialized): void {
  const rewardPoolAddress = event.address
  const rewardPoolContract = RewardPoolContract.bind(rewardPoolAddress)
  const stakedTokenAddressRes = rewardPoolContract.try_stakedToken()
  if (stakedTokenAddressRes.reverted) {
    log.error("handleRewardPoolInitialized: staked token address is not available for reward pool {}", [
      rewardPoolAddress.toHexString(),
    ])
    return
  }
  const stakedTokenAddress = stakedTokenAddressRes.value

  const tx = getTransaction(event.block, event.transaction)
  tx.save()

  const rewardPool = getRewardPool(rewardPoolAddress)
  const rewardPoolToken = fetchAndSaveTokenData(rewardPoolAddress)
  const stakedToken = fetchAndSaveTokenData(stakedTokenAddress)
  rewardPool.shareToken = rewardPoolToken.id
  rewardPool.lifecycle = PRODUCT_LIFECYCLE_RUNNING
  rewardPool.createdWith = tx.id
  rewardPool.underlyingToken = stakedToken.id

  // detect if it's a vault or a clm
  if (isClassicVault(stakedToken.id)) {
    rewardPool.classic = stakedToken.id
  } else if (isCLMManager(stakedToken.id)) {
    rewardPool.clm = stakedToken.id
  }
  rewardPool.save()
}

export function handleRewardPoolAddReward(event: RewardPoolAddRewardEvent): void {
  const rewardPoolAddress = event.address
  const rewardPool = getRewardPool(rewardPoolAddress)

  const rewardTokens = rewardPool.rewardTokens
  const rewardTokensOrder = rewardPool.rewardTokensOrder
  rewardTokens.push(event.params.reward)
  rewardTokensOrder.push(event.params.reward)
  rewardPool.rewardTokens = rewardTokens
  rewardPool.rewardTokensOrder = rewardTokensOrder
  rewardPool.save()
}

export function handleRewardPoolRemoveReward(event: RewardPoolRemoveRewardEvent): void {
  const rewardPoolAddress = event.address
  const rewardPool = getRewardPool(rewardPoolAddress)

  const rewardTokenAddresses = rewardPool.rewardTokensOrder
  const tokens = new Array<Bytes>()
  for (let i = 0; i < rewardTokenAddresses.length; i++) {
    if (rewardTokenAddresses[i].equals(event.params.reward)) {
      tokens.push(getNullToken().id)
    } else {
      tokens.push(rewardTokenAddresses[i])
    }
  }
  rewardPool.rewardTokens = tokens
  rewardPool.rewardTokensOrder = tokens
  rewardPool.save()
}
