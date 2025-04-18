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
import { Transfer as Erc4626AdapterTransferEvent } from "../../generated/templates/ClassicErc4626Adapter/ClassicErc4626Adapter"
import { getAndSaveTransaction } from "../common/entity/transaction"
import { getInvestor } from "../common/entity/investor"
import { Classic, ClassicPositionInteraction, TokenTransfer } from "../../generated/schema"
import { BURN_ADDRESS, SHARE_TOKEN_MINT_ADDRESS } from "../config"
import { ZERO_BI } from "../common/utils/decimal"
import { getEventIdentifier } from "../common/utils/event"
import {
  getClassic,
  getClassicBoost,
  getClassicErc4626Adapter,
  getClassicRewardPool,
  hasClassicBeenRemoved,
  isClassicInitialized,
} from "./entity/classic"
import { getClassicPosition } from "./entity/position"
import { fetchClassicData, updateClassicDataAndSnapshots } from "./utils/classic-data"
import { updateClassicPositionSnapshotsIfEnabled } from "./utils/position-snapshot"
import { createAndSaveTokenTransfer } from "../common/entity/token"

export function handleClassicVaultTransfer(event: ClassicVaultTransfer): void {
  createAndSaveTokenTransfer(event, event.params.from, event.params.to, event.params.value)

  // sending to self
  if (event.params.from.equals(event.params.to)) {
    return
  }

  // transfering nothing
  if (event.params.value.equals(ZERO_BI)) {
    return
  }

  const classic = getClassic(event.address)
  if (!isClassicInitialized(classic)) {
    log.debug("Classic vault {} is not initialized, ignoring handleClassicVaultTransfer", [classic.id.toHexString()])
    return
  }
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring handleClassicVaultTransfer", [classic.id.toHexString()])
    return
  }

  const vaultAddress = classic.vault
  const rewardPoolAddresses = classic.rewardPoolTokensOrder
  const erc4626AdapterAddresses = classic.erc4626AdapterTokensOrder

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

  let isErc4626AdapterFrom = false
  let isErc4626AdapterTo = false
  for (let i = 0; i < erc4626AdapterAddresses.length; i++) {
    const erc4626AdapterAddress = erc4626AdapterAddresses[i]
    if (event.params.from.equals(erc4626AdapterAddress)) {
      isErc4626AdapterFrom = true
    }
    if (event.params.to.equals(erc4626AdapterAddress)) {
      isErc4626AdapterTo = true
    }
  }

  // don't store transfers to/from the share token mint address
  if (
    !event.params.from.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.from.equals(BURN_ADDRESS) &&
    !event.params.from.equals(vaultAddress) &&
    !isRewardPoolFrom &&
    !isErc4626AdapterFrom
  ) {
    updateUserPositionAndSnapshots(classic, event, event.params.from, event.params.value.neg(), ZERO_BI, [], [], [], [])
  }

  if (
    !event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.to.equals(BURN_ADDRESS) &&
    !event.params.to.equals(vaultAddress) &&
    !isRewardPoolTo &&
    !isErc4626AdapterTo
  ) {
    updateUserPositionAndSnapshots(classic, event, event.params.to, event.params.value, ZERO_BI, [], [], [], [])
  }
}

export function handleClassicBoostStaked(event: ClassicBoostStaked): void {
  const boostAddress = event.address
  const boost = getClassicBoost(boostAddress)
  const classic = getClassic(boost.classic)
  if (!isClassicInitialized(classic)) {
    log.debug("Classic vault {} is not initialized, ignoring handleClassicBoostStaked", [classic.id.toHexString()])
    return
  }
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring handleClassicBoostStaked", [classic.id.toHexString()])
    return
  }

  const investorAddress = event.params.user
  const amount = event.params.amount

  updateUserPositionAndSnapshots(classic, event, investorAddress, ZERO_BI, amount, [], [], [], [])
}

export function handleClassicBoostWithdrawn(event: ClassicBoostWithdrawn): void {
  const boostAddress = event.address
  const boost = getClassicBoost(boostAddress)
  const classic = getClassic(boost.classic)
  if (!isClassicInitialized(classic)) {
    log.debug("Classic vault {} is not initialized, ignoring handleClassicBoostWithdrawn", [classic.id.toHexString()])
    return
  }
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring handleClassicBoostWithdrawn", [classic.id.toHexString()])
    return
  }

  const investorAddress = event.params.user
  const amount = event.params.amount

  updateUserPositionAndSnapshots(classic, event, investorAddress, ZERO_BI, amount.neg(), [], [], [], [])
}

export function handleClassicBoostRewardPaid(event: ClassicBoostRewardPaid): void {
  const boostAddress = event.address
  const boost = getClassicBoost(boostAddress)
  const classic = getClassic(boost.classic)
  if (!isClassicInitialized(classic)) {
    log.debug("Classic vault {} is not initialized, ignoring handleClassicBoostRewardPaid", [classic.id.toHexString()])
    return
  }
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring handleClassicBoostRewardPaid", [classic.id.toHexString()])
    return
  }

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

  updateUserPositionAndSnapshots(
    classic,
    event,
    investorAddress,
    ZERO_BI,
    ZERO_BI,
    boostRewardBalancesDelta,
    [],
    [],
    [],
  )
}

export function handleClassicRewardPoolTransfer(event: RewardPoolTransferEvent): void {
  createAndSaveTokenTransfer(event, event.params.from, event.params.to, event.params.value)

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
  if (!isClassicInitialized(classic)) {
    log.debug("Classic vault {} is not initialized, ignoring handleClassicRewardPoolTransfer", [
      classic.id.toHexString(),
    ])
    return
  }
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring handleClassicRewardPoolTransfer", [classic.id.toHexString()])
    return
  }
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
    updateUserPositionAndSnapshots(
      classic,
      event,
      event.params.to,
      ZERO_BI,
      ZERO_BI,
      [],
      rewardPoolBalancesDelta,
      [],
      [],
    )
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
    updateUserPositionAndSnapshots(
      classic,
      event,
      event.params.from,
      ZERO_BI,
      ZERO_BI,
      [],
      negRewardPoolBalancesDelta,
      [],
      [],
    )
  }
}

export function handleClassicRewardPoolRewardPaid(event: RewardPoolRewardPaidEvent): void {
  const rewardPool = getClassicRewardPool(event.address)
  const classic = getClassic(rewardPool.classic)
  if (!isClassicInitialized(classic)) {
    log.debug("Classic vault {} is not initialized, ignoring handleClassicRewardPoolRewardPaid", [
      classic.id.toHexString(),
    ])
    return
  }
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring handleClassicRewardPoolRewardPaid", [
      classic.id.toHexString(),
    ])
    return
  }

  const rewardTokensAddresses = classic.rewardTokensOrder
  const rewardBalancesDelta = new Array<BigInt>()
  for (let i = 0; i < rewardTokensAddresses.length; i++) {
    if (rewardTokensAddresses[i].equals(event.params.reward)) {
      rewardBalancesDelta.push(event.params.amount)
    } else {
      rewardBalancesDelta.push(ZERO_BI)
    }
  }

  updateUserPositionAndSnapshots(classic, event, event.params.user, ZERO_BI, ZERO_BI, [], [], rewardBalancesDelta, [])
}

export function handleClassicErc4626AdapterTransfer(event: Erc4626AdapterTransferEvent): void {
  createAndSaveTokenTransfer(event, event.params.from, event.params.to, event.params.value)

  // sending to self
  if (event.params.from.equals(event.params.to)) {
    return
  }

  // transfering nothing
  if (event.params.value.equals(ZERO_BI)) {
    return
  }

  const erc4626Adapter = getClassicErc4626Adapter(event.address)
  const classic = getClassic(erc4626Adapter.classic)
  if (!isClassicInitialized(classic)) {
    log.debug("Classic vault {} is not initialized, ignoring handleClassicErc4626AdapterTransfer", [
      classic.id.toHexString(),
    ])
    return
  }
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring handleClassicErc4626AdapterTransfer", [
      classic.id.toHexString(),
    ])
    return
  }
  const vaultAddress = classic.vault

  const erc4626AdapterAddresses = classic.erc4626AdapterTokensOrder
  let isErc4626AdapterFrom = false
  let isErc4626AdapterTo = false
  for (let i = 0; i < erc4626AdapterAddresses.length; i++) {
    const erc4626AdapterAddress = erc4626AdapterAddresses[i]
    if (event.params.from.equals(erc4626AdapterAddress)) {
      isErc4626AdapterFrom = true
    }
    if (event.params.to.equals(erc4626AdapterAddress)) {
      isErc4626AdapterTo = true
    }
  }

  const erc4626AdapterBalancesDelta = new Array<BigInt>()
  for (let i = 0; i < erc4626AdapterAddresses.length; i++) {
    if (erc4626AdapterAddresses[i].equals(event.address)) {
      erc4626AdapterBalancesDelta.push(event.params.value)
    } else {
      erc4626AdapterBalancesDelta.push(ZERO_BI)
    }
  }

  // don't store transfers to/from the share token mint address or to self
  if (
    !event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.to.equals(BURN_ADDRESS) &&
    !event.params.to.equals(vaultAddress) &&
    !isErc4626AdapterTo
  ) {
    updateUserPositionAndSnapshots(
      classic,
      event,
      event.params.to,
      ZERO_BI,
      ZERO_BI,
      [],
      [],
      [],
      erc4626AdapterBalancesDelta,
    )
  }

  if (
    !event.params.from.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.from.equals(BURN_ADDRESS) &&
    !event.params.from.equals(vaultAddress) &&
    !isErc4626AdapterFrom
  ) {
    const negErc4626AdapterBalancesDelta = new Array<BigInt>()
    for (let i = 0; i < erc4626AdapterBalancesDelta.length; i++) {
      negErc4626AdapterBalancesDelta.push(erc4626AdapterBalancesDelta[i].neg())
    }
    updateUserPositionAndSnapshots(
      classic,
      event,
      event.params.from,
      ZERO_BI,
      ZERO_BI,
      [],
      [],
      [],
      negErc4626AdapterBalancesDelta,
    )
  }
}

function updateUserPositionAndSnapshots(
  classic: Classic,
  event: ethereum.Event,
  investorAddress: Address,
  vaultBalanceDelta: BigInt,
  boostBalanceDelta: BigInt,
  boostRewardBalancesDelta: Array<BigInt>,
  rewardPoolBalancesDelta: Array<BigInt>,
  rewardBalancesDelta: Array<BigInt>,
  erc4626AdapterBalanceDelta: Array<BigInt>,
): void {
  if (!isClassicInitialized(classic)) {
    log.error("Classic vault {} is not initialized, ignoring updateUserPosition", [classic.id.toHexString()])
    return
  }
  if (hasClassicBeenRemoved(classic)) {
    log.debug("Classic vault {} has been removed, ignoring updateUserPosition", [classic.id.toHexString()])
    return
  }

  const investor = getInvestor(investorAddress)
  const position = getClassicPosition(classic, investor)
  const tx = getAndSaveTransaction(event.block, event.transaction)

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
  let hasPreviousErc4626AdapterBalance = false
  for (let i = 0; i < erc4626AdapterBalanceDelta.length; i++) {
    if (erc4626AdapterBalanceDelta[i].notEqual(ZERO_BI)) {
      hasPreviousErc4626AdapterBalance = true
      break
    }
  }
  if (
    position.vaultBalance.equals(ZERO_BI) &&
    position.boostBalance.equals(ZERO_BI) &&
    !hasPreviousRewardPoolBalance &&
    !hasPreviousErc4626AdapterBalance
  ) {
    position.createdWith = tx.id
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

  const positionErc4626AdapterBalances = position.erc4626AdapterBalances // required by thegraph
  for (let i = 0; i < erc4626AdapterBalanceDelta.length; i++) {
    if (positionErc4626AdapterBalances.length <= i) {
      // happens when position is created before the second erc4626 adapter is added
      positionErc4626AdapterBalances.push(ZERO_BI)
    }
    positionErc4626AdapterBalances[i] = positionErc4626AdapterBalances[i].plus(erc4626AdapterBalanceDelta[i])
  }
  position.erc4626AdapterBalances = positionErc4626AdapterBalances

  const positionErc4626AdapterVaultSharesBalances = position.erc4626AdapterVaultSharesBalances // required by thegraph
  const positionErc4626AdapterVaultSharesBalancesDelta = new Array<BigInt>()
  for (let i = 0; i < erc4626AdapterBalanceDelta.length; i++) {
    if (positionErc4626AdapterVaultSharesBalances.length <= i) {
      // happens when position is created before the second erc4626 adapter is added
      positionErc4626AdapterVaultSharesBalances.push(ZERO_BI)
    }
    const newAdapterVaultSharesBalance = classicData.erc4626AdaptersTotalSupply[i].equals(ZERO_BI)
      ? ZERO_BI
      : positionErc4626AdapterBalances[i]
          .times(classicData.erc4626AdapterVaultSharesBalances[i])
          .div(classicData.erc4626AdaptersTotalSupply[i])

    const newAdapterVaultSharesBalanceDelta = positionErc4626AdapterVaultSharesBalances[i]
      .minus(newAdapterVaultSharesBalance)
      .times(BigInt.fromI32(-1))

    positionErc4626AdapterVaultSharesBalances[i] = newAdapterVaultSharesBalance
    positionErc4626AdapterVaultSharesBalancesDelta.push(newAdapterVaultSharesBalanceDelta)
  }
  position.erc4626AdapterVaultSharesBalances = positionErc4626AdapterVaultSharesBalances

  let totalBalance = position.vaultBalance.plus(position.boostBalance)
  for (let i = 0; i < positionRewardPoolBalances.length; i++) {
    totalBalance = totalBalance.plus(positionRewardPoolBalances[i])
  }
  for (let i = 0; i < positionErc4626AdapterVaultSharesBalances.length; i++) {
    totalBalance = totalBalance.plus(positionErc4626AdapterVaultSharesBalances[i])
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
  const isErc4626AdapterTransfer = erc4626AdapterBalanceDelta.length > 0
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
  interaction.logIndex = event.logIndex
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
  } else if (isErc4626AdapterTransfer) {
    interaction.type = erc4626AdapterBalanceDelta.some((delta) => delta.gt(ZERO_BI))
      ? "CLASSIC_ERC4626_ADAPTER_STAKE"
      : "CLASSIC_ERC4626_ADAPTER_UNSTAKE"
  }

  interaction.vaultBalance = position.vaultBalance
  interaction.boostBalance = position.boostBalance
  interaction.rewardPoolBalances = position.rewardPoolBalances
  interaction.erc4626AdapterBalances = position.erc4626AdapterBalances
  interaction.erc4626AdapterVaultSharesBalances = position.erc4626AdapterVaultSharesBalances
  interaction.totalBalance = position.totalBalance

  interaction.vaultSharesTotalSupply = classicData.vaultSharesTotalSupply
  interaction.vaultUnderlyingTotalSupply = classicData.vaultUnderlyingTotalSupply
  interaction.vaultUnderlyingBreakdownBalances = classicData.vaultUnderlyingBreakdownBalances
  interaction.vaultUnderlyingAmount = classicData.underlyingAmount
  interaction.vaultUnderlyingBalance = classicData.underlyingAmount

  interaction.vaultBalanceDelta = vaultBalanceDelta
  interaction.boostBalanceDelta = boostBalanceDelta
  interaction.boostRewardBalancesDelta = boostRewardBalancesDelta
  interaction.rewardPoolBalancesDelta = rewardPoolBalancesDelta
  interaction.rewardBalancesDelta = rewardBalancesDelta
  interaction.erc4626AdapterBalancesDelta = erc4626AdapterBalanceDelta
  interaction.erc4626AdapterVaultSharesBalancesDelta = positionErc4626AdapterVaultSharesBalancesDelta

  interaction.underlyingToNativePrice = classicData.underlyingToNativePrice
  interaction.underlyingBreakdownToNativePrices = classicData.underlyingBreakdownToNativePrices
  interaction.boostRewardToNativePrices = classicData.boostRewardToNativePrices
  interaction.rewardToNativePrices = classicData.rewardToNativePrices
  interaction.nativeToUSDPrice = classicData.nativeToUSDPrice

  interaction.save()

  // update position snapshot
  updateClassicPositionSnapshotsIfEnabled(classic, classicData, position, event.block.timestamp)
}
