import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import { ZERO_BD, ZERO_BI } from "./decimal"
import { DAY } from "./time"

export class DailyAvgState {
  constructor(
    public pendingValue: BigDecimal,
    public pendingValueTimestamp: BigInt,
    // a circular buffer of the last n values
    // a closed value is a value that is not updated anymore
    public closedValues: Array<BigDecimal>,
  ) {}

  serialize(): Array<BigDecimal> {
    let res = new Array<BigDecimal>()
    res.push(this.pendingValue)
    res.push(this.pendingValueTimestamp.toBigDecimal())
    for (let idx = 0; idx < this.closedValues.length; idx++) {
      let entry = this.closedValues[idx]
      res.push(entry)
    }
    return res
  }

  static deserialize(data: Array<BigDecimal>): DailyAvgState {
    let values = new Array<BigDecimal>()
    if (data.length === 0) {
      return new DailyAvgState(ZERO_BD, ZERO_BI, values)
    }

    let pendingValue = data.shift() as BigDecimal
    let pendingValueTimestamp = BigInt.fromString((data.shift() as BigDecimal).truncate(0).toString())

    while (data.length > 0) {
      let value = data.shift() as BigDecimal
      values.push(value)
    }
    return new DailyAvgState(pendingValue, pendingValueTimestamp, values)
  }

  public addValue(entry: BigDecimal): void {
    this.closedValues.push(entry)
  }

  public setPendingValue(value: BigDecimal, timestamp: BigInt): void {
    this.pendingValue = value
    this.pendingValueTimestamp = timestamp
  }
}

export class DailyAvgCalc {
  public static avg(entriesToUse: BigInt, state: DailyAvgState): BigDecimal {
    // first, eliminate the entries that are not in the period anymore
    state = DailyAvgCalc.evictOldEntries(entriesToUse, state)

    // we need at least 1 entry to compute the apr
    if (state.closedValues.length === 0) {
      return state.pendingValue
    }

    const closedSeconds = DAY.times(BigInt.fromI32(state.closedValues.length))
    const pendingSeconds = state.pendingValueTimestamp.mod(DAY)
    let res = ZERO_BD
    for (let idx = 0; idx < state.closedValues.length; idx++) {
      const entry = state.closedValues[idx]
      res = res.plus(entry.times(DAY.toBigDecimal()))
    }
    res = res.plus(state.pendingValue.times(pendingSeconds.toBigDecimal()))
    return res.div(closedSeconds.plus(pendingSeconds).toBigDecimal())
  }

  /**
   * Evict entries that do not belong to the period anymore
   */
  public static evictOldEntries(entriesToUse: BigInt, state: DailyAvgState): DailyAvgState {
    if (entriesToUse.lt(ZERO_BI) || entriesToUse.equals(ZERO_BI)) {
      log.error("DailyAvgCalc: entriesToUse cannot be negative or zero, got {}", [entriesToUse.toString()])
      throw Error("DailyAvgCalc: entriesToUse cannot be negative or zero")
    }

    let lastEntryIdx = state.closedValues.length - 1
    let firstEntryIdx = lastEntryIdx - entriesToUse.toI32() + 1
    let firstEntryIdxClamped = Math.max(firstEntryIdx, 0) as i32

    const newEntries = new Array<BigDecimal>()
    for (let idx = firstEntryIdxClamped; idx <= lastEntryIdx; idx++) {
      newEntries.push(state.closedValues[idx])
    }

    return new DailyAvgState(state.pendingValue, state.pendingValueTimestamp, newEntries)
  }
}
