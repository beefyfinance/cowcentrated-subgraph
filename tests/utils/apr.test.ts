import { assert, test, describe } from "matchstick-as/assembly/index"
import { BigDecimal, BigInt } from "@graphprotocol/graph-ts"
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

  test("should compute apr properly with one entry", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = BigInt.fromI32(100)

    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(100), BigDecimal.fromString("1000"))
    const res = AprCalc.calculateLastApr(DAY, aprState, now)

    assertIsCloseTo(res, BigDecimal.fromString("0.1"), BigDecimal.fromString("0.0001"))
  })

  test("should compute apr in the simplest case", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = DAY

    // we earn 1% over 1 day, so the APR is 365%
    aprState.addTransaction(BigDecimal.fromString("10"), BigInt.fromI32(0), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("10"), DAY, BigDecimal.fromString("1000"))
    const res = AprCalc.calculateLastApr(DAY, aprState, now)

    assertIsCloseTo(res, BigDecimal.fromString("3.65"), BigDecimal.fromString("0.0001"))
  })

  test("should compute apr in the simplest case when the full period has not elapsed", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = DAY

    // we earn 1% over 1 day, so the APR is 365%
    aprState.addTransaction(BigDecimal.fromString("10"), BigInt.fromI32(0), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("10"), DAY, BigDecimal.fromString("1000"))
    const res = AprCalc.calculateLastApr(WEEK, aprState, now)

    assertIsCloseTo(res, BigDecimal.fromString("3.65"), BigDecimal.fromString("0.0001"))
  })

  test("should compute apr when yield changes", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = DAY

    aprState.addTransaction(BigDecimal.fromString("10"), BigInt.fromI32(0), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("20"), BigInt.fromI32(10000), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("30"), DAY, BigDecimal.fromString("1000"))
    const res = AprCalc.calculateLastApr(DAY, aprState, now)

    assertIsCloseTo(res, BigDecimal.fromString("10.527546"), BigDecimal.fromString("0.0001"))
  })

  test("should compute apr when total value locked changes", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = DAY

    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(0), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(10000), BigDecimal.fromString("2000"))
    aprState.addTransaction(BigDecimal.fromString("100"), DAY, BigDecimal.fromString("3000"))
    const res = AprCalc.calculateLastApr(DAY, aprState, now)

    assertIsCloseTo(res, BigDecimal.fromString("12.870756172"), BigDecimal.fromString("0.0001"))
  })

  test("should compute apr when yield and total value locked changes", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = DAY

    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(0), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("200"), BigInt.fromI32(10000), BigDecimal.fromString("2000"))
    aprState.addTransaction(BigDecimal.fromString("300"), DAY, BigDecimal.fromString("3000"))
    const res = AprCalc.calculateLastApr(DAY, aprState, now)

    assertIsCloseTo(res, BigDecimal.fromString("36.5"), BigDecimal.fromString("0.0001"))
  })

  test("do not crash when TVL is zero now", () => {
    let aprState = AprState.deserialize(new Array<BigDecimal>())
    const now = DAY

    aprState.addTransaction(BigDecimal.fromString("100"), BigInt.fromI32(0), BigDecimal.fromString("1000"))
    aprState.addTransaction(BigDecimal.fromString("200"), BigInt.fromI32(10000), BigDecimal.fromString("2000"))
    aprState.addTransaction(BigDecimal.fromString("300"), DAY, BigDecimal.fromString("0"))
    const res = AprCalc.calculateLastApr(DAY, aprState, now)

    assertIsCloseTo(res, BigDecimal.fromString("4.2245370"), BigDecimal.fromString("0.0001"))
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
})

function assertIsCloseTo(actual: BigDecimal, expected: BigDecimal, precision: BigDecimal): void {
  const upperBound = expected.plus(precision)
  const lowerBound = expected.minus(precision)
  assert.assertTrue(actual.gt(lowerBound))
  assert.assertTrue(actual.lt(upperBound))
}
