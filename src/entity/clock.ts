import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { getIntervalFromTimestamp } from "../utils/time"
import { getSnapshotIdSuffix } from "../utils/snapshot"


@inline
export function getClockTickId(timestamp: BigInt, period: BigInt): Bytes {
  const interval = getIntervalFromTimestamp(timestamp, period)
  return getSnapshotIdSuffix(period, interval)
}


@inline
export function getPreviousClockTickId(timestamp: BigInt, period: BigInt): Bytes {
  return getClockTickId(timestamp.minus(period), period)
}
