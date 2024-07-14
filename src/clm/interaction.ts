import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts"
import { Transfer as ClmManagerTransferEvent } from "../../generated/templates/ClmManager/ClmManager"
import { getCLM, isClmInitialized } from "./entity/clm"
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

  // don't store transfers to/from the share token mint address
  if (
    !event.params.from.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.from.equals(BURN_ADDRESS) &&
    !event.params.from.equals(managerAddress)
  ) {
    updateUserPosition(clm, event, event.params.from, event.params.value.neg())
  }

  if (
    !event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS) &&
    !event.params.to.equals(BURN_ADDRESS) &&
    !event.params.to.equals(managerAddress)
  ) {
    updateUserPosition(clm, event, event.params.to, event.params.value)
  }
}

function updateUserPosition(
  clm: CLM,
  event: ethereum.Event,
  investorAddress: Address,
  managerBalanceDelta: BigInt,
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
  if (position.managerBalance.equals(ZERO_BI)) {
    position.createdWith = event.transaction.hash
  }

  position.managerBalance = position.managerBalance.plus(managerBalanceDelta)
  let totalBalance = position.managerBalance
  position.totalBalance = totalBalance
  position.save()

  ///////
  // interaction
  const isSharesTransfer = !managerBalanceDelta.equals(ZERO_BI)

  // if both shares and reward pool are transferred, we will create two interactions
  let interactionId = investor.id.concat(getEventIdentifier(event))
  if (isSharesTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(0))
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
  }

  interaction.managerBalance = position.managerBalance
  interaction.totalBalance = position.totalBalance
  interaction.managerBalanceDelta = managerBalanceDelta

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
    let totalRewardPoolBalanceDelta = ZERO_BI
    const positionEquivalentInManagerBalance = managerBalanceDelta.plus(totalRewardPoolBalanceDelta)
    interaction.underlyingBalance0Delta = interaction.underlyingBalance0Delta.plus(
      clmData.token0Balance.times(positionEquivalentInManagerBalance).div(clmData.managerTotalSupply),
    )
    interaction.underlyingBalance1Delta = interaction.underlyingBalance1Delta.plus(
      clmData.token1Balance.times(positionEquivalentInManagerBalance).div(clmData.managerTotalSupply),
    )
  }
  interaction.token0ToNativePrice = clmData.token0ToNativePrice
  interaction.token1ToNativePrice = clmData.token1ToNativePrice
  interaction.outputToNativePrices = clmData.outputToNativePrices
  interaction.nativeToUSDPrice = clmData.nativeToUSDPrice
  interaction.save()
}
