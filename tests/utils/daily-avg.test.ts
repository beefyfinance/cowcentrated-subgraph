import { assert, test, describe } from "matchstick-as/assembly/index"
import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import { DailyAvgCalc, DailyAvgState } from "../../src/utils/daily-avg"
import { ZERO_BD } from "../../src/utils/decimal"
import { DAY, HOUR, WEEK } from "../../src/utils/time"

describe("DailyAvgState", () => {
  test("Can serialize and deserialize a moving avg state with no entries", () => {
    const state = DailyAvgState.deserialize([])
    assert.assertTrue(state.closedValues.length === 0)
  })

  test("Can serialize and deserialize a moving avg state with zero entries", () => {
    const pendingValue = BigDecimal.fromString("101.1235")
    const pendingValueTimestamp = BigInt.fromI32(123)
    const state = DailyAvgState.deserialize([pendingValue, pendingValueTimestamp.toBigDecimal()])
    assert.assertTrue(state.closedValues.length === 0)
    assert.assertTrue(state.pendingValue.equals(pendingValue))
    assert.assertTrue(state.pendingValueTimestamp.equals(pendingValueTimestamp))

    const serialized = state.serialize()
    assert.assertTrue(serialized.length === 2)
    assert.assertTrue(serialized[0].equals(pendingValue))
    assert.assertTrue(serialized[1].equals(pendingValueTimestamp.toBigDecimal()))
  })

  test("Can serialize and deserialize a moving avg state", () => {
    const pendingValue = BigDecimal.fromString("101.1235")
    const pendingValueTimestamp = BigInt.fromI32(123)
    const value0 = BigDecimal.fromString("102")
    const value1 = BigDecimal.fromString("103.235")
    const state = DailyAvgState.deserialize([pendingValue, pendingValueTimestamp.toBigDecimal(), value0, value1])
    assert.assertTrue(state.closedValues.length === 2)
    assert.assertTrue(state.pendingValue.equals(pendingValue))
    assert.assertTrue(state.pendingValueTimestamp.equals(pendingValueTimestamp))
    assert.assertTrue(state.closedValues[0].equals(value0))
    assert.assertTrue(state.closedValues[1].equals(value1))

    const serialized = state.serialize()
    assert.assertTrue(serialized.length === 4)
    assert.assertTrue(serialized[0].equals(pendingValue))
    assert.assertTrue(serialized[1].equals(pendingValueTimestamp.toBigDecimal()))
    assert.assertTrue(serialized[2].equals(value0))
    assert.assertTrue(serialized[3].equals(value1))
  })
})

describe("DailyAvgCalc", () => {
  test("Can create moving avg calc with no state", () => {
    const state = DailyAvgState.deserialize(new Array<BigDecimal>())
    const res = DailyAvgCalc.avg(BigInt.fromU32(3), state)
    assert.assertTrue(res.equals(ZERO_BD))
  })

  test("do not crash when avg is zero now", () => {
    let state = DailyAvgState.deserialize(new Array<BigDecimal>())

    state.addValue(BigDecimal.fromString("100"))
    state.addValue(BigDecimal.fromString("0"))
    const res = DailyAvgCalc.avg(BigInt.fromU32(3), state)

    assert.assertTrue(res.equals(BigDecimal.fromString("50")))
  })

  test("should evict old entries", () => {
    let state = DailyAvgState.deserialize(new Array<BigDecimal>())

    state.addValue(BigDecimal.fromString("100"))
    state.addValue(BigDecimal.fromString("200"))
    state.addValue(BigDecimal.fromString("300"))
    state.addValue(BigDecimal.fromString("400"))
    state.addValue(BigDecimal.fromString("500"))
    state = DailyAvgCalc.evictOldEntries(BigInt.fromU32(3), state)

    assert.assertTrue(state.closedValues.length === 3)
    assert.assertTrue(state.closedValues[0].equals(BigDecimal.fromString("300")))
  })

  test("should compute moving avg properly with one entry", () => {
    let state = DailyAvgState.deserialize(new Array<BigDecimal>())

    state.addValue(BigDecimal.fromString("100"))
    const res = DailyAvgCalc.avg(BigInt.fromU32(3), state)
    log.debug("res: {}", [res.toString()])

    assertIsCloseTo(res, BigDecimal.fromString("100"), BigDecimal.fromString("100"))
  })

  test("should compute moving avg in the simplest case", () => {
    let state = DailyAvgState.deserialize(new Array<BigDecimal>())

    // we have 2 simple values and a pending value
    state.addValue(BigDecimal.fromString("10"))
    state.addValue(BigDecimal.fromString("30"))
    const res = DailyAvgCalc.avg(BigInt.fromU32(3), state)
    log.debug("res: {}", [res.toString()])

    assert.assertTrue(res.equals(BigDecimal.fromString("20")))
  })

  test("should compute moving avg after eviction of old values", () => {
    let state = DailyAvgState.deserialize(new Array<BigDecimal>())

    // those values will be evicted
    state.addValue(BigDecimal.fromString("100"))
    state.addValue(BigDecimal.fromString("100"))
    state.addValue(BigDecimal.fromString("100"))
    state.addValue(BigDecimal.fromString("100"))
    // will only keep the last 3 values
    state.addValue(BigDecimal.fromString("20"))
    state.addValue(BigDecimal.fromString("10"))
    state.addValue(BigDecimal.fromString("30"))
    const res = DailyAvgCalc.avg(BigInt.fromU32(3), state)
    log.debug("res: {}", [res.toString()])

    assert.assertTrue(res.equals(BigDecimal.fromString("20")))
  })

  test("should compute moving avg with a pending value", () => {
    let state = DailyAvgState.deserialize(new Array<BigDecimal>())

    // we have 2 simple values and a pending value
    state.addValue(BigDecimal.fromString("10"))
    state.addValue(BigDecimal.fromString("30"))
    state.setPendingValue(BigDecimal.fromString("100"), HOUR) // 1h with a big value
    const res = DailyAvgCalc.avg(BigInt.fromU32(3), state)
    log.debug("res: {}", [res.toString()])

    assertIsCloseTo(res, BigDecimal.fromString("21.6326530612"), BigDecimal.fromString("0.000001"))
  })
})

function assertIsCloseTo(actual: BigDecimal, expected: BigDecimal, precision: BigDecimal): void {
  const upperBound = expected.plus(precision)
  const lowerBound = expected.minus(precision)
  assert.assertTrue(actual.gt(lowerBound))
  assert.assertTrue(actual.lt(upperBound))
}
