import { Bytes } from '@graphprotocol/graph-ts'
import { Investor } from '../../generated/schema'
import { ZERO_BD, ZERO_BI } from '../utils/decimal'

export function getInvestor(accountAddress: Bytes): Investor {
  let investor = Investor.load(accountAddress)
  if (!investor) {
    investor = new Investor(accountAddress)
    investor.lastInteractionTimestamp = ZERO_BI
    investor.investedDuration = ZERO_BI
    investor.totalPositionValueUSD = ZERO_BD
  }

  return investor
}
