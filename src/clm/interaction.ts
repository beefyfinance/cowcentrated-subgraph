import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts"
import { Transfer as ClmManagerTransferEvent } from "../../generated/templates/ClmManager/ClmManager"
import {
  Transfer as RewardPoolTransferEvent,
  RewardPaid as RewardPoolRewardPaidEvent,
} from "../../generated/templates/ClmRewardPool/RewardPool"
import { getClmRewardPool, getCLM, isClmInitialized } from "./entity/clm"
import { getAndSaveTransaction } from "../common/entity/transaction"
import { getInvestor } from "../common/entity/investor"
import { getClmPosition } from "./entity/position"
import { CLM, ClmPositionInteraction, ClmRewardPool } from "../../generated/schema"
import { BURN_ADDRESS, SHARE_TOKEN_MINT_ADDRESS } from "../config"
import { ZERO_BI } from "../common/utils/decimal"
import { fetchCLMData, updateCLMDataAndSnapshots } from "./utils/clm-data"
import { getEventIdentifier } from "../common/utils/event"
import { updateClmPositionSnapshotsIfEnabled } from "./utils/position-snapshot"
import { createAndSaveTokenTransfer } from "../common/entity/token"

export function handleClmManagerTransfer(event: ClmManagerTransferEvent): void {
  createAndSaveTokenTransfer(event, event.params.from, event.params.to, event.params.value)
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
  const rewardPoolAddresses = clm.rewardPoolTokensOrder

  let isRewardPoolFrom = false
  let isRewardPoolTo = false
  for (let i = 0; i < rewardPoolAddresses.length; i++) {
    const rewardPoolAddress = rewardPoolAddresses[i]
    if (event.params.from.equals(rewardPoolAddress)) {
      isRewardPoolFrom = true
    }
    if (event.params.to.equals(rewardPoolAddress)) {
      isRewardPoolTo = true
    }
  }

  // don't store transfers to/from the share token mint address
  if (
    !event.params.from.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.from.equals(BURN_ADDRESS) &&
    !event.params.from.equals(managerAddress) &&
    !isRewardPoolFrom
  ) {
    updateUserPositionAndSnapshots(clm, event, event.params.from, event.params.value.neg(), [], [], null)
  }

  if (
    !event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.to.equals(BURN_ADDRESS) &&
    !event.params.to.equals(managerAddress) &&
    !isRewardPoolTo
  ) {
    updateUserPositionAndSnapshots(clm, event, event.params.to, event.params.value, [], [], null)
  }
}

export function handleClmRewardPoolTransfer(event: RewardPoolTransferEvent): void {
  createAndSaveTokenTransfer(event, event.params.from, event.params.to, event.params.value)

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
  if (!isClmInitialized(clm)) {
    log.warning("CLM {} is not initialized, ignoring handleClmRewardPoolTransfer", [clm.id.toHexString()])
    return
  }
  const managerAddress = clm.manager

  const rewardPoolAddresses = clm.rewardPoolTokensOrder
  let isRewardPoolFrom = false
  let isRewardPoolTo = false
  for (let i = 0; i < rewardPoolAddresses.length; i++) {
    const rewardPoolAddress = rewardPoolAddresses[i]
    if (event.params.from.equals(rewardPoolAddress)) {
      isRewardPoolFrom = true
    }
    if (event.params.to.equals(rewardPoolAddress)) {
      isRewardPoolTo = true
    }
  }

  const rewardPoolBalancesDelta = new Array<BigInt>()
  for (let i = 0; i < rewardPoolAddresses.length; i++) {
    if (rewardPoolAddresses[i].equals(event.address)) {
      rewardPoolBalancesDelta.push(event.params.value)
    } else {
      rewardPoolBalancesDelta.push(ZERO_BI)
    }
  }

  // don't store transfers to/from the share token mint address or to self
  if (
    !event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.to.equals(BURN_ADDRESS) &&
    !event.params.to.equals(managerAddress) &&
    !isRewardPoolTo
  ) {
    updateUserPositionAndSnapshots(clm, event, event.params.to, ZERO_BI, rewardPoolBalancesDelta, [], null)
  }

  if (
    !event.params.from.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.from.equals(BURN_ADDRESS) &&
    !event.params.from.equals(managerAddress) &&
    !isRewardPoolFrom
  ) {
    const negRewardPoolBalancesDelta = new Array<BigInt>()
    for (let i = 0; i < rewardPoolBalancesDelta.length; i++) {
      negRewardPoolBalancesDelta.push(rewardPoolBalancesDelta[i].neg())
    }
    updateUserPositionAndSnapshots(clm, event, event.params.from, ZERO_BI, negRewardPoolBalancesDelta, [], null)
  }
}

export function handleClmRewardPoolRewardPaid(event: RewardPoolRewardPaidEvent): void {
  const rewardPool = getClmRewardPool(event.address)
  const clm = getCLM(rewardPool.clm)

  const rewardTokensAddresses = clm.rewardTokensOrder
  const rewardBalancesDelta = new Array<BigInt>()
  for (let i = 0; i < rewardTokensAddresses.length; i++) {
    if (rewardTokensAddresses[i].equals(event.params.reward)) {
      rewardBalancesDelta.push(event.params.amount)
    } else {
      rewardBalancesDelta.push(ZERO_BI)
    }
  }

  updateUserPositionAndSnapshots(clm, event, event.params.user, ZERO_BI, [], rewardBalancesDelta, rewardPool)
}

function updateUserPositionAndSnapshots(
  clm: CLM,
  event: ethereum.Event,
  investorAddress: Address,
  managerBalanceDelta: BigInt,
  rewardPoolBalancesDelta: Array<BigInt>,
  rewardBalancesDelta: Array<BigInt>,
  claimedRewardPool: ClmRewardPool | null,
): void {
  if (!isClmInitialized(clm)) {
    log.warning("CLM {} is not initialized, ignoring updateUserPosition", [clm.id.toHexString()])
    return
  }

  const investor = getInvestor(investorAddress)
  const position = getClmPosition(clm, investor)

  let tx = getAndSaveTransaction(event.block, event.transaction)

  ///////
  // fetch data on chain and update clm
  const clmData = fetchCLMData(clm)
  clm = updateCLMDataAndSnapshots(clm, clmData, event.block.timestamp)

  ///////
  // investor
  investor.save()

  ///////
  // investor position
  let hasPreviousRewardPoolBalance = false
  for (let i = 0; i < rewardPoolBalancesDelta.length; i++) {
    if (rewardPoolBalancesDelta[i].notEqual(ZERO_BI)) {
      hasPreviousRewardPoolBalance = true
      break
    }
  }
  if (position.managerBalance.equals(ZERO_BI) && !hasPreviousRewardPoolBalance) {
    position.createdWith = event.transaction.hash
  }

  position.managerBalance = position.managerBalance.plus(managerBalanceDelta)
  const positionRewardPoolBalances = position.rewardPoolBalances // required by thegraph
  for (let i = 0; i < rewardPoolBalancesDelta.length; i++) {
    if (positionRewardPoolBalances.length <= i) {
      // happens when position is created before the second reward pool is added
      positionRewardPoolBalances.push(ZERO_BI)
    }
    positionRewardPoolBalances[i] = positionRewardPoolBalances[i].plus(rewardPoolBalancesDelta[i])
  }
  position.rewardPoolBalances = positionRewardPoolBalances

  let totalBalance = position.managerBalance
  for (let i = 0; i < positionRewardPoolBalances.length; i++) {
    totalBalance = totalBalance.plus(positionRewardPoolBalances[i])
  }
  position.totalBalance = totalBalance
  position.save()

  ///////
  // interaction
  const isSharesTransfer = !managerBalanceDelta.equals(ZERO_BI)
  const isRewardPoolTransfer = rewardPoolBalancesDelta.length > 0
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
  interaction.logIndex = event.logIndex
  interaction.timestamp = event.block.timestamp
  if (isSharesTransfer) {
    interaction.type = managerBalanceDelta.gt(ZERO_BI) ? "MANAGER_DEPOSIT" : "MANAGER_WITHDRAW"
  } else if (isRewardPoolTransfer) {
    const isRewardPoolStake = rewardPoolBalancesDelta.some((delta) => delta.gt(ZERO_BI))
    interaction.type = isRewardPoolStake ? "CLM_REWARD_POOL_STAKE" : "CLM_REWARD_POOL_UNSTAKE"
  } else if (isRewardClaim) {
    interaction.type = "CLM_REWARD_POOL_CLAIM"
  }

  interaction.managerBalance = position.managerBalance
  interaction.rewardPoolBalances = position.rewardPoolBalances
  interaction.totalBalance = position.totalBalance
  interaction.managerBalanceDelta = managerBalanceDelta
  interaction.rewardPoolBalancesDelta = rewardPoolBalancesDelta
  interaction.rewardBalancesDelta = rewardBalancesDelta
  interaction.claimedRewardPool = claimedRewardPool ? claimedRewardPool.id : null

  interaction.underlyingBalance0 = ZERO_BI
  interaction.underlyingBalance1 = ZERO_BI
  interaction.underlyingBalance0Delta = ZERO_BI
  interaction.underlyingBalance1Delta = ZERO_BI

  // set the underlying balances at the time of the transaction
  if (!clmData.managerTotalSupply.equals(ZERO_BI)) {
    interaction.underlyingBalance0 = interaction.underlyingBalance0.plus(
      clmData.totalUnderlyingAmount0.times(position.totalBalance).div(clmData.managerTotalSupply),
    )
    interaction.underlyingBalance1 = interaction.underlyingBalance1.plus(
      clmData.totalUnderlyingAmount1.times(position.totalBalance).div(clmData.managerTotalSupply),
    )

    // assumption: 1 rewardPool token === 1 manager token
    let totalRewardPoolBalanceDelta = ZERO_BI
    for (let i = 0; i < rewardPoolBalancesDelta.length; i++) {
      totalRewardPoolBalanceDelta = totalRewardPoolBalanceDelta.plus(rewardPoolBalancesDelta[i])
    }
    const positionEquivalentInManagerBalance = managerBalanceDelta.plus(totalRewardPoolBalanceDelta)
    interaction.underlyingBalance0Delta = interaction.underlyingBalance0Delta.plus(
      clmData.totalUnderlyingAmount0.times(positionEquivalentInManagerBalance).div(clmData.managerTotalSupply),
    )
    interaction.underlyingBalance1Delta = interaction.underlyingBalance1Delta.plus(
      clmData.totalUnderlyingAmount1.times(positionEquivalentInManagerBalance).div(clmData.managerTotalSupply),
    )
  }
  interaction.token0ToNativePrice = clmData.token0ToNativePrice
  interaction.token1ToNativePrice = clmData.token1ToNativePrice
  interaction.outputToNativePrices = clmData.outputToNativePrices
  interaction.rewardToNativePrices = clmData.rewardToNativePrices
  interaction.nativeToUSDPrice = clmData.nativeToUSDPrice
  interaction.save()

  // update position snapshots if needed
  updateClmPositionSnapshotsIfEnabled(clm, clmData, position, event.block.timestamp)
}
