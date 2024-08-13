import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts"
import { Transfer as ClassicVaultTransfer } from "../../generated/templates/ClassicVault/ClassicVault"
import {
  Staked as ClassicBoostStaked,
  Withdrawn as ClassicBoostWithdrawn,
  RewardPaid as ClassicBoostRewardPaid,
} from "../../generated/templates/ClassicBoost/ClassicBoost"
import {
  Transfer as RewardPoolTransferEvent,
  RewardPaid as RewardPoolRewardPaidEvent,
} from "../../generated/templates/ClmRewardPool/RewardPool"
import { getTransaction } from "../common/entity/transaction"
import { getInvestor } from "../common/entity/investor"
import { Classic, ClassicPositionInteraction } from "../../generated/schema"
import { BURN_ADDRESS, SHARE_TOKEN_MINT_ADDRESS } from "../config"
import { ZERO_BI } from "../common/utils/decimal"
import { getEventIdentifier } from "../common/utils/event"
import { getClassic, getClassicBoost, getClassicRewardPool, isClassicInitialized } from "./entity/classic"
import { getClassicPosition } from "./entity/position"
import { fetchClassicData, updateClassicDataAndSnapshots } from "./utils/classic-data"

export function handleClassicVaultTransfer(event: ClassicVaultTransfer): void {
  // sending to self
  if (event.params.from.equals(event.params.to)) {
    return
  }

  // transfering nothing
  if (event.params.value.equals(ZERO_BI)) {
    return
  }

  const classic = getClassic(event.address)
  const vaultAddress = classic.vault
  const rewardPoolAddresses = classic.rewardPoolTokensOrder

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
    !event.params.from.equals(vaultAddress) &&
    !isRewardPoolFrom
  ) {
    updateUserPosition(classic, event, event.params.from, event.params.value.neg(), ZERO_BI, [], [], [])
  }

  if (
    !event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.to.equals(BURN_ADDRESS) &&
    !event.params.to.equals(vaultAddress) &&
    !isRewardPoolTo
  ) {
    updateUserPosition(classic, event, event.params.to, event.params.value, ZERO_BI, [], [], [])
  }
}

export function handleClassicBoostStaked(event: ClassicBoostStaked): void {
  const boostAddress = event.address
  const boost = getClassicBoost(boostAddress)
  const classic = getClassic(boost.classic)

  const investorAddress = event.params.user
  const amount = event.params.amount

  updateUserPosition(classic, event, investorAddress, ZERO_BI, amount, [], [], [])
}

export function handleClassicBoostWithdrawn(event: ClassicBoostWithdrawn): void {
  const boostAddress = event.address
  const boost = getClassicBoost(boostAddress)
  const classic = getClassic(boost.classic)

  const investorAddress = event.params.user
  const amount = event.params.amount

  updateUserPosition(classic, event, investorAddress, ZERO_BI, amount.neg(), [], [], [])
}

export function handleClassicBoostRewardPaid(event: ClassicBoostRewardPaid): void {
  const boostAddress = event.address
  const boost = getClassicBoost(boostAddress)
  const classic = getClassic(boost.classic)

  const investorAddress = event.params.user
  const amount = event.params.reward

  const boostRewardTokenAddresses = classic.boostRewardTokensOrder
  let boostRewardBalancesDelta = new Array<BigInt>()
  for (let i = 0; i < boostRewardTokenAddresses.length; i++) {
    const rewardTokenAddress = boostRewardTokenAddresses[i]
    if (rewardTokenAddress.equals(boost.rewardToken)) {
      boostRewardBalancesDelta.push(amount)
    } else {
      boostRewardBalancesDelta.push(ZERO_BI)
    }
  }

  updateUserPosition(classic, event, investorAddress, ZERO_BI, ZERO_BI, boostRewardBalancesDelta, [], [])
}

export function handleClassicRewardPoolTransfer(event: RewardPoolTransferEvent): void {
  // sending to self
  if (event.params.from.equals(event.params.to)) {
    return
  }

  // transfering nothing
  if (event.params.value.equals(ZERO_BI)) {
    return
  }

  const rewardPool = getClassicRewardPool(event.address)
  const classic = getClassic(rewardPool.classic)
  const vaultAddress = classic.vault

  const rewardPoolAddresses = classic.rewardPoolTokensOrder
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
    !event.params.to.equals(vaultAddress) &&
    !isRewardPoolTo
  ) {
    updateUserPosition(classic, event, event.params.to, ZERO_BI, ZERO_BI, [], rewardPoolBalancesDelta, [])
  }

  if (
    !event.params.from.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.from.equals(BURN_ADDRESS) &&
    !event.params.from.equals(vaultAddress) &&
    !isRewardPoolFrom
  ) {
    const negRewardPoolBalancesDelta = new Array<BigInt>()
    for (let i = 0; i < rewardPoolBalancesDelta.length; i++) {
      negRewardPoolBalancesDelta.push(rewardPoolBalancesDelta[i].neg())
    }
    updateUserPosition(classic, event, event.params.from, ZERO_BI, ZERO_BI, [], negRewardPoolBalancesDelta, [])
  }
}

export function handleClassicRewardPoolRewardPaid(event: RewardPoolRewardPaidEvent): void {
  const rewardPool = getClassicRewardPool(event.address)
  const classic = getClassic(rewardPool.classic)

  const rewardTokensAddresses = classic.rewardTokensOrder
  const rewardBalancesDelta = new Array<BigInt>()
  for (let i = 0; i < rewardTokensAddresses.length; i++) {
    if (rewardTokensAddresses[i].equals(event.params.reward)) {
      rewardBalancesDelta.push(event.params.amount)
    } else {
      rewardBalancesDelta.push(ZERO_BI)
    }
  }

  updateUserPosition(classic, event, event.params.user, ZERO_BI, ZERO_BI, [], [], rewardBalancesDelta)
}

function updateUserPosition(
  classic: Classic,
  event: ethereum.Event,
  investorAddress: Address,
  vaultBalanceDelta: BigInt,
  boostBalanceDelta: BigInt,
  boostRewardBalancesDelta: Array<BigInt>,
  rewardPoolBalancesDelta: Array<BigInt>,
  rewardBalancesDelta: Array<BigInt>,
): void {
  if (!isClassicInitialized(classic)) {
    return
  }

  const investor = getInvestor(investorAddress)
  const position = getClassicPosition(classic, investor)

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain and update clm
  const classicData = fetchClassicData(classic)
  classic = updateClassicDataAndSnapshots(classic, classicData, event.block.timestamp)

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
  if (position.vaultBalance.equals(ZERO_BI) && position.boostBalance.equals(ZERO_BI) && !hasPreviousRewardPoolBalance) {
    position.createdWith = event.transaction.hash
  }
  position.vaultBalance = position.vaultBalance.plus(vaultBalanceDelta)
  position.boostBalance = position.boostBalance.plus(boostBalanceDelta)
  const positionRewardPoolBalances = position.rewardPoolBalances // required by thegraph
  for (let i = 0; i < rewardPoolBalancesDelta.length; i++) {
    if (positionRewardPoolBalances.length <= i) {
      // happens when position is created before the second reward pool is added
      positionRewardPoolBalances.push(ZERO_BI)
    }
    positionRewardPoolBalances[i] = positionRewardPoolBalances[i].plus(rewardPoolBalancesDelta[i])
  }
  position.rewardPoolBalances = positionRewardPoolBalances

  let totalBalance = position.vaultBalance.plus(position.boostBalance)
  for (let i = 0; i < positionRewardPoolBalances.length; i++) {
    totalBalance = totalBalance.plus(positionRewardPoolBalances[i])
  }
  position.totalBalance = totalBalance
  position.save()

  ///////
  // interaction
  const isSharesTransfer = !vaultBalanceDelta.equals(ZERO_BI)
  const isBoostTransfer = !boostBalanceDelta.equals(ZERO_BI)
  const isBoostRewardTransfer = boostRewardBalancesDelta.some((delta) => !delta.equals(ZERO_BI))
  const isRewardPoolTransfer = rewardPoolBalancesDelta.length > 0
  const isRewardClaim = rewardBalancesDelta.some((delta) => !delta.equals(ZERO_BI))

  // if both shares and reward pool are transferred, we need to create two interactions
  let interactionId = investor.id.concat(getEventIdentifier(event))
  if (isSharesTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(0))
  } else if (isBoostTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(1))
  } else if (isBoostRewardTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(2))
  } else if (isRewardPoolTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(3))
  } else if (isRewardClaim) {
    interactionId = interactionId.concat(Bytes.fromI32(4))
  }
  const interaction = new ClassicPositionInteraction(interactionId)
  interaction.classic = classic.id
  interaction.investor = investor.id
  interaction.investorPosition = position.id
  interaction.createdWith = event.transaction.hash
  interaction.blockNumber = event.block.number
  interaction.timestamp = event.block.timestamp
  if (isSharesTransfer) {
    interaction.type = vaultBalanceDelta.gt(ZERO_BI) ? "VAULT_DEPOSIT" : "VAULT_WITHDRAW"
  } else if (isBoostTransfer) {
    interaction.type = boostBalanceDelta.gt(ZERO_BI) ? "BOOST_STAKE" : "BOOST_UNSTAKE"
  } else if (isBoostRewardTransfer) {
    interaction.type = "BOOST_REWARD_CLAIM"
  } else if (isRewardPoolTransfer) {
    const isRewardPoolStake = rewardPoolBalancesDelta.some((delta) => delta.gt(ZERO_BI))
    interaction.type = isRewardPoolStake ? "CLASSIC_REWARD_POOL_STAKE" : "CLASSIC_REWARD_POOL_UNSTAKE"
  } else if (isRewardClaim) {
    interaction.type = "CLASSIC_REWARD_POOL_CLAIM"
  }

  interaction.vaultBalance = position.vaultBalance
  interaction.boostBalance = position.boostBalance
  interaction.rewardPoolBalances = position.rewardPoolBalances
  interaction.totalBalance = position.totalBalance
  interaction.vaultSharesTotalSupply = classicData.vaultSharesTotalSupply
  interaction.vaultUnderlyingTotalSupply = classicData.vaultUnderlyingTotalSupply
  interaction.vaultUnderlyingBreakdownBalances = classicData.vaultUnderlyingBreakdownBalances
  interaction.vaultUnderlyingAmount = classicData.underlyingAmount
  interaction.vaultBalanceDelta = vaultBalanceDelta
  interaction.boostBalanceDelta = boostBalanceDelta
  interaction.boostRewardBalancesDelta = boostRewardBalancesDelta
  interaction.rewardPoolBalancesDelta = rewardPoolBalancesDelta
  interaction.rewardBalancesDelta = rewardBalancesDelta

  interaction.underlyingToNativePrice = classicData.underlyingToNativePrice
  interaction.underlyingBreakdownToNativePrices = classicData.underlyingBreakdownToNativePrices
  interaction.boostRewardToNativePrices = classicData.boostRewardToNativePrices
  interaction.rewardToNativePrices = classicData.rewardToNativePrices
  interaction.nativeToUSDPrice = classicData.nativeToUSDPrice
  interaction.save()
}
