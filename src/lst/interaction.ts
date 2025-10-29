import { handleClassicVaultTransfer } from "../classic/interaction"
import {
  Transfer as LSTVaultTransfer,
  Notify as LSTVaultNotify,
  ClaimedRewards as LSTVaultClaimedRewards,
  ChargedFees as LSTVaultChargedFees,
} from "../../generated/LSTVault/LSTVault"
import { Transfer as ClassicVaultTransfer } from "../../generated/templates/ClassicVault/ClassicVault"
import { _handleClassicStrategyHarvest, _handleClassicStrategyChargedFees } from "../classic/compound"
import { ZERO_BI } from "../common/utils/decimal"

export function handleLSTVaultClaimedRewards(event: LSTVaultClaimedRewards): void {
  // TODO
}

export function handleLSTVaultNotified(event: LSTVaultNotify): void {
  _handleClassicStrategyHarvest(event, event.params.amount)
}

export function handleLSTVaultChargedFees(event: LSTVaultChargedFees): void {
  const callFees = ZERO_BI
  const beefyFees = event.params.beefyFee
  const strategistFees = event.params.liquidityFee
  _handleClassicStrategyChargedFees(event, callFees, beefyFees, strategistFees)
}

export function handleLSTVaultTransfer(event: LSTVaultTransfer): void {
  const classicTransfer = new ClassicVaultTransfer(
    event.address,
    event.logIndex,
    event.transactionLogIndex,
    event.logType,
    event.block,
    event.transaction,
    event.parameters,
    event.receipt,
  )
  handleClassicVaultTransfer(classicTransfer)
}
