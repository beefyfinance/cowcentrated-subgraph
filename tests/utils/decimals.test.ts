import { assert, clearStore, test, describe, afterAll } from 'matchstick-as/assembly/index'
import { BigInt, log } from '@graphprotocol/graph-ts'
import { decimalsToDivisor, tokenAmountToBigNumber } from '../../src/utils/decimal'
import { Token } from '../../generated/schema'
import { ADDRESS_ZERO } from '../../src/utils/address'

describe('decimals.tokenAmountToBigNumber', () => {
  afterAll(() => {
    clearStore()
  })

  test('Can transform a simple value into a decimal value', () => {
    const value = BigInt.fromString('1000000000000000000')
    let token = new Token(ADDRESS_ZERO)
    token.decimals = BigInt.fromI32(18)
    const res = tokenAmountToBigNumber(value, token)
    assert.stringEquals(res.toString(), '1', 'Decimal value should match')
  })

  test('Can transform a simple value into a decimal value with 6 decimals', () => {
    const value = BigInt.fromString('1000000')
    let token = new Token(ADDRESS_ZERO)
    token.decimals = BigInt.fromI32(6)
    const res = tokenAmountToBigNumber(value, token)
    assert.stringEquals(res.toString(), '1', 'Decimal value should match')
  })

  test('Can transform a simple value into a decimal value with 0 decimals', () => {
    const value = BigInt.fromString('1000000')
    let token = new Token(ADDRESS_ZERO)
    token.decimals = BigInt.fromI32(0)
    const res = tokenAmountToBigNumber(value, token)
    assert.stringEquals(res.toString(), '1000000', 'Decimal value should match')
  })

  test('Can transform a value with many decimals value into a decimal object as long as the upper digit count is less than 34', () => {
    const value = BigInt.fromString('123456789012345678901234567890')
    let token = new Token(ADDRESS_ZERO)
    token.decimals = BigInt.fromI32(18)
    const res = tokenAmountToBigNumber(value, token)
    assert.stringEquals(res.toString(), '123456789012.34567890123456789', 'Decimal value should match')
  })

  test('Can transform a value with many decimals value now that we use BigNumber instead of BigDecimal', () => {
    const value = BigInt.fromString(
      '123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890',
    )
    let token = new Token(ADDRESS_ZERO)
    token.decimals = BigInt.fromI32(18)
    const res = tokenAmountToBigNumber(value, token)
    assert.stringEquals(
      res.toString(),
      '123456789012345678901234567890123456789012345678901234567890123456789012.34567890123456789',
      'Decimal value should match',
    )
  })
})

describe('decimals.decimalsToDivisor', () => {
  afterAll(() => {
    clearStore()
  })

  test('Can transform a simple value into a decimal value', () => {
    const value = BigInt.fromI32(18)
    const res = decimalsToDivisor(value)
    assert.stringEquals(res.toString(), '1000000000000000000', 'Decimal value should match')
  })

  test('Can transform a simple value into a decimal value with 6 decimals', () => {
    const value = BigInt.fromI32(6)
    const res = decimalsToDivisor(value)
    assert.stringEquals(res.toString(), '1000000', 'Decimal value should match')
  })

  test('Can transform a simple value into a decimal value with 0 decimals', () => {
    const value = BigInt.fromI32(0)
    const res = decimalsToDivisor(value)
    assert.stringEquals(res.toString(), '1', 'Decimal value should match')
  })
})
