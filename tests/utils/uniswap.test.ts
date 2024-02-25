import { assert, clearStore, test, describe, afterAll } from 'matchstick-as/assembly/index'
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { sqrtPriceX96ToPriceInToken1, tickToPrice } from '../../src/utils/uniswap'
import { Token } from '../../generated/schema'
import { ADDRESS_ZERO } from '../../src/utils/address'

describe('uniswap.sqrtPriceX96ToPriceInToken1', () => {
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
    let targetMin = BigDecimal.fromString('1540.82')
    let targetMax = BigDecimal.fromString('1540.83')
    assert.assertTrue(token0PriceInToken1.gt(targetMin), 'Decimal value should match')
    assert.assertTrue(token0PriceInToken1.lt(targetMax), 'Decimal value should match')
  })
})

describe('uniswap.tickToPrice', () => {
  afterAll(() => {
    clearStore()
  })

  test('Can transform a tick into a price', () => {
    // example from https://blog.uniswap.org/uniswap-v3-math-primer
    const minTick = BigInt.fromString('202910')
    const maxTick = BigInt.fromString('202920')
    let usdc = new Token(ADDRESS_ZERO)
    let weth = new Token(ADDRESS_ZERO)
    usdc.decimals = BigInt.fromI32(6)
    weth.decimals = BigInt.fromI32(18)
    const minTickPriceInToken1 = tickToPrice(minTick, usdc, weth)
    const maxTickPriceInToken1 = tickToPrice(maxTick, usdc, weth)
    let targetMinTickMin = BigDecimal.fromString('1542.30')
    let targetMinTickMax = BigDecimal.fromString('1542.31')
    let targetMaxTickMin = BigDecimal.fromString('1540.76')
    let targetMaxTickMax = BigDecimal.fromString('1540.77')
    assert.assertTrue(minTickPriceInToken1.gt(targetMinTickMin), 'Tick value should be approximately correct')
    assert.assertTrue(minTickPriceInToken1.lt(targetMinTickMax), 'Tick value should be approximately correct')
    assert.assertTrue(maxTickPriceInToken1.gt(targetMaxTickMin), 'Tick value should be approximately correct')
    assert.assertTrue(maxTickPriceInToken1.lt(targetMaxTickMax), 'Tick value should be approximately correct')
  })
})
