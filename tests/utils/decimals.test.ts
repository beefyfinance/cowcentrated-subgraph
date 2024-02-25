import { assert, clearStore, test, describe, afterAll } from 'matchstick-as/assembly/index'
import { BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { exponentToBigDecimal, tokenAmountToDecimal } from '../../src/utils/decimal'

describe('decimals.tokenAmountToDecimal', () => {
  afterAll(() => {
    clearStore()
  })

  test('Can transform a simple value into a decimal value', () => {
    const value = BigInt.fromString('1000000000000000000')
    const res = tokenAmountToDecimal(value, BigInt.fromI32(18))
    assert.stringEquals(res.toString(), '1', 'Decimal value should match')
  })

  test('Can transform a simple value into a decimal value with 6 decimals', () => {
    const value = BigInt.fromString('1000000')
    const res = tokenAmountToDecimal(value, BigInt.fromI32(6))
    assert.stringEquals(res.toString(), '1', 'Decimal value should match')
  })

  test('Can transform a simple value into a decimal value with 0 decimals', () => {
    const value = BigInt.fromString('1000000')
    const res = tokenAmountToDecimal(value, BigInt.fromI32(0))
    assert.stringEquals(res.toString(), '1000000', 'Decimal value should match')
  })

  test('Can transform a value with many decimals value into a decimal object as long as the upper digit count is less than 34', () => {
    const value = BigInt.fromString('123456789012345678901234567890')
    const res = tokenAmountToDecimal(value, BigInt.fromI32(18))
    assert.stringEquals(res.toString(), '123456789012.34567890123456789', 'Decimal value should match')
  })
})

describe('decimals.exponentToBigDecimal', () => {
  afterAll(() => {
    clearStore()
  })

  test('Can transform a simple value into a decimal value', () => {
    const value = BigInt.fromI32(18)
    const res = exponentToBigDecimal(value)
    assert.stringEquals(res.toString(), '1000000000000000000', 'Decimal value should match')
  })

  test('Can transform a simple value into a decimal value with 6 decimals', () => {
    const value = BigInt.fromI32(6)
    const res = exponentToBigDecimal(value)
    assert.stringEquals(res.toString(), '1000000', 'Decimal value should match')
  })

  test('Can transform a simple value into a decimal value with 0 decimals', () => {
    const value = BigInt.fromI32(0)
    const res = exponentToBigDecimal(value)
    assert.stringEquals(res.toString(), '1', 'Decimal value should match')
  })
})
