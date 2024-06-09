import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { YEAR, getPreviousIntervalFromTimestamp } from "./time"

export function getSnapshotIdSuffix(period: BigInt, interval: BigInt): Bytes {
  return Bytes.fromByteArray(Bytes.fromBigInt(period)).concat(Bytes.fromByteArray(Bytes.fromBigInt(interval)))
}

export function getPreviousSnapshotIdSuffix(period: BigInt, timestamp: BigInt): Bytes {
  // just a test to prevent developer mistakes
  if (timestamp.lt(YEAR)) {
    throw new Error("This function, unlike getSnapshotIdSuffix, expects the timestamp instead of the interval")
  }
  return Bytes.fromByteArray(Bytes.fromBigInt(period)).concat(
    Bytes.fromByteArray(Bytes.fromBigInt(getPreviousIntervalFromTimestamp(timestamp, period))),
  )
}
