import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { Transfer as CLManagerTransferEvent } from "../../generated/templates/CLManager/CLManager"
import { Transfer as RewardPoolTransferEvent } from "../../generated/templates/CLRewardPool/RewardPool"
import { getCLRewardPool, getCLM, isClmInitialized } from "./entity/clm"
import { getTransaction } from "../common/entity/transaction"
import { getInvestor } from "../common/entity/investor"
import { getCLMPosition } from "./entity/position"
import { CLM, CLMPositionInteraction } from "../../generated/schema"
import { BURN_ADDRESS, SHARE_TOKEN_MINT_ADDRESS } from "../config"
import { ZERO_BI } from "../common/utils/decimal"
import { fetchCLMData, updateCLMDataAndSnapshots } from "./utils/clm-data"
import { getEventIdentifier } from "../common/utils/event"

export function handleCLManagerTransfer(event: CLManagerTransferEvent): void {
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
    updateUserPosition(clm, event, event.params.from, event.params.value.neg(), ZERO_BI)
  }

  if (
    !event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.to.equals(BURN_ADDRESS) &&
    !event.params.to.equals(managerAddress) &&
    !event.params.to.equals(rewardPoolAddress)
  ) {
    updateUserPosition(clm, event, event.params.to, event.params.value, ZERO_BI)
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

  const rewardPool = getCLRewardPool(event.address)
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
    updateUserPosition(clm, event, event.params.from, ZERO_BI, event.params.value.neg())
  }

  if (
    !event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.to.equals(BURN_ADDRESS) &&
    !event.params.to.equals(managerAddress) &&
    !event.params.to.equals(rewardPoolAddress)
  ) {
    updateUserPosition(clm, event, event.params.to, ZERO_BI, event.params.value)
  }
}

function updateUserPosition(
  clm: CLM,
  event: ethereum.Event,
  investorAddress: Address,
  managerBalanceDelta: BigInt,
  rewardPoolBalanceDelta: BigInt,
): void {
  if (!isClmInitialized(clm)) {
    return
  }

  const investor = getInvestor(investorAddress)
  const position = getCLMPosition(clm, investor)

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
  position.save()

  ///////
  // interaction
  const isSharesTransfer = !managerBalanceDelta.equals(ZERO_BI)
  const isRewardPoolTransfer = !rewardPoolBalanceDelta.equals(ZERO_BI)

  // if both shares and reward pool are transferred, we need to create two interactions
  let interactionId = investor.id.concat(getEventIdentifier(event))
  if (isSharesTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(0))
  } else if (isRewardPoolTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(1))
  }
  const interaction = new CLMPositionInteraction(interactionId)
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
  }
  interaction.managerBalance = position.managerBalance
  interaction.rewardPoolBalance = position.rewardPoolBalance
  interaction.managerBalanceDelta = managerBalanceDelta
  interaction.rewardPoolBalanceDelta = rewardPoolBalanceDelta

  interaction.underlyingBalance0 = ZERO_BI
  interaction.underlyingBalance1 = ZERO_BI
  interaction.underlyingBalance0Delta = ZERO_BI
  interaction.underlyingBalance1Delta = ZERO_BI
  if (!clmData.managerTotalSupply.equals(ZERO_BI)) {
    interaction.underlyingBalance0 = interaction.underlyingBalance0.plus(
      clmData.token0Balance.times(position.managerBalance).div(clmData.managerTotalSupply),
    )
    interaction.underlyingBalance1 = interaction.underlyingBalance1.plus(
      clmData.token1Balance.times(position.managerBalance).div(clmData.managerTotalSupply),
    )
    interaction.underlyingBalance0Delta = interaction.underlyingBalance0Delta.plus(
      clmData.token0Balance.times(managerBalanceDelta).div(clmData.managerTotalSupply),
    )
    interaction.underlyingBalance1Delta = interaction.underlyingBalance1Delta.plus(
      clmData.token1Balance.times(managerBalanceDelta).div(clmData.managerTotalSupply),
    )
  }
  if (!clmData.rewardPoolTotalSupply.equals(ZERO_BI)) {
    interaction.underlyingBalance0 = interaction.underlyingBalance0.plus(
      clmData.token0Balance.times(position.rewardPoolBalance).div(clmData.rewardPoolTotalSupply),
    )
    interaction.underlyingBalance1 = interaction.underlyingBalance1.plus(
      clmData.token1Balance.times(position.rewardPoolBalance).div(clmData.rewardPoolTotalSupply),
    )
    interaction.underlyingBalance0Delta = interaction.underlyingBalance0Delta.plus(
      clmData.token0Balance.times(rewardPoolBalanceDelta).div(clmData.rewardPoolTotalSupply),
    )
    interaction.underlyingBalance1Delta = interaction.underlyingBalance1Delta.plus(
      clmData.token1Balance.times(rewardPoolBalanceDelta).div(clmData.rewardPoolTotalSupply),
    )
  }
  interaction.token0ToNativePrice = clmData.token0ToNativePrice
  interaction.token1ToNativePrice = clmData.token1ToNativePrice
  interaction.rewardToNativePrice = clmData.rewardToNativePrice
  interaction.nativeToUSDPrice = clmData.nativeToUSDPrice
  interaction.save()
}
