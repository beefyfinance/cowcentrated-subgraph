import { assert, clearStore, test, describe, afterAll } from 'matchstick-as/assembly/index'
import { BigInt, log } from '@graphprotocol/graph-ts'
import { sqrtPriceX96ToPriceInToken1 } from '../../src/utils/uniswap'
import { Token } from '../../generated/schema'
import { ADDRESS_ZERO } from '../../src/utils/address'
import { BigNumber } from 'as-bignumber'

describe('Uniswap', () => {
  afterAll(() => {
    clearStore()
  })

  test('Can transform an sqrt price x96 into a true price', () => {
    // example from https://blog.uniswap.org/uniswap-v3-math-primer
    const value = BigInt.fromString('2018382873588440326581633304624437')
    let usdc = new Token(ADDRESS_ZERO)
    let weth = new Token(ADDRESS_ZERO)
    usdc.decimals = BigInt.fromI32(6)
    weth.decimals = BigInt.fromI32(18)
    const token0PriceInToken1 = sqrtPriceX96ToPriceInToken1(value, usdc, weth)
    log.info('Token0 price: {}', [token0PriceInToken1.toString()])
    let targetMin = BigNumber.fromString('1540.82')
    let targetMax = BigNumber.fromString('1540.83')
    assert.assertTrue(token0PriceInToken1.gte(targetMin), 'Decimal value should match')
    assert.assertTrue(token0PriceInToken1.lte(targetMax), 'Decimal value should match')
  })
})
