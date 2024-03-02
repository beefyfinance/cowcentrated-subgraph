import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import { getIntervalFromTimestamp } from '../utils/time'

@inline
export function getClockTickId(timestamp: BigInt, period: BigInt): Bytes {
  const interval = getIntervalFromTimestamp(timestamp, period)
  return Bytes.fromByteArray(Bytes.fromBigInt(interval).concat(Bytes.fromBigInt(interval)))
}

@inline
export function getPreviousClockTickId(timestamp: BigInt, period: BigInt): Bytes {
  return getClockTickId(timestamp.minus(period), period)
}
