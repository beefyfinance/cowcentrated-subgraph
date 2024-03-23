import { BigDecimal } from "@graphprotocol/graph-ts"
import { ZERO_BD, bigMin } from "./decimal"

class PnLStateEntry {
  constructor(
    public boughtShares: BigDecimal,
    public remainingShares: BigDecimal,
    public entryPrice: BigDecimal,
  ) {}
}

export class PnLState {
  constructor(
    public realizedPnl: BigDecimal,
    public sharesFifo: Array<PnLStateEntry>,
  ) {}

  serialize(): Array<BigDecimal> {
    let res = new Array<BigDecimal>()
    res.push(this.realizedPnl)
    for (let idx = 0; idx < this.sharesFifo.length; idx++) {
      let entry = this.sharesFifo[idx]
      res.push(entry.boughtShares)
      res.push(entry.remainingShares)
      res.push(entry.entryPrice)
    }

    return res
  }

  static deserialize(data: Array<BigDecimal>): PnLState {
    let realizedPnl = data.shift() as BigDecimal
    let sharesFifo = new Array<PnLStateEntry>()
    while (data.length > 0) {
      let boughtShares = data.shift() as BigDecimal
      let remainingShares = data.shift() as BigDecimal
      let entryPrice = data.shift() as BigDecimal
      sharesFifo.push(new PnLStateEntry(boughtShares, remainingShares, entryPrice))
    }

    return new PnLState(realizedPnl, sharesFifo)
  }
}

// this one is a FIFO pnl calculator:
// https://money.stackexchange.com/a/144091
export class PnLCalc {
  public static from(state: Array<BigDecimal>): PnLCalc {
    const pnlState =
      state.length === 0 ? new PnLState(ZERO_BD, new Array<PnLStateEntry>()) : PnLState.deserialize(state)
    return new PnLCalc(pnlState)
  }

  private constructor(private state: PnLState) {}

  public addTransaction(trxShares: BigDecimal, trxPrice: BigDecimal): void {
    if (trxShares.equals(ZERO_BD)) {
      return
    }

    if (trxShares.gt(ZERO_BD)) {
      this.state.sharesFifo.push(new PnLStateEntry(trxShares, trxShares, trxPrice))
      return
    }

    let remainingSharesToSell = trxShares.neg()
    let trxPnl = ZERO_BD
    for (let idx = 0; idx < this.state.sharesFifo.length; idx++) {
      let entry = this.state.sharesFifo[idx]
      if (entry.remainingShares.equals(ZERO_BD)) {
        continue
      }

      const sharesToSell = bigMin(remainingSharesToSell, entry.remainingShares)
      const priceDiff = trxPrice.minus(entry.entryPrice)
      trxPnl = trxPnl.plus(sharesToSell.times(priceDiff))
      remainingSharesToSell = remainingSharesToSell.minus(sharesToSell)
      entry.remainingShares = entry.remainingShares.minus(sharesToSell)

      if (remainingSharesToSell.equals(ZERO_BD)) {
        break
      }
    }

    this.state.realizedPnl = this.state.realizedPnl.plus(trxPnl)
    return
  }

  public getUnrealizedPnl(currentPrice: BigDecimal): BigDecimal {
    let unrealizedPnl = ZERO_BD
    for (let idx = 0; idx < this.state.sharesFifo.length; idx++) {
      let entry = this.state.sharesFifo[idx]
      if (entry.remainingShares.equals(ZERO_BD)) {
        continue
      }

      const priceDiff = currentPrice.minus(entry.entryPrice)
      unrealizedPnl = unrealizedPnl.plus(entry.remainingShares.times(priceDiff))
    }
    return unrealizedPnl
  }

  public getRealizedPnl(): BigDecimal {
    return this.state.realizedPnl
  }

  public getRemainingShares(): BigDecimal {
    let remainingShares = ZERO_BD
    for (let idx = 0; idx < this.state.sharesFifo.length; idx++) {
      let trx = this.state.sharesFifo[idx]
      remainingShares = remainingShares.plus(trx.remainingShares)
    }
    return remainingShares
  }

  public getRemainingSharesAvgEntryPrice(): BigDecimal {
    let totalShares = ZERO_BD
    let totalCost = ZERO_BD
    for (let idx = 0; idx < this.state.sharesFifo.length; idx++) {
      let entry = this.state.sharesFifo[idx]
      totalShares = totalShares.plus(entry.remainingShares)
      totalCost = totalCost.plus(entry.remainingShares.times(entry.entryPrice))
    }
    if (totalShares.equals(ZERO_BD)) {
      return ZERO_BD
    }
    return totalCost.div(totalShares)
  }
}
