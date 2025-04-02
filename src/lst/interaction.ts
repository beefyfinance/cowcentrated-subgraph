import { handleClassicVaultTransfer } from "../classic/interaction"
import {
  Transfer as LSTVaultTransfer,
  Notify as LSTVaultNotify,
  ClaimedRewards as LSTVaultClaimedRewards,
} from "../../generated/LSTVault/LSTVault"
import { Transfer as ClassicVaultTransfer } from "../../generated/templates/ClassicVault/ClassicVault"
import { _handleClassicStrategyHarvest } from "../classic/compound"

export function handleLSTVaultClaimedRewards(event: LSTVaultClaimedRewards): void {
  // TODO
}

export function handleLSTVaultNotified(event: LSTVaultNotify): void {
  _handleClassicStrategyHarvest(event, event.params.amount)
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
