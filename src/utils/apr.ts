import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import { ZERO_BD, ZERO_BI, bigIntMax, bigIntMin } from "./decimal"
import { YEAR } from "./time"

class AprStateEntry {
  constructor(
    public collectedAmount: BigDecimal,
    public collectTimestamp: BigInt,
    public totalValueLocked: BigDecimal,
  ) {}
}

export class AprState {
  constructor(public collects: Array<AprStateEntry>) {}

  serialize(): Array<BigDecimal> {
    let res = new Array<BigDecimal>()
    for (let idx = 0; idx < this.collects.length; idx++) {
      let entry = this.collects[idx]
      res.push(entry.collectedAmount)
      res.push(entry.collectTimestamp.toBigDecimal())
      res.push(entry.totalValueLocked)
    }
    return res
  }

  static deserialize(data: Array<BigDecimal>): AprState {
    let collects = new Array<AprStateEntry>()
    while (data.length > 0) {
      let collectedAmountUSD = data.shift() as BigDecimal
      let collectTimestamp = BigInt.fromString((data.shift() as BigDecimal).truncate(0).toString())
      let totalValueLocked = data.shift() as BigDecimal
      collects.push(new AprStateEntry(collectedAmountUSD, collectTimestamp, totalValueLocked))
    }
    return new AprState(collects)
  }
}

export class AprCalc {
  public static from(period: BigInt, state: Array<BigDecimal>): AprCalc {
    const aprState = state.length === 0 ? new AprState([]) : AprState.deserialize(state)
    return new AprCalc(period, aprState)
  }

  private constructor(
    public period: BigInt,
    public state: AprState,
  ) {
    if (period.lt(ZERO_BI) || period.equals(ZERO_BI)) {
      log.error("AprCalc: period cannot be negative or zero, got {}", [period.toString()])
      throw new Error("AprCalc: period cannot be negative or zero")
    }
  }

  public addTransaction(collectedAmountUSD: BigDecimal, collectTimestamp: BigInt, totalValueLocked: BigDecimal): void {
    if (collectedAmountUSD.equals(ZERO_BD)) {
      return
    }
    const entry = new AprStateEntry(collectedAmountUSD, collectTimestamp, totalValueLocked)

    // check if the entry is in the right strict order
    const lastTimestamp =
      this.state.collects.length === 0
        ? BigInt.fromI32(-1)
        : this.state.collects[this.state.collects.length - 1].collectTimestamp
    if (!entry.collectTimestamp.gt(lastTimestamp)) {
      log.error("AprCalc: collectTimestamp is not in order, trying to insert {}, when last ts is {}", [
        entry.collectTimestamp.toString(),
        lastTimestamp.toString(),
      ])
      throw new Error("AprCalc: collectTimestamp is not in order")
    }

    // latest entry is the last one
    this.state.collects.push(entry)
  }

  public calculateLastApr(): BigDecimal {
    // we need at lea
    if (this.state.collects.length === 0) {
      return ZERO_BD
    }

    // we place ourselves at the last collect timestamp
    const now = this.state.collects[this.state.collects.length - 1].collectTimestamp
    const periodStart = now.minus(this.period)

    // first, eliminate the entries that are not in the period anymore
    this.evictOldEntries(now)

    // special cases for 1 or 2 entries after eviction
    if (this.state.collects.length === 0) {
      return ZERO_BD
    }
    if (this.state.collects.length === 1) {
      const entry = this.state.collects[0]
      return entry.collectedAmount.div(entry.totalValueLocked)
    }

    // for each time slice, get the time weighted tvl and time weighted collected amount
    let weightedYieldRate = ZERO_BD
    for (let idx = 1; idx < this.state.collects.length; idx++) {
      const prev = this.state.collects[idx - 1]
      const curr = this.state.collects[idx]

      const sliceStart = bigIntMax(periodStart, prev.collectTimestamp)
      const sliceEnd = curr.collectTimestamp
      const slicePercentSpan = sliceEnd
        .minus(sliceStart)
        .toBigDecimal()
        .div(curr.collectTimestamp.minus(prev.collectTimestamp).toBigDecimal())
      const sliceCollectedUSD = curr.collectedAmount.times(slicePercentSpan)
      const sliceSize = curr.collectTimestamp.minus(sliceStart).toBigDecimal()

      if (!curr.totalValueLocked.equals(ZERO_BD)) {
        weightedYieldRate = weightedYieldRate.plus(sliceCollectedUSD.div(curr.totalValueLocked).times(sliceSize))
      }
    }
    const elapsedPeriod = bigIntMin(now.minus(this.state.collects[0].collectTimestamp), this.period)
    const yieldRate = weightedYieldRate.div(elapsedPeriod.toBigDecimal())
    const periodsInYear = YEAR.div(elapsedPeriod)
    const annualized = yieldRate.times(periodsInYear.toBigDecimal())
    return annualized
  }

  /**
   * Evict entries that do not belong to the period anymore
   */
  public evictOldEntries(now: BigInt): void {
    // we need at least 2 entries to evict
    // since we keep an old one to compute the apr
    if (this.state.collects.length < 2) {
      return
    }

    // find the first entry that is in the period
    let firstEntryIdx = 0
    const periodStart = now.minus(this.period)
    while (firstEntryIdx < this.state.collects.length) {
      const entry = this.state.collects[firstEntryIdx]
      if (entry.collectTimestamp.gt(periodStart)) {
        break
      }
      firstEntryIdx++
    }

    // evict all entries but one before that
    firstEntryIdx = firstEntryIdx === 0 ? 0 : firstEntryIdx - 1
    this.state.collects = this.state.collects.slice(firstEntryIdx)
  }
}
