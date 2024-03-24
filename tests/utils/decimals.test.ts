import { assert, clearStore, test, describe, afterAll } from "matchstick-as/assembly/index"
import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import {
  bigDecMax,
  bigIntMax,
  bigDecMin,
  bigIntMin,
  decimalToTokenAmount,
  exponentToBigDecimal,
  tokenAmountToDecimal,
} from "../../src/utils/decimal"

describe("decimals.tokenAmountToDecimal", () => {
  afterAll(() => {
    clearStore()
  })

  test("Can transform a simple value into a decimal value", () => {
    const value = BigInt.fromString("1000000000000000000")
    const res = tokenAmountToDecimal(value, BigInt.fromI32(18))
    assert.stringEquals(res.toString(), "1", "Decimal value should match")
  })

  test("Can transform a simple value into a decimal value with 6 decimals", () => {
    const value = BigInt.fromString("1000000")
    const res = tokenAmountToDecimal(value, BigInt.fromI32(6))
    assert.stringEquals(res.toString(), "1", "Decimal value should match")
  })

  test("Can transform a simple value into a decimal value with 0 decimals", () => {
    const value = BigInt.fromString("1000000")
    const res = tokenAmountToDecimal(value, BigInt.fromI32(0))
    assert.stringEquals(res.toString(), "1000000", "Decimal value should match")
  })

  test("Can transform a value with many decimals value into a decimal object as long as the upper digit count is less than 34", () => {
    const value = BigInt.fromString("123456789012345678901234567890")
    const res = tokenAmountToDecimal(value, BigInt.fromI32(18))
    assert.stringEquals(res.toString(), "123456789012.34567890123456789", "Decimal value should match")
  })
})

describe("decimals.decimalToTokenAmount", () => {
  afterAll(() => {
    clearStore()
  })

  test("Can transform a simple decimal value into a token amount", () => {
    const value = BigDecimal.fromString("1")
    const res = decimalToTokenAmount(value, BigInt.fromI32(18))
    assert.stringEquals(res.toString(), "1000000000000000000", "Token amount should match")
  })

  test("Can transform a simple decimal value with 6 decimals into a token amount", () => {
    const value = BigDecimal.fromString("1")
    const res = decimalToTokenAmount(value, BigInt.fromI32(6))
    assert.stringEquals(res.toString(), "1000000", "Token amount should match")
  })

  test("Can transform a simple decimal value with 0 decimals into a token amount", () => {
    const value = BigDecimal.fromString("1000000")
    const res = decimalToTokenAmount(value, BigInt.fromI32(0))
    assert.stringEquals(res.toString(), "1000000", "Token amount should match")
  })

  test("Can transform a decimal value with many decimals into a token amount", () => {
    const value = BigDecimal.fromString("123456789012.34567890123456789")
    const res = decimalToTokenAmount(value, BigInt.fromI32(18))
    assert.stringEquals(res.toString(), "123456789012345678901234567890", "Token amount should match")
  })
})

describe("decimals.exponentToBigDecimal", () => {
  afterAll(() => {
    clearStore()
  })

  test("Can transform a simple value into a decimal value", () => {
    const value = BigInt.fromI32(18)
    const res = exponentToBigDecimal(value)
    assert.stringEquals(res.toString(), "1000000000000000000", "Decimal value should match")
  })

  test("Can transform a simple value into a decimal value with 6 decimals", () => {
    const value = BigInt.fromI32(6)
    const res = exponentToBigDecimal(value)
    assert.stringEquals(res.toString(), "1000000", "Decimal value should match")
  })

  test("Can transform a simple value into a decimal value with 0 decimals", () => {
    const value = BigInt.fromI32(0)
    const res = exponentToBigDecimal(value)
    assert.stringEquals(res.toString(), "1", "Decimal value should match")
  })
})

describe("decimals.exponentToBigInt", () => {
  afterAll(() => {
    clearStore()
  })

  test("Can transform a simple value into a big int value", () => {
    const value = BigInt.fromI32(18)
    const res = exponentToBigDecimal(value)
    assert.stringEquals(res.toString(), "1000000000000000000", "Decimal value should match")
  })

  test("Can transform a simple value into a big int value with 6 decimals", () => {
    const value = BigInt.fromI32(6)
    const res = exponentToBigDecimal(value)
    assert.stringEquals(res.toString(), "1000000", "Decimal value should match")
  })

  test("Can transform a simple value into a big int value with 0 decimals", () => {
    const value = BigInt.fromI32(0)
    const res = exponentToBigDecimal(value)
    assert.stringEquals(res.toString(), "1", "Decimal value should match")
  })
})

describe("decimals min max", () => {
  test("Can return the minimum of two big decimals", () => {
    const a = BigDecimal.fromString("1")
    const b = BigDecimal.fromString("2")
    const res = bigDecMin(a, b)
    assert.stringEquals(res.toString(), "1", "Minimum value should match")
  })
  test("Can return the max of two big decimals", () => {
    const a = BigDecimal.fromString("1")
    const b = BigDecimal.fromString("2")
    const res = bigDecMax(a, b)
    assert.stringEquals(res.toString(), "2", "Minimum value should match")
  })

  test("Can return the minimum of two big ints", () => {
    const a = BigInt.fromI32(1)
    const b = BigInt.fromI32(2)
    const res = bigIntMin(a, b)
    assert.stringEquals(res.toString(), "1", "Minimum value should match")
  })
  test("Can return the max of two big ints", () => {
    const a = BigInt.fromI32(1)
    const b = BigInt.fromI32(2)
    const res = bigIntMax(a, b)
    assert.stringEquals(res.toString(), "2", "Minimum value should match")
  })
})
