import { BigInt } from "@graphprotocol/graph-ts"
import { log } from "matchstick-as"

export const MINUTES_15 = BigInt.fromI32(60 * 15)
export const HOUR = BigInt.fromI32(60 * 60)
export const DAY = BigInt.fromI32(60 * 60 * 24)
export const WEEK = BigInt.fromI32(60 * 60 * 24 * 7)
export const MONTH = BigInt.fromI32(60 * 60 * 24 * 30)
export const QUARTER = BigInt.fromI32(60 * 60 * 24 * 30 * 3)
export const YEAR = BigInt.fromI32(60 * 60 * 24 * 365)

export function getIntervalFromTimestamp(timestamp: BigInt, period: BigInt): BigInt {
  // if the period is not stable, use date math to calculate the interval
  if (period.ge(WEEK)) {
    const date = new Date(timestamp.toI64() * 1000)
    date.setUTCMilliseconds(0)
    date.setUTCSeconds(0)
    date.setUTCMinutes(0)
    date.setUTCHours(0)
    date.setUTCDate(date.getUTCDate() - date.getUTCDay())
    if (period.equals(WEEK)) {
      return BigInt.fromI64(date.getTime() / 1000)
    }
    date.setUTCDate(1)
    if (period.equals(MONTH)) {
      return BigInt.fromI64(date.getTime() / 1000)
    }
    date.setUTCMonth(date.getUTCMonth() - (date.getUTCMonth() % 3))
    if (period.equals(QUARTER)) {
      return BigInt.fromI64(date.getTime() / 1000)
    }
    date.setUTCMonth(0)
    if (period.equals(YEAR)) {
      return BigInt.fromI64(date.getTime() / 1000)
    }

    log.error("Unsupported period: {}", [period.toString()])
    throw Error("Unsupported period: " + period.toString())
  }
  return timestamp.div(period).times(period)
}

export function getPreviousIntervalFromTimestamp(timestamp: BigInt, period: BigInt): BigInt {
  const truncated = getIntervalFromTimestamp(timestamp, period)
  return getIntervalFromTimestamp(truncated.minus(BigInt.fromI32(10)), period)
}
