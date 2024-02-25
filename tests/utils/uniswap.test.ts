import { assert, clearStore, test, describe, afterAll } from 'matchstick-as/assembly/index'
import { BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
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

  test('Can transform an sqrt price x96 into a true price when decimals are inverted', () => {
    // example from https://blog.uniswap.org/uniswap-v3-math-primer
    // python3
    //   from decimal import Decimal, get_context
    //   get_context().prec = 200
    //   reserve0 = Decimal('1000000000000000000')
    //   reserve1 = Decimal('1539296453')
    //   sqrtPriceX96 = (reserve1/reserve0).sqrt() * (2**96)
    //   print(f'{sqrtPriceX96:.0f}')
    const value = BigInt.fromString('3108427325256432995123990')
    let usdc = new Token(ADDRESS_ZERO)
    let weth = new Token(ADDRESS_ZERO)
    usdc.decimals = BigInt.fromI32(6)
    weth.decimals = BigInt.fromI32(18)

    const token0PriceInToken1 = sqrtPriceX96ToPriceInToken1(value, weth, usdc)

    let targetMin = BigDecimal.fromString('0.00064')
    let targetMax = BigDecimal.fromString('0.00065')
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

  test('Can transform a tick into a price when ticks are negative', () => {
    // example from https://blog.uniswap.org/uniswap-v3-math-primer
    const tick = BigInt.fromString('-31001')
    let usdc = new Token(ADDRESS_ZERO)
    let weth = new Token(ADDRESS_ZERO)
    usdc.decimals = BigInt.fromI32(6)
    weth.decimals = BigInt.fromI32(18)

    const tickPriceInToken1 = tickToPrice(tick, usdc, weth)

    let targetTickMin = BigDecimal.fromString('31640183498')
    let targetTickMax = BigDecimal.fromString('31640183499')
    assert.assertTrue(tickPriceInToken1.gt(targetTickMin), 'Tick value should be approximately correct')
    assert.assertTrue(tickPriceInToken1.lt(targetTickMax), 'Tick value should be approximately correct')
  })

  test('Can transform the maxTick in price', () => {
    // example from https://blog.uniswap.org/uniswap-v3-math-primer
    const tick = BigInt.fromString('887272')
    let usdc = new Token(ADDRESS_ZERO)
    let weth = new Token(ADDRESS_ZERO)
    usdc.decimals = BigInt.fromI32(6)
    weth.decimals = BigInt.fromI32(18)

    const tickPriceInToken1 = tickToPrice(tick, usdc, weth)

    let targetTickMin = BigDecimal.fromString('0.0000000000000000000000000029389568076')
    let targetTickMax = BigDecimal.fromString('0.0000000000000000000000000029389568077')
    assert.assertTrue(tickPriceInToken1.gt(targetTickMin), 'Tick value should be approximately correct')
    assert.assertTrue(tickPriceInToken1.lt(targetTickMax), 'Tick value should be approximately correct')
  })

  test('Can transform a very negative tick into a price', () => {
    // example from https://blog.uniswap.org/uniswap-v3-math-primer
    const tick = BigInt.fromString('-100000')
    let usdc = new Token(ADDRESS_ZERO)
    let weth = new Token(ADDRESS_ZERO)
    usdc.decimals = BigInt.fromI32(6)
    weth.decimals = BigInt.fromI32(18)

    const tickPriceInToken1 = tickToPrice(tick, usdc, weth)

    let targetTickMin = BigDecimal.fromString('22015456048552198.645701456581')
    let targetTickMax = BigDecimal.fromString('22015456048552198.645701456582')
    assert.assertTrue(tickPriceInToken1.gt(targetTickMin), 'Tick value should be approximately correct')
    assert.assertTrue(tickPriceInToken1.lt(targetTickMax), 'Tick value should be approximately correct')
  })

  test('Can transform the min tick into a price', () => {
    // example from https://blog.uniswap.org/uniswap-v3-math-primer
    const tick = BigInt.fromString('-887272')
    let usdc = new Token(ADDRESS_ZERO)
    let weth = new Token(ADDRESS_ZERO)
    usdc.decimals = BigInt.fromI32(6)
    weth.decimals = BigInt.fromI32(18)

    const tickPriceInToken1 = tickToPrice(tick, usdc, weth)

    let targetPrice = BigDecimal.fromString('340256786836388094050805785052980700000000000000000')
    assert.assertTrue(tickPriceInToken1.equals(targetPrice), 'Tick value should be approximately correct')
  })
})
