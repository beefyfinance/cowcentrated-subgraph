import { assert, test, describe } from "matchstick-as/assembly/index"
import { BigDecimal } from "@graphprotocol/graph-ts"
import { PnLCalc, PnLState } from "../../src/utils/pnl"
import { ZERO_BD } from "../../src/utils/decimal"

describe("PnLState", () => {
  test("Can serialize and deserialize pnl state with no entries", () => {
    const realizedPnl = BigDecimal.fromString("100")
    const state = PnLState.deserialize([realizedPnl])
    assert.assertTrue(state.realizedPnl.equals(realizedPnl))
  })

  test("Can serialize and deserialize pnl state with one entry", () => {
    const realizedPnl = BigDecimal.fromString("100")
    const boughtShares = BigDecimal.fromString("10")
    const remainingShares = BigDecimal.fromString("5")
    const entryPrice = BigDecimal.fromString("20")
    const state = PnLState.deserialize([realizedPnl, boughtShares, remainingShares, entryPrice])
    assert.assertTrue(state.realizedPnl.equals(realizedPnl))
    assert.assertTrue(state.sharesFifo.length === 1)
    assert.assertTrue(state.sharesFifo[0].boughtShares.equals(boughtShares))
    assert.assertTrue(state.sharesFifo[0].remainingShares.equals(remainingShares))
    assert.assertTrue(state.sharesFifo[0].entryPrice.equals(entryPrice))

    const serialized = state.serialize()
    assert.assertTrue(serialized.length === 4)
    assert.assertTrue(serialized[0].equals(realizedPnl))
    assert.assertTrue(serialized[1].equals(boughtShares))
    assert.assertTrue(serialized[2].equals(remainingShares))
    assert.assertTrue(serialized[3].equals(entryPrice))
  })

  test("Can serialize and deserialize pnl state with multiple entries", () => {
    const realizedPnl = BigDecimal.fromString("100")
    const boughtShares1 = BigDecimal.fromString("10")
    const remainingShares1 = BigDecimal.fromString("5")
    const entryPrice1 = BigDecimal.fromString("20")
    const boughtShares2 = BigDecimal.fromString("20")
    const remainingShares2 = BigDecimal.fromString("10")
    const entryPrice2 = BigDecimal.fromString("30")
    const state = PnLState.deserialize([
      realizedPnl,
      boughtShares1,
      remainingShares1,
      entryPrice1,
      boughtShares2,
      remainingShares2,
      entryPrice2,
    ])
    assert.assertTrue(state.realizedPnl.equals(realizedPnl))
    assert.assertTrue(state.sharesFifo.length === 2)
    assert.assertTrue(state.sharesFifo[0].boughtShares.equals(boughtShares1))
    assert.assertTrue(state.sharesFifo[0].remainingShares.equals(remainingShares1))
    assert.assertTrue(state.sharesFifo[0].entryPrice.equals(entryPrice1))
    assert.assertTrue(state.sharesFifo[1].boughtShares.equals(boughtShares2))
    assert.assertTrue(state.sharesFifo[1].remainingShares.equals(remainingShares2))
    assert.assertTrue(state.sharesFifo[1].entryPrice.equals(entryPrice2))

    const serialized = state.serialize()
    assert.assertTrue(serialized.length === 7)
    assert.assertTrue(serialized[0].equals(realizedPnl))
    assert.assertTrue(serialized[1].equals(boughtShares1))
    assert.assertTrue(serialized[2].equals(remainingShares1))
    assert.assertTrue(serialized[3].equals(entryPrice1))
    assert.assertTrue(serialized[4].equals(boughtShares2))
    assert.assertTrue(serialized[5].equals(remainingShares2))
    assert.assertTrue(serialized[6].equals(entryPrice2))
  })
})

describe("PnLCalc", () => {
  test("should compute PnL properly", () => {
    let pnl = PnLCalc.from(new Array<BigDecimal>())
    let currentPrice = BigDecimal.fromString("25")
    assert.assertTrue(pnl.getRealizedPnl().equals(ZERO_BD))
    assert.assertTrue(pnl.getUnrealizedPnl(currentPrice).equals(ZERO_BD))

    let trxShares = BigDecimal.fromString("2")
    let trxPrice = BigDecimal.fromString("10")
    pnl.addTransaction(trxShares, trxPrice)
    assert.assertTrue(pnl.getRealizedPnl().equals(ZERO_BD))
    assert.assertTrue(pnl.getUnrealizedPnl(trxPrice).equals(ZERO_BD))
    assert.assertTrue(pnl.getUnrealizedPnl(BigDecimal.fromString("12")).equals(BigDecimal.fromString("4")))

    trxShares = BigDecimal.fromString("2")
    trxPrice = BigDecimal.fromString("15")
    pnl.addTransaction(trxShares, trxPrice)
    assert.assertTrue(pnl.getRealizedPnl().equals(ZERO_BD))
    assert.assertTrue(pnl.getUnrealizedPnl(trxPrice).equals(BigDecimal.fromString("10")))
    assert.assertTrue(pnl.getUnrealizedPnl(BigDecimal.fromString("17")).equals(BigDecimal.fromString("18")))

    trxShares = BigDecimal.fromString("-3")
    trxPrice = BigDecimal.fromString("20")
    pnl.addTransaction(trxShares, trxPrice)
    assert.assertTrue(pnl.getRealizedPnl().equals(BigDecimal.fromString("25")))
    assert.assertTrue(pnl.getUnrealizedPnl(trxPrice).equals(BigDecimal.fromString("5")))
  })

  test("should compute PnL properly from a real world use case", () => {
    const timeline = [
      new TimelineEntry(
        "2022-11-17T14:48:03.000Z",
        BigDecimal.fromString("1.0072088101378458"),
        BigDecimal.fromString("314.89874339460806"),
        BigDecimal.fromString("20.27876253618866"),
        BigDecimal.fromString("20.4249482851425"),
        BigDecimal.fromString("6431.790548891228"),
        BigDecimal.fromString("20.27876253618866"),
        BigDecimal.fromString("20.4249482851425"),
        BigDecimal.fromString("6431.790548891228"),
      ),
      new TimelineEntry(
        "2022-11-20T19:31:20.000Z",
        BigDecimal.fromString("1.0075970905895832"),
        BigDecimal.fromString("347.50914177774484"),
        BigDecimal.fromString("20.891856301143548"),
        BigDecimal.fromString("21.05057362604789"),
        BigDecimal.fromString("7315.266774717132"),
        BigDecimal.fromString("0.6130937649548895"),
        BigDecimal.fromString("0.6177514938271605"),
        BigDecimal.fromString("214.6742914517964"),
      ),

      new TimelineEntry(
        "2022-11-23T21:36:19.000Z",
        BigDecimal.fromString("1.0079955733953208"),
        BigDecimal.fromString("338.9687613836563"),
        BigDecimal.fromString("21.873125794444825"),
        BigDecimal.fromString("22.04801397711939"),
        BigDecimal.fromString("7473.587988793701"),
        BigDecimal.fromString("0.9812694933012761"),
        BigDecimal.fromString("0.9891153055555556"),
        BigDecimal.fromString("335.2791899897834"),
      ),

      new TimelineEntry(
        "2022-12-02T13:42:28.000Z",
        BigDecimal.fromString("1.0091310138565124"),
        BigDecimal.fromString("357.83013067482005"),
        BigDecimal.fromString("23.214705725876705"),
        BigDecimal.fromString("23.426679525534542"),
        BigDecimal.fromString("8382.771795899156"),
        BigDecimal.fromString("1.3415799314318817"),
        BigDecimal.fromString("1.3538299163754048"),
        BigDecimal.fromString("484.4411358880918"),
      ),

      new TimelineEntry(
        "2022-12-15T21:56:20.000Z",
        BigDecimal.fromString("1.0109650927669185"),
        BigDecimal.fromString("363.0589258226089"),
        BigDecimal.fromString("0"),
        BigDecimal.fromString("0"),
        BigDecimal.fromString("0"),
        BigDecimal.fromString("-23.214705725876705"),
        BigDecimal.fromString("-23.469257127717658"),
        BigDecimal.fromString("-8520.72328264378"),
      ),

      new TimelineEntry(
        "2023-02-02T19:03:44.000Z",
        BigDecimal.fromString("1.0181657075053454"),
        BigDecimal.fromString("489.8806056476361"),
        BigDecimal.fromString("29.516921045823203"),
        BigDecimal.fromString("30.0531168"),
        BigDecimal.fromString("14722.439059583148"),
        BigDecimal.fromString("29.516921045823203"),
        BigDecimal.fromString("30.0531168"),
        BigDecimal.fromString("14722.439059583148"),
      ),
    ]

    const currentShareToUnderlyingPrice = BigDecimal.fromString("1.021708071749255723")
    const currentUnderlyingToUsdPrice = BigDecimal.fromString("477.57009640452765")

    const yieldPnL = PnLCalc.from(new Array<BigDecimal>())
    const usdPnL = PnLCalc.from(new Array<BigDecimal>())

    for (let idx = 0; idx < timeline.length; idx++) {
      const row = timeline[idx]
      usdPnL.addTransaction(row.share_diff, row.share_to_underlying_price.times(row.underlying_to_usd_price))
    }

    for (let idx = 0; idx < timeline.length; idx++) {
      const row = timeline[idx]
      yieldPnL.addTransaction(row.share_diff, row.share_to_underlying_price)
    }

    const currentUsdPrice = currentShareToUnderlyingPrice.times(currentUnderlyingToUsdPrice)
    const currentYieldPrice = currentShareToUnderlyingPrice

    // ensures yield pnl
    const precision = BigDecimal.fromString("0.00000001")
    assertIsCloseTo(yieldPnL.getRemainingShares(), BigDecimal.fromString("29.516921045823203"), precision)
    assertIsCloseTo(yieldPnL.getRemainingSharesAvgEntryPrice(), BigDecimal.fromString("1.0181657075053454"), precision)
    assertIsCloseTo(yieldPnL.getRealizedPnl(), BigDecimal.fromString("0.08361212681703376"), precision)
    assertIsCloseTo(
      yieldPnL.getUnrealizedPnl(currentYieldPrice),
      BigDecimal.fromString("0.10455968570304802"),
      precision,
    )

    // ensures usd pnl
    assertIsCloseTo(usdPnL.getRemainingShares(), BigDecimal.fromString("29.516921045823203"), precision)
    assertIsCloseTo(usdPnL.getRemainingSharesAvgEntryPrice(), BigDecimal.fromString("498.7796334423725"), precision)
    assertIsCloseTo(usdPnL.getRealizedPnl(), BigDecimal.fromString("1054.5381164228797"), precision)
    assertIsCloseTo(usdPnL.getUnrealizedPnl(currentUsdPrice), BigDecimal.fromString("-320.0345929693857"), precision)
  })
})

function assertIsCloseTo(actual: BigDecimal, expected: BigDecimal, precision: BigDecimal): void {
  const upperBound = expected.plus(precision)
  const lowerBound = expected.minus(precision)
  assert.assertTrue(actual.gt(lowerBound))
  assert.assertTrue(actual.lt(upperBound))
}

class TimelineEntry {
  constructor(
    public datetime: string,
    public share_to_underlying_price: BigDecimal,
    public underlying_to_usd_price: BigDecimal,
    public share_balance: BigDecimal,
    public underlying_balance: BigDecimal,
    public usd_balance: BigDecimal,
    public share_diff: BigDecimal,
    public underlying_diff: BigDecimal,
    public usd_diff: BigDecimal,
  ) {}
}
