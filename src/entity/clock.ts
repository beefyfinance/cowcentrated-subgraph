import { BigInt } from "@graphprotocol/graph-ts"
import { getIntervalFromTimestamp } from "../utils/time"
import { getSnapshotIdSuffix } from "../utils/snapshot"
import { ClockTick } from "../../generated/schema"

export function getClockTick(timestamp: BigInt, period: BigInt): ClockRes {
  let interval = getIntervalFromTimestamp(timestamp, period)
  let clockTickId = getSnapshotIdSuffix(period, interval)
  let clockTick = ClockTick.load(clockTickId)
  let isNew = false
  if (!clockTick) {
    isNew = true
    clockTick = new ClockTick(clockTickId)
    clockTick.timestamp = timestamp
    clockTick.roundedTimestamp = interval
    clockTick.period = period
  }
  return new ClockRes(clockTick, isNew)
}

class ClockRes {
  constructor(
    public tick: ClockTick,
    public isNew: boolean,
  ) {}
}
