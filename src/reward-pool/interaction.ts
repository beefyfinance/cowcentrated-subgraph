import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts"
import {
  Transfer as RewardPoolTransferEvent,
  RewardPaid as RewardPoolRewardPaidEvent,
} from "../../generated/templates/RewardPool/RewardPool"
import { getTransaction } from "../common/entity/transaction"
import { getInvestor } from "../common/entity/investor"
import { getRewardPoolPosition } from "./entity/position"
import { RewardPool, RewardPoolPositionInteraction } from "../../generated/schema"
import { BURN_ADDRESS, SHARE_TOKEN_MINT_ADDRESS } from "../config"
import { ZERO_BI } from "../common/utils/decimal"
import { getEventIdentifier } from "../common/utils/event"
import { getRewardPool, isRewardPoolInitialized } from "./entity/reward-pool"
import { fetchRewardPoolData, updateRewardPoolDataAndSnapshots } from "./util/reward-pool-data"

export function handleRewardPoolTransfer(event: RewardPoolTransferEvent): void {
  // sending to self
  if (event.params.from.equals(event.params.to)) {
    return
  }

  // transfering nothing
  if (event.params.value.equals(ZERO_BI)) {
    return
  }

  const rewardPool = getRewardPool(event.address)

  // don't store transfers to/from the share token mint address
  if (!event.params.from.equals(SHARE_TOKEN_MINT_ADDRESS) && !event.params.from.equals(BURN_ADDRESS)) {
    updateUserPosition(rewardPool, event, event.params.from, event.params.value.neg(), [])
  }

  if (!event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS) && !event.params.to.equals(BURN_ADDRESS)) {
    updateUserPosition(rewardPool, event, event.params.to, event.params.value, [])
  }
}

export function handleRewardPoolRewardPaid(event: RewardPoolRewardPaidEvent): void {
  const rewardPool = getRewardPool(event.address)

  const rewardTokensAddresses = rewardPool.rewardTokensOrder
  const rewardBalancesDelta = new Array<BigInt>()
  for (let i = 0; i < rewardTokensAddresses.length; i++) {
    if (rewardTokensAddresses[i].equals(event.params.reward)) {
      rewardBalancesDelta.push(event.params.amount)
    } else {
      rewardBalancesDelta.push(ZERO_BI)
    }
  }

  updateUserPosition(rewardPool, event, event.params.user, ZERO_BI, rewardBalancesDelta)
}

function updateUserPosition(
  rewardPool: RewardPool,
  event: ethereum.Event,
  investorAddress: Address,
  rewardPoolBalanceDelta: BigInt,
  rewardBalancesDelta: Array<BigInt>,
): void {
  if (!isRewardPoolInitialized(rewardPool.id)) {
    return
  }

  const investor = getInvestor(investorAddress)
  const position = getRewardPoolPosition(rewardPool, investor)

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain and update rewardPool
  const rewardPoolData = fetchRewardPoolData(rewardPool)
  rewardPool = updateRewardPoolDataAndSnapshots(rewardPool, rewardPoolData, event.block.timestamp)

  ///////
  // investor
  investor.save()

  ///////
  // investor position
  if (position.rewardPoolBalance.equals(ZERO_BI)) {
    position.createdWith = event.transaction.hash
  }

  position.rewardPoolBalance = position.rewardPoolBalance.plus(rewardPoolBalanceDelta)
  position.totalBalance = position.rewardPoolBalance
  position.save()

  ///////
  // interaction
  const isSharesTransfer = !rewardPoolBalanceDelta.equals(ZERO_BI)
  const isRewardClaim = rewardBalancesDelta.some((delta) => !delta.equals(ZERO_BI))

  // if both shares and reward pool are transferred, we will create two interactions
  let interactionId = investor.id.concat(getEventIdentifier(event))
  if (isSharesTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(0))
  } else if (isRewardClaim) {
    interactionId = interactionId.concat(Bytes.fromI32(1))
  }
  const interaction = new RewardPoolPositionInteraction(interactionId)
  interaction.rewardPool = rewardPool.id
  interaction.investor = investor.id
  interaction.investorPosition = position.id
  interaction.createdWith = event.transaction.hash
  interaction.blockNumber = event.block.number
  interaction.timestamp = event.block.timestamp
  if (isSharesTransfer) {
    interaction.type = rewardPoolBalanceDelta.gt(ZERO_BI) ? "REWARD_POOL_DEPOSIT" : "REWARD_POOL_WITHDRAW"
  } else if (isRewardClaim) {
    interaction.type = "REWARD_CLAIM"
  }

  interaction.rewardPoolBalance = position.rewardPoolBalance
  interaction.totalBalance = position.totalBalance
  interaction.rewardPoolBalanceDelta = rewardPoolBalanceDelta

  // set the underlying balances at the time of the transaction
  interaction.underlyingBalance = ZERO_BI
  interaction.underlyingBalanceDelta = ZERO_BI
  if (!rewardPoolData.rewardPoolTotalSupply.equals(ZERO_BI)) {
    interaction.underlyingBalance = interaction.underlyingBalance.plus(
      rewardPoolData.underlyingTokenBalance.times(position.totalBalance).div(rewardPoolData.rewardPoolTotalSupply),
    )

    interaction.underlyingBalanceDelta = interaction.underlyingBalanceDelta.plus(
      rewardPoolData.underlyingTokenBalance.times(rewardPoolBalanceDelta).div(rewardPoolData.rewardPoolTotalSupply),
    )
  }
  interaction.underlyingToNativePrice = rewardPoolData.underlyingToNativePrice
  interaction.rewardToNativePrices = rewardPoolData.rewardToNativePrices
  interaction.nativeToUSDPrice = rewardPoolData.nativeToUSDPrice
  interaction.save()
}
