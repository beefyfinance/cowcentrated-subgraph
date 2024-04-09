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

  public addTransaction(collectedAmountUSD: BigDecimal, collectTimestamp: BigInt, totalValueLocked: BigDecimal): void {
    const entry = new AprStateEntry(collectedAmountUSD, collectTimestamp, totalValueLocked)

    if (this.collects.length === 0) {
      this.collects.push(entry)
      return
    }

    // check if the entry is in the right strict order
    const lastEntry = this.collects[this.collects.length - 1]

    // merge entries with the same timestamp
    if (entry.collectTimestamp.equals(lastEntry.collectTimestamp)) {
      lastEntry.collectedAmount = lastEntry.collectedAmount.plus(entry.collectedAmount)
      lastEntry.totalValueLocked = entry.totalValueLocked
    } else if (!entry.collectTimestamp.gt(lastEntry.collectTimestamp)) {
      log.error("AprCalc: collectTimestamp is not in order, trying to insert {}, when last ts is {}", [
        entry.collectTimestamp.toString(),
        lastEntry.collectTimestamp.toString(),
      ])
      throw new Error("AprCalc: collectTimestamp is not in order")
    } else {
      // latest entry is the last one
      this.collects.push(entry)
    }
  }
}

export class AprCalc {
  public static calculateLastApr(period: BigInt, state: AprState, now: BigInt): BigDecimal {
    if (period.lt(ZERO_BI) || period.equals(ZERO_BI)) {
      log.error("AprCalc: period cannot be negative or zero, got {}", [period.toString()])
      throw new Error("AprCalc: period cannot be negative or zero")
    }
    // we need at least 1 entry to compute the apr
    if (state.collects.length === 0) {
      return ZERO_BD
    }

    // we place ourselves at the last collect timestamp
    //const now = this.state.collects[this.state.collects.length - 1].collectTimestamp
    const periodStart = now.minus(period)

    // first, eliminate the entries that are not in the period anymore
    state = AprCalc.evictOldEntries(period, state, now)

    // special cases for 1 or 2 entries after eviction
    if (state.collects.length === 0) {
      return ZERO_BD
    }
    if (state.collects.length === 1) {
      const entry = state.collects[0]
      if (entry.totalValueLocked.equals(ZERO_BD)) {
        return ZERO_BD
      }
      return entry.collectedAmount.div(entry.totalValueLocked)
    }

    // for each time slice, get the time weighted tvl and time weighted collected amount
    let timeWeightedTvlAgg = ZERO_BD
    let totalYield = ZERO_BD

    const APRs = new Array<BigDecimal>();
    const Durations = new Array<BigDecimal>();
    //let agg = ZERO_BD
    for (let idx = 1; idx < state.collects.length; idx++) {
      const prev = state.collects[idx - 1]
      const curr = state.collects[idx]

      const sliceStart = bigIntMax(periodStart, prev.collectTimestamp)
      const sliceEnd = curr.collectTimestamp
      // account for slices beginning before the period start
      const slicePercentSpan = sliceEnd
        .minus(sliceStart)
        .toBigDecimal()
        .div(curr.collectTimestamp.minus(prev.collectTimestamp).toBigDecimal())
      const sliceCollectedUSD = curr.collectedAmount.times(slicePercentSpan)

      // consider the previous TVL as it's updated on the same block as the collected amount
      const sliceTvl = prev.totalValueLocked
      const sliceSize = curr.collectTimestamp.minus(sliceStart).toBigDecimal()

      if (!sliceTvl.equals(ZERO_BD)) {
        timeWeightedTvlAgg = timeWeightedTvlAgg.plus(sliceTvl.times(sliceSize))
      }
      totalYield = totalYield.plus(sliceCollectedUSD)

      //Alternative
      Durations.push(sliceSize);
      const rewardRate = sliceCollectedUSD.div(sliceTvl).div(sliceSize);
      APRs.push(rewardRate.times(YEAR.toBigDecimal()));

    }

    const averagedApr = APRs.reduce((accum, curr, index) => accum.plus(curr.plus(Durations[index])), ZERO_BD).div(Durations.reduce((accum, curr) => accum.plus(curr), ZERO_BD));

    const elapsedPeriod = bigIntMin(now.minus(state.collects[0].collectTimestamp), period)
    const timeWeightedTvl = timeWeightedTvlAgg.div(elapsedPeriod.toBigDecimal())
    const yieldRate = totalYield.div(timeWeightedTvl)
    const periodsInYear = YEAR.div(elapsedPeriod)
    const annualized = yieldRate.times(periodsInYear.toBigDecimal())
    return annualized
  }

  /**
   * Evict entries that do not belong to the period anymore
   */
  public static evictOldEntries(period: BigInt, state: AprState, now: BigInt): AprState {
    // we need at least 2 entries to evict
    // since we keep an old one to compute the apr
    if (state.collects.length < 2) {
      return state
    }

    // find the first entry that is in the period
    let firstEntryIdx = 0
    const periodStart = now.minus(period)
    while (firstEntryIdx < state.collects.length) {
      const entry = state.collects[firstEntryIdx]
      if (entry.collectTimestamp.gt(periodStart)) {
        break
      }
      firstEntryIdx++
    }

    // evict all entries but one before that
    firstEntryIdx = firstEntryIdx === 0 ? 0 : firstEntryIdx - 1
    return new AprState(state.collects.slice(firstEntryIdx))
  }
}
