import { assert, test, describe } from "matchstick-as/assembly/index"
import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import { AprCalc, AprState } from "../../src/utils/apr"
import { ZERO_BD } from "../../src/utils/decimal"
import { DAY, WEEK } from "../../src/utils/time"

describe("AprState", () => {
  test("Can serialize and deserialize apr state with no entries", () => {
    const state = AprState.deserialize([])
    assert.assertTrue(state.collects.length === 0)
  })

  test("Can serialize and deserialize apr state with one entry", () => {
    const collectedAmount = BigDecimal.fromString("101.1235")
    const collectTimestamp = BigDecimal.fromString("102")
    const totalValueLocked = BigDecimal.fromString("103.235")
    const state = AprState.deserialize([collectedAmount, collectTimestamp, totalValueLocked])
    assert.assertTrue(state.collects.length === 1)
    assert.assertTrue(state.collects[0].collectedAmount.equals(collectedAmount))
    assert.assertTrue(state.collects[0].collectTimestamp.toBigDecimal().equals(collectTimestamp))
    assert.assertTrue(state.collects[0].totalValueLocked.equals(totalValueLocked))

    const serialized = state.serialize()
    assert.assertTrue(serialized.length === 3)
    assert.assertTrue(serialized[0].equals(collectedAmount))
    assert.assertTrue(serialized[1].equals(collectTimestamp))
    assert.assertTrue(serialized[2].equals(totalValueLocked))
  })

  test("Can serialize and deserialize apr state with multiple entries", () => {
    const collectedAmount1 = BigDecimal.fromString("101.1235")
    const collectTimestamp1 = BigDecimal.fromString("102")
    const totalValueLocked1 = BigDecimal.fromString("103.235")
    const collectedAmount2 = BigDecimal.fromString("201.1235")
    const collectTimestamp2 = BigDecimal.fromString("202")
    const totalValueLocked2 = BigDecimal.fromString("203.235")
    const state = AprState.deserialize([
      collectedAmount1,
      collectTimestamp1,
      totalValueLocked1,
      collectedAmount2,
      collectTimestamp2,
      totalValueLocked2,
    ])
    assert.assertTrue(state.collects.length === 2)
    assert.assertTrue(state.collects[0].collectedAmount.equals(collectedAmount1))
    assert.assertTrue(state.collects[0].collectTimestamp.toBigDecimal().equals(collectTimestamp1))
    assert.assertTrue(state.collects[0].totalValueLocked.equals(totalValueLocked1))
    assert.assertTrue(state.collects[1].collectedAmount.equals(collectedAmount2))
    assert.assertTrue(state.collects[1].collectTimestamp.toBigDecimal().equals(collectTimestamp2))
    assert.assertTrue(state.collects[1].totalValueLocked.equals(totalValueLocked2))

    const serialized = state.serialize()
    assert.assertTrue(serialized.length === 6)
    assert.assertTrue(serialized[0].equals(collectedAmount1))
    assert.assertTrue(serialized[1].equals(collectTimestamp1))
    assert.assertTrue(serialized[2].equals(totalValueLocked1))
    assert.assertTrue(serialized[3].equals(collectedAmount2))
    assert.assertTrue(serialized[4].equals(collectTimestamp2))
    assert.assertTrue(serialized[5].equals(totalValueLocked2))
  })
})

describe("AprCalc", () => {
  test("Can create apr calc with no state", () => {
    const aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = WEEK
    const res = AprCalc.calculateLastApr(DAY, aprState, now)
    assert.assertTrue(res.equals(ZERO_BD))
  })

  test("do not crash when TVL is zero now", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = DAY

    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(0), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("200"), BigInt.fromI32(10000), BigDecimal.fromString("2000"))
    aprState.addTransaction(BigDecimal.fromString("300"), DAY, BigDecimal.fromString("0"))
    const res = AprCalc.calculateLastApr(DAY, aprState, now)
    log.debug("res: {}", [res.toString()])

    assertIsCloseTo(res, BigDecimal.fromString("127.75"), BigDecimal.fromString("0.0001"))
  })

  test("should evict old entries", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())

    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(100), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(200), BigDecimal.fromString("2000"))
    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(69382300), BigDecimal.fromString("3000"))
    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(69382400), BigDecimal.fromString("4000"))
    aprState = AprCalc.evictOldEntries(DAY, aprState, BigInt.fromI32(69382400))

    assert.assertTrue(aprState.collects.length === 3)
  })

  test("should compute apr properly with one entry", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = BigInt.fromI32(100)

    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(100), BigDecimal.fromString("1000"))
    const res = AprCalc.calculateLastApr(DAY, aprState, now)
    log.debug("res: {}", [res.toString()])

    assert.assertTrue(res.equals(BigDecimal.fromString("0")))
  })

  test("should compute apr in the simplest case", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = DAY

    // we earn 1% over 1 day, so the APR is 365%
    aprState.addTransaction(BigDecimal.fromString("10"), BigInt.fromI32(0), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("10"), DAY, BigDecimal.fromString("1000"))
    const res = AprCalc.calculateLastApr(DAY, aprState, now)
    log.debug("res: {}", [res.toString()])

    assertIsCloseTo(res, BigDecimal.fromString("3.65"), BigDecimal.fromString("0.0001"))
  })

  test("should compute apr in the simplest case when the full period has not elapsed", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = DAY

    // we earn 1% over 1 day, so the APR is 365%
    aprState.addTransaction(BigDecimal.fromString("10"), BigInt.fromI32(0), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("10"), DAY, BigDecimal.fromString("1000"))
    const res = AprCalc.calculateLastApr(WEEK, aprState, now)
    log.debug("res: {}", [res.toString()])

    assertIsCloseTo(res, BigDecimal.fromString("3.65"), BigDecimal.fromString("0.0001"))
  })

  test("should compute apr when yield changes", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = DAY

    aprState.addTransaction(BigDecimal.fromString("10"), BigInt.fromI32(0), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("20"), BigInt.fromI32(10000), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("30"), DAY, BigDecimal.fromString("1000"))
    const res = AprCalc.calculateLastApr(DAY, aprState, now)
    log.debug("res: {}", [res.toString()])

    assertIsCloseTo(res, BigDecimal.fromString("18.25"), BigDecimal.fromString("0.0001"))
  })

  test("should compute apr when total value locked changes", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = DAY

    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(0), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(10000), BigDecimal.fromString("2000"))
    aprState.addTransaction(BigDecimal.fromString("100"), DAY, BigDecimal.fromString("3000"))
    const res = AprCalc.calculateLastApr(DAY, aprState, now)
    log.debug("res: {}", [res.toString()])

    assertIsCloseTo(res, BigDecimal.fromString("54.75"), BigDecimal.fromString("0.0001"))
  })

  test("should compute apr when yield and total value locked changes", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = DAY

    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(0), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("200"), BigInt.fromI32(10000), BigDecimal.fromString("2000"))
    aprState.addTransaction(BigDecimal.fromString("300"), DAY, BigDecimal.fromString("3000"))
    const res = AprCalc.calculateLastApr(DAY, aprState, now)
    log.debug("res: {}", [res.toString()])

    assertIsCloseTo(res, BigDecimal.fromString("127.75"), BigDecimal.fromString("0.0001"))
  })

  test("should allow multiple changes in the same timestamp/block (multicall)", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = DAY

    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(0), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(10000), BigDecimal.fromString("2000"))
    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(10000), BigDecimal.fromString("2000"))
    aprState.addTransaction(BigDecimal.fromString("300"), DAY, BigDecimal.fromString("3000"))
    const res = AprCalc.calculateLastApr(DAY, aprState, now)
    log.debug("res: {}", [res.toString()])

    assertIsCloseTo(res, BigDecimal.fromString("127.75"), BigDecimal.fromString("0.0001"))
  })

  test("should compute apr when the day is not over yet", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    // using 6 decimals
    const one = BigDecimal.fromString("1000000")

    // whatever$ at 00:00, tvl of $100
    // => 0% apr for the first hour
    let now = BigInt.fromI32(0)
    log.debug("\n\n======= now: {}\n", [now.toString()])
    aprState.addTransaction(BigDecimal.fromString("0"), now, one.times(BigDecimal.fromString("100")))
    assert.assertTrue(AprCalc.evictOldEntries(DAY, aprState, now).collects.length === 1)
    let res = AprCalc.calculateLastApr(DAY, aprState, now)
    log.debug("res: {}", [res.toString()])
    assertIsCloseTo(res, ZERO_BD, BigDecimal.fromString("0.0001"))

    // 2: 1$ at 01:00, tvl of $100 => +1% for the first hour
    // => APR_24H is 1% * 24 * 365 => 8760%
    now = BigInt.fromI32(60 * 60)
    log.debug("\n\n======= now: {}\n", [now.toString()])
    aprState.addTransaction(one, now, one.times(BigDecimal.fromString("100")))
    assert.assertTrue(AprCalc.evictOldEntries(DAY, aprState, now).collects.length === 2)
    res = AprCalc.calculateLastApr(DAY, aprState, now)
    log.debug("res: {}", [res.toString()])
    assertIsCloseTo(res, BigDecimal.fromString("87.60"), BigDecimal.fromString("0.0001"))

    // 3: deposit of $100 at 12:00, claiming 10$ => +10% for 11h (because tvl was $100 for the whole period)
    // => +$11 over 12h for a tvl of $100 => +11% over 12h
    // => APR_24h is 11% * 2 * 365 : 8030%
    now = BigInt.fromI32(12 * 60 * 60)
    log.debug("\n\n======= now: {}\n", [now.toString()])
    aprState.addTransaction(one.times(BigDecimal.fromString("10")), now, one.times(BigDecimal.fromString("200")))
    assert.assertTrue(AprCalc.evictOldEntries(DAY, aprState, now).collects.length === 3)
    res = AprCalc.calculateLastApr(DAY, aprState, now)
    log.debug("res: {}", [res.toString()])

    assertIsCloseTo(res, BigDecimal.fromString("80.30"), BigDecimal.fromString("0.0001"))
  })

  test("Should properly compute mooBeefy APR", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())

    // these ones should be ignored
    aprState.addTransaction(
      BigDecimal.fromString("0"),
      BigInt.fromString("1711201231"),
      BigDecimal.fromString("507.5882781815525135710848872656791"),
    )
    aprState.addTransaction(
      BigDecimal.fromString("0.004065784550081421262762731034373881"),
      BigInt.fromString("1711204513"),
      BigDecimal.fromString("516.1787253846584915657179517695577"),
    )

    // these ones should be used
    aprState.addTransaction(
      BigDecimal.fromString("0.02430711381950250190531710544653613"),
      BigInt.fromString("1711226113"),
      BigDecimal.fromString("513.4946880572305829489501989140695"),
    )
    aprState.addTransaction(
      BigDecimal.fromString("0.006869940091541016837589566381232779"),
      BigInt.fromString("1711247715"),
      BigDecimal.fromString("506.0724423742907934604618462166345"),
    )
    aprState.addTransaction(
      BigDecimal.fromString("0.01310706635829128889638"),
      BigInt.fromString("1711269313"),
      BigDecimal.fromString("508.1091471133737574196901844200933"),
    )
    aprState.addTransaction(
      BigDecimal.fromString("0.001774573046281402321668824352704134"),
      BigInt.fromString("1711290913"),
      BigDecimal.fromString("516.3820906223624723194813255682192"),
    )
    aprState.addTransaction(
      BigDecimal.fromString("0.00012315380232791303052005"),
      BigInt.fromString("1711312513"),
      BigDecimal.fromString("518.5576704920643326430271310797996"),
    )

    // 0.006869940091 + 0.013107066358 + 0.001774573046 + 0.000123153802
    // => 0.021874733297
    //
    // 1711312513 - 1711226113
    // => 86400
    //
    // TVL = 518.557670492
    //
    // 0.021874733297 / 518.557670492
    // => 0.0000421838004560 / day
    //
    // (0.021874733297 / 518.557670492) * 365
    // => 0.015397087166466233
    // => 1.5397087166466233% APR
    const now = BigInt.fromString("1711312513")
    const res = AprCalc.calculateLastApr(DAY, aprState, now)
    log.debug("res: {}", [res.toString()])

    assertIsCloseTo(res, BigDecimal.fromString("0.015624358078677"), BigDecimal.fromString("0.0001"))
  })
})

function assertIsCloseTo(actual: BigDecimal, expected: BigDecimal, precision: BigDecimal): void {
  const upperBound = expected.plus(precision)
  const lowerBound = expected.minus(precision)
  assert.assertTrue(actual.gt(lowerBound))
  assert.assertTrue(actual.lt(upperBound))
}
