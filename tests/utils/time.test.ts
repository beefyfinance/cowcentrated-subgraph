import { assert, test, describe } from "matchstick-as"
import { BigInt } from "@graphprotocol/graph-ts"
import {
  DAY,
  HOUR,
  MONTH,
  QUARTER,
  WEEK,
  YEAR,
  getIntervalFromTimestamp,
  getPreviousIntervalFromTimestamp,
} from "../../src/common/utils/time"

describe("time.getIntervalFromTimestamp", () => {
  test("Support all the different periods", () => {
    const timestamp = BigInt.fromString("1712744972")

    // simple periods
    let res = getIntervalFromTimestamp(timestamp, HOUR)
    assert.assertTrue(res.equals(BigInt.fromString("1712743200")))

    res = getIntervalFromTimestamp(timestamp, DAY)
    assert.assertTrue(res.equals(BigInt.fromString("1712707200")))

    res = getIntervalFromTimestamp(timestamp, WEEK)
    assert.assertTrue(res.equals(BigInt.fromString("1712448000")))

    res = getIntervalFromTimestamp(timestamp, MONTH)
    assert.assertTrue(res.equals(BigInt.fromString("1711929600")))

    res = getIntervalFromTimestamp(timestamp, QUARTER)
    assert.assertTrue(res.equals(BigInt.fromString("1711929600")))

    res = getIntervalFromTimestamp(timestamp, YEAR)
    assert.assertTrue(res.equals(BigInt.fromString("1704067200")))
  })

  test("can query the previous interval as well", () => {
    const timestamp = BigInt.fromString("1712744972")

    // simple periods
    let res = getPreviousIntervalFromTimestamp(timestamp, HOUR)
    assert.assertTrue(res.equals(BigInt.fromString("1712739600")))

    res = getPreviousIntervalFromTimestamp(timestamp, DAY)
    assert.assertTrue(res.equals(BigInt.fromString("1712620800")))

    res = getPreviousIntervalFromTimestamp(timestamp, WEEK)
    assert.assertTrue(res.equals(BigInt.fromString("1711843200")))

    res = getPreviousIntervalFromTimestamp(timestamp, MONTH)
    assert.assertTrue(res.equals(BigInt.fromString("1709251200")))

    res = getPreviousIntervalFromTimestamp(timestamp, QUARTER)
    assert.assertTrue(res.equals(BigInt.fromString("1704067200")))

    res = getPreviousIntervalFromTimestamp(timestamp, YEAR)
    assert.assertTrue(res.equals(BigInt.fromString("1672531200")))
  })
})
