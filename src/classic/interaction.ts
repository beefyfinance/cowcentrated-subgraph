import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { Transfer as ClassicVaultTransfer } from "../../generated/templates/ClassicVault/ClassicVault"
import {
  Staked as ClassicBoostStaked,
  Withdrawn as ClassicBoostWithdrawn,
  RewardPaid as ClassicBoostRewardPaid,
} from "../../generated/templates/ClassicBoost/ClassicBoost"
import { getTransaction } from "../common/entity/transaction"
import { getInvestor } from "../common/entity/investor"
import { Classic, ClassicPositionInteraction } from "../../generated/schema"
import { BURN_ADDRESS, SHARE_TOKEN_MINT_ADDRESS } from "../config"
import { ZERO_BI } from "../common/utils/decimal"
import { getEventIdentifier } from "../common/utils/event"
import { getClassic, getClassicBoost, isClassicInitialized } from "./entity/classic"
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

  // don't store transfers to/from the share token mint address
  if (!event.params.from.equals(SHARE_TOKEN_MINT_ADDRESS) && !event.params.from.equals(BURN_ADDRESS)) {
    updateUserPosition(classic, event, event.params.from, event.params.value.neg(), ZERO_BI, [])
  }

  if (!event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS) && !event.params.to.equals(BURN_ADDRESS)) {
    updateUserPosition(classic, event, event.params.to, event.params.value, ZERO_BI, [])
  }
}

export function handleClassicBoostStaked(event: ClassicBoostStaked): void {
  const boostAddress = event.address
  const boost = getClassicBoost(boostAddress)
  const classic = getClassic(boost.classic)

  const investorAddress = event.params.user
  const amount = event.params.amount

  updateUserPosition(classic, event, investorAddress, ZERO_BI, amount, [])
}

export function handleClassicBoostWithdrawn(event: ClassicBoostWithdrawn): void {
  const boostAddress = event.address
  const boost = getClassicBoost(boostAddress)
  const classic = getClassic(boost.classic)

  const investorAddress = event.params.user
  const amount = event.params.amount

  updateUserPosition(classic, event, investorAddress, ZERO_BI, amount.neg(), [])
}

export function handleClassicBoostRewardPaid(event: ClassicBoostRewardPaid): void {
  const boostAddress = event.address
  const boost = getClassicBoost(boostAddress)
  const classic = getClassic(boost.classic)

  const investorAddress = event.params.user
  const amount = event.params.reward

  let boostRewardBalancesDelta = new Array<BigInt>()
  for (let i = 0; i < classic.boostRewardTokens.length; i++) {
    const rewardTokenAddress = classic.boostRewardTokens[i]
    if (rewardTokenAddress.equals(boost.rewardToken)) {
      boostRewardBalancesDelta.push(amount)
    } else {
      boostRewardBalancesDelta.push(ZERO_BI)
    }
  }

  updateUserPosition(classic, event, investorAddress, ZERO_BI, ZERO_BI, boostRewardBalancesDelta)
}

function updateUserPosition(
  classic: Classic,
  event: ethereum.Event,
  investorAddress: Address,
  vaultBalanceDelta: BigInt,
  boostBalanceDelta: BigInt,
  boostRewardBalancesDelta: Array<BigInt>,
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
  if (position.vaultBalance.equals(ZERO_BI) && position.boostBalance.equals(ZERO_BI)) {
    position.createdWith = event.transaction.hash
  }
  position.vaultBalance = position.vaultBalance.plus(vaultBalanceDelta)
  position.boostBalance = position.boostBalance.plus(boostBalanceDelta)
  position.totalBalance = position.vaultBalance.plus(position.boostBalance)
  position.save()

  ///////
  // interaction
  const isSharesTransfer = !vaultBalanceDelta.equals(ZERO_BI)
  const isBoostTransfer = !boostBalanceDelta.equals(ZERO_BI)
  const isRewardTransfer = boostRewardBalancesDelta.some((delta) => !delta.equals(ZERO_BI))

  // if both shares and reward pool are transferred, we need to create two interactions
  let interactionId = investor.id.concat(getEventIdentifier(event))
  if (isSharesTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(0))
  } else if (isBoostTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(1))
  } else if (isRewardTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(2))
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
  } else if (isRewardTransfer) {
    interaction.type = "BOOST_REWARD_CLAIM"
  }

  interaction.vaultBalance = position.vaultBalance
  interaction.boostBalance = position.boostBalance
  interaction.totalBalance = position.totalBalance
  interaction.vaultBalanceDelta = vaultBalanceDelta
  interaction.boostBalanceDelta = boostBalanceDelta
  interaction.boostRewardBalancesDelta = boostRewardBalancesDelta

  interaction.underlyingToNativePrice = classicData.underlyingToNativePrice
  interaction.boostRewardToNativePrices = classicData.boostRewardToNativePrices
  interaction.nativeToUSDPrice = classicData.nativeToUSDPrice
  interaction.save()
}
