import { ethereum } from "@graphprotocol/graph-ts"
import {
  Staked as StakedEvent,
  Withdrawn as WithdrawnEvent,
  RewardPaid as RewardPaidEvent,
} from "../generated/templates/BeefyBoost/BeefyBoost"
import { getBoost } from "./entity/boost"
import { getBeefyCLVault } from "./entity/vault"
import { getInvestor } from "./entity/investor"
import { getInvestorPosition } from "./entity/position"
import {
  BeefyCLVault,
  BeefyBoostClaimEvent,
  Investor,
  InvestorPosition,
  InvestorPositionInteraction,
  Transaction,
} from "../generated/schema"
import { getEventIdentifier } from "./utils/event"
import { getTransaction } from "./entity/transaction"
import { ZERO_BD, tokenAmountToDecimal } from "./utils/decimal"
import { getToken } from "./entity/token"
import { getBeefyCLProtocol, getBeefyCLProtocolSnapshot } from "./entity/protocol"
import { PROTOCOL_SNAPSHOT_PERIODS } from "./utils/time"

export function handleBoostStake(event: StakedEvent): void {
  const tx = getTransaction(event.block, event.transaction)
  tx.save()

  const protocol = getBeefyCLProtocol()
  const boost = getBoost(event.address)
  const vault = getBeefyCLVault(boost.vault)
  const investor = getInvestor(event.params.user)
  const position = getInvestorPosition(vault, investor)

  /////
  // create the interaction
  let positionInteraction = getBoostInteraction(vault, investor, position, tx, event)
  positionInteraction.type = "BOOST_START"
  positionInteraction.save()

  /////
  // update innvestor
  investor.lastInteractionAt = event.block.timestamp
  investor.save()

  /////
  // update protocol stats
  protocol.cumulativeTransactionCount += 1
  protocol.cumulativeInvestorInteractionsCount += 1
  protocol.save()
  for (let i = 0; i < PROTOCOL_SNAPSHOT_PERIODS.length; i++) {
    const period = PROTOCOL_SNAPSHOT_PERIODS[i]
    const protocolSnapshot = getBeefyCLProtocolSnapshot(event.block.timestamp, period)
    if (investor.lastInteractionAt.lt(protocolSnapshot.roundedTimestamp))
      protocolSnapshot.uniqueActiveInvestorCount += 1
    protocolSnapshot.transactionCount += 1
    protocolSnapshot.investorInteractionsCount += 1
    protocolSnapshot.save()
  }
}

export function handleBoostWithdraw(event: WithdrawnEvent): void {
  const tx = getTransaction(event.block, event.transaction)
  tx.save()

  const protocol = getBeefyCLProtocol()
  const boost = getBoost(event.address)
  const vault = getBeefyCLVault(boost.vault)
  const investor = getInvestor(event.params.user)
  const position = getInvestorPosition(vault, investor)

  /////
  // create the interaction
  let positionInteraction = getBoostInteraction(vault, investor, position, tx, event)
  positionInteraction.type = "BOOST_STOP"
  positionInteraction.save()

  /////
  // update innvestor
  investor.lastInteractionAt = event.block.timestamp
  investor.save()

  /////
  // update protocol stats
  protocol.cumulativeTransactionCount += 1
  protocol.cumulativeInvestorInteractionsCount += 1
  protocol.save()
  for (let i = 0; i < PROTOCOL_SNAPSHOT_PERIODS.length; i++) {
    const period = PROTOCOL_SNAPSHOT_PERIODS[i]
    const protocolSnapshot = getBeefyCLProtocolSnapshot(event.block.timestamp, period)
    if (investor.lastInteractionAt.lt(protocolSnapshot.roundedTimestamp))
      protocolSnapshot.uniqueActiveInvestorCount += 1
    protocolSnapshot.transactionCount += 1
    protocolSnapshot.investorInteractionsCount += 1
    protocolSnapshot.save()
  }
}

export function handleBoostReward(event: RewardPaidEvent): void {
  const tx = getTransaction(event.block, event.transaction)
  tx.save()

  const protocol = getBeefyCLProtocol()
  const boost = getBoost(event.address)
  const vault = getBeefyCLVault(boost.vault)
  const investor = getInvestor(event.params.user)
  const position = getInvestorPosition(vault, investor)
  const rewardToken = getToken(boost.rewardedIn)

  /////
  // create the interaction
  let positionInteraction = getBoostInteraction(vault, investor, position, tx, event)
  positionInteraction.type = "BOOST_CLAIM"
  positionInteraction.save()

  /////
  // update innvestor
  investor.lastInteractionAt = event.block.timestamp
  investor.save()

  /////
  // update protocol stats
  protocol.cumulativeTransactionCount += 1
  protocol.cumulativeInvestorInteractionsCount += 1
  protocol.save()
  for (let i = 0; i < PROTOCOL_SNAPSHOT_PERIODS.length; i++) {
    const period = PROTOCOL_SNAPSHOT_PERIODS[i]
    const protocolSnapshot = getBeefyCLProtocolSnapshot(event.block.timestamp, period)
    if (investor.lastInteractionAt.lt(protocolSnapshot.roundedTimestamp))
      protocolSnapshot.uniqueActiveInvestorCount += 1
    protocolSnapshot.transactionCount += 1
    protocolSnapshot.investorInteractionsCount += 1
    protocolSnapshot.save()
  }

  let boostClaimEvent = new BeefyBoostClaimEvent(getEventIdentifier(event))
  boostClaimEvent.boost = boost.id
  boostClaimEvent.rewardedIn = boost.rewardedIn
  boostClaimEvent.investor = investor.id
  boostClaimEvent.createdWith = tx.id
  boostClaimEvent.claimedAmount = tokenAmountToDecimal(event.params.reward, rewardToken.decimals)
  boostClaimEvent.timestamp = event.block.timestamp
  boostClaimEvent.save()
}

function getBoostInteraction(
  vault: BeefyCLVault,
  investor: Investor,
  position: InvestorPosition,
  tx: Transaction,
  event: ethereum.Event,
): InvestorPositionInteraction {
  let positionInteraction = new InvestorPositionInteraction(getEventIdentifier(event))
  positionInteraction.vault = vault.id
  positionInteraction.investor = investor.id
  positionInteraction.investorPosition = position.id
  positionInteraction.createdWith = tx.id
  positionInteraction.timestamp = event.block.timestamp
  positionInteraction.sharesBalance = position.sharesBalance
  positionInteraction.underlyingBalance0 = position.underlyingBalance0
  positionInteraction.underlyingBalance1 = position.underlyingBalance1
  positionInteraction.underlyingBalance0USD = position.underlyingBalance0USD
  positionInteraction.underlyingBalance1USD = position.underlyingBalance1USD
  positionInteraction.positionValueUSD = position.positionValueUSD
  positionInteraction.sharesBalanceDelta = ZERO_BD
  positionInteraction.underlyingBalance0Delta = ZERO_BD
  positionInteraction.underlyingBalance1Delta = ZERO_BD
  positionInteraction.underlyingBalance0DeltaUSD = ZERO_BD
  positionInteraction.underlyingBalance1DeltaUSD = ZERO_BD
  positionInteraction.positionValueUSDDelta = ZERO_BD
  return positionInteraction
}
