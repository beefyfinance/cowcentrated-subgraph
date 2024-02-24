import { Bytes } from '@graphprotocol/graph-ts'
import { UserAccount } from '../../generated/schema'
import { ZERO_BD, ZERO_BI } from '../utils/decimal'

export function getUserAccount(accountAddress: Bytes): UserAccount {
  let account = UserAccount.load(accountAddress)
  if (!account) {
    account = new UserAccount(accountAddress)
    account.lastInteractionTimestamp = ZERO_BI
    account.investedDuration = ZERO_BI
    account.totalPositionValueUSD = ZERO_BD
    account.timeWeightedPositionValueUSD = ZERO_BD
    account.interactionsCount = 0
  }

  return account
}
