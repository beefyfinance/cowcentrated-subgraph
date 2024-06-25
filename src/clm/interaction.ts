import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts"
import { Transfer as ClmManagerTransferEvent } from "../../generated/templates/ClmManager/ClmManager"
import {
  Transfer as RewardPoolTransferEvent,
  RewardPaid as RewardPoolRewardPaidEvent,
} from "../../generated/templates/ClmRewardPool/RewardPool"
import { getClmRewardPool, getCLM, isClmInitialized } from "./entity/clm"
import { getTransaction } from "../common/entity/transaction"
import { getInvestor } from "../common/entity/investor"
import { getClmPosition } from "./entity/position"
import { CLM, ClmPositionInteraction } from "../../generated/schema"
import { BURN_ADDRESS, SHARE_TOKEN_MINT_ADDRESS } from "../config"
import { ZERO_BI } from "../common/utils/decimal"
import { fetchCLMData, updateCLMDataAndSnapshots } from "./utils/clm-data"
import { getEventIdentifier } from "../common/utils/event"

export function handleClmManagerTransfer(event: ClmManagerTransferEvent): void {
  // sending to self
  if (event.params.from.equals(event.params.to)) {
    return
  }

  // transfering nothing
  if (event.params.value.equals(ZERO_BI)) {
    return
  }

  const clm = getCLM(event.address)
  const managerAddress = clm.manager
  const rewardPoolAddress = clm.rewardPoolToken

  // don't store transfers to/from the share token mint address
  if (
    !event.params.from.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.from.equals(BURN_ADDRESS) &&
    !event.params.from.equals(managerAddress) &&
    !event.params.from.equals(rewardPoolAddress)
  ) {
    updateUserPosition(clm, event, event.params.from, event.params.value.neg(), ZERO_BI, [])
  }

  if (
    !event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.to.equals(BURN_ADDRESS) &&
    !event.params.to.equals(managerAddress) &&
    !event.params.to.equals(rewardPoolAddress)
  ) {
    updateUserPosition(clm, event, event.params.to, event.params.value, ZERO_BI, [])
  }
}

export function handleRewardPoolTransfer(event: RewardPoolTransferEvent): void {
  // sending to self
  if (event.params.from.equals(event.params.to)) {
    return
  }

  // transfering nothing
  if (event.params.value.equals(ZERO_BI)) {
    return
  }

  const rewardPool = getClmRewardPool(event.address)
  const clm = getCLM(rewardPool.clm)
  const managerAddress = clm.manager
  const rewardPoolAddress = clm.rewardPoolToken

  // don't store transfers to/from the share token mint address or to self
  if (
    !event.params.from.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.from.equals(BURN_ADDRESS) &&
    !event.params.to.equals(managerAddress) &&
    !event.params.to.equals(rewardPoolAddress)
  ) {
    updateUserPosition(clm, event, event.params.from, ZERO_BI, event.params.value.neg(), [])
  }

  if (
    !event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.to.equals(BURN_ADDRESS) &&
    !event.params.to.equals(managerAddress) &&
    !event.params.to.equals(rewardPoolAddress)
  ) {
    updateUserPosition(clm, event, event.params.to, ZERO_BI, event.params.value, [])
  }
}

export function handleRewardPoolRewardPaid(event: RewardPoolRewardPaidEvent): void {
  const rewardPool = getClmRewardPool(event.address)
  const clm = getCLM(rewardPool.clm)

  const rewardTokens = clm.rewardTokens
  const rewardBalancesDelta = new Array<BigInt>()
  for (let i = 0; i < rewardTokens.length; i++) {
    if (clm.rewardTokens[i].equals(event.params.reward)) {
      rewardBalancesDelta.push(event.params.amount)
    } else {
      rewardBalancesDelta.push(ZERO_BI)
    }
  }

  updateUserPosition(clm, event, event.params.user, ZERO_BI, ZERO_BI, rewardBalancesDelta)
}

function updateUserPosition(
  clm: CLM,
  event: ethereum.Event,
  investorAddress: Address,
  managerBalanceDelta: BigInt,
  rewardPoolBalanceDelta: BigInt,
  rewardBalancesDelta: Array<BigInt>,
): void {
  if (!isClmInitialized(clm)) {
    return
  }

  const investor = getInvestor(investorAddress)
  const position = getClmPosition(clm, investor)

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain and update clm
  const clmData = fetchCLMData(clm)
  clm = updateCLMDataAndSnapshots(clm, clmData, event.block.timestamp)

  ///////
  // investor
  investor.save()

  ///////
  // investor position
  if (position.managerBalance.equals(ZERO_BI) && position.rewardPoolBalance.equals(ZERO_BI)) {
    position.createdWith = event.transaction.hash
  }
  position.managerBalance = position.managerBalance.plus(managerBalanceDelta)
  position.rewardPoolBalance = position.rewardPoolBalance.plus(rewardPoolBalanceDelta)
  position.totalBalance = position.managerBalance.plus(position.rewardPoolBalance)
  position.save()

  ///////
  // interaction
  const isSharesTransfer = !managerBalanceDelta.equals(ZERO_BI)
  const isRewardPoolTransfer = !rewardPoolBalanceDelta.equals(ZERO_BI)
  const isRewardClaim = rewardBalancesDelta.some((delta) => !delta.equals(ZERO_BI))

  // if both shares and reward pool are transferred, we will create two interactions
  let interactionId = investor.id.concat(getEventIdentifier(event))
  if (isSharesTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(0))
  } else if (isRewardPoolTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(1))
  } else if (isRewardClaim) {
    interactionId = interactionId.concat(Bytes.fromI32(2))
  }
  const interaction = new ClmPositionInteraction(interactionId)
  interaction.clm = clm.id
  interaction.investor = investor.id
  interaction.investorPosition = position.id
  interaction.createdWith = event.transaction.hash
  interaction.blockNumber = event.block.number
  interaction.timestamp = event.block.timestamp
  if (isSharesTransfer) {
    interaction.type = managerBalanceDelta.gt(ZERO_BI) ? "MANAGER_DEPOSIT" : "MANAGER_WITHDRAW"
  } else if (isRewardPoolTransfer) {
    interaction.type = rewardPoolBalanceDelta.gt(ZERO_BI) ? "REWARD_POOL_STAKE" : "REWARD_POOL_UNSTAKE"
  } else if (isRewardClaim) {
    interaction.type = "REWARD_POOL_CLAIM"
  }

  interaction.managerBalance = position.managerBalance
  interaction.rewardPoolBalance = position.rewardPoolBalance
  interaction.totalBalance = position.totalBalance
  interaction.managerBalanceDelta = managerBalanceDelta
  interaction.rewardPoolBalanceDelta = rewardPoolBalanceDelta
  interaction.rewardBalancesDelta = rewardBalancesDelta

  interaction.underlyingBalance0 = ZERO_BI
  interaction.underlyingBalance1 = ZERO_BI
  interaction.underlyingBalance0Delta = ZERO_BI
  interaction.underlyingBalance1Delta = ZERO_BI

  // set the underlying balances at the time of the transaction
  if (!clmData.managerTotalSupply.equals(ZERO_BI)) {
    interaction.underlyingBalance0 = interaction.underlyingBalance0.plus(
      clmData.token0Balance.times(position.totalBalance).div(clmData.managerTotalSupply),
    )
    interaction.underlyingBalance1 = interaction.underlyingBalance1.plus(
      clmData.token1Balance.times(position.totalBalance).div(clmData.managerTotalSupply),
    )

    // assumption: 1 rewardPool token === 1 manager token
    const managerBalanceDeltaToAccountFor = isSharesTransfer ? managerBalanceDelta : rewardPoolBalanceDelta
    interaction.underlyingBalance0Delta = interaction.underlyingBalance0Delta.plus(
      clmData.token0Balance.times(managerBalanceDeltaToAccountFor).div(clmData.managerTotalSupply),
    )
    interaction.underlyingBalance1Delta = interaction.underlyingBalance1Delta.plus(
      clmData.token1Balance.times(managerBalanceDeltaToAccountFor).div(clmData.managerTotalSupply),
    )
  }
  interaction.token0ToNativePrice = clmData.token0ToNativePrice
  interaction.token1ToNativePrice = clmData.token1ToNativePrice
  interaction.outputToNativePrices = clmData.outputToNativePrices
  interaction.rewardToNativePrices = clmData.rewardToNativePrices
  interaction.nativeToUSDPrice = clmData.nativeToUSDPrice
  interaction.save()
}
