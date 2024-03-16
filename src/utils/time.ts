import { BigInt } from "@graphprotocol/graph-ts"

export const MINUTES_15 = BigInt.fromI32(60 * 15)
export const DAY = BigInt.fromI32(60 * 60 * 24)
export const WEEK = BigInt.fromI32(60 * 60 * 24 * 7)
export const YEAR = BigInt.fromI32(60 * 60 * 24 * 365)
export const SNAPSHOT_PERIODS = [DAY, WEEK, YEAR]


@inline
export function getIntervalFromTimestamp(timestamp: BigInt, period: BigInt): BigInt {
  return timestamp.div(period).times(period)
}
