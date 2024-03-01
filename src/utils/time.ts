import { BigInt } from '@graphprotocol/graph-ts'

export const DAY = BigInt.fromI32(60 * 60 * 24)
export const WEEK = BigInt.fromI32(60 * 60 * 24 * 7)
export const YEAR = BigInt.fromI32(60 * 60 * 24 * 365)
export const PERIODS = [DAY, WEEK, YEAR]

@inline
export function getIntervalFromTimestamp(timestamp: BigInt, interval: BigInt): BigInt {
  return timestamp.div(interval).times(interval)
}
