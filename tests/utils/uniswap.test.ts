import { assert, clearStore, test, describe, afterAll } from "matchstick-as/assembly/index"
import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import { tickToPrice } from "../../src/utils/uniswap"
import { Token } from "../../generated/schema"
import { ADDRESS_ZERO } from "../../src/utils/address"

describe("uniswap.tickToPrice", () => {
  afterAll(() => {
    clearStore()
  })

  /**
   * example from https://blog.uniswap.org/uniswap-v3-math-primer
   *
   * def tick_to_price(tick, decimal0, decimal1):
   *     num = 1.0001**tick
   *     den = 10**(decimal1-decimal0)
   *     price0 = num / den
   *     price1 = 1.0 / price0
   *     print("===tick: %d\n num: %f\n den: %f\n price0: %f\n price1: %f" % (tick, num, den, price0, price1))
   *
   *
   * import math
   * def tick_to_price_log(tick, decimal0, decimal1):
   *     # 1 / ((1.0001 ** x) / (10 ** d)) = exp(d * log(10) - x * log(1.0001))
   *     d = decimal1 - decimal0
   *     a = d * math.log(10)
   *     b = tick * math.log(1.0001)
   *     log_res = a - b
   *     price1 = math.exp(log_res)
   *     price0 = 1.0 / price1
   *     print("===tick: %d\n a: %f\n b: %f\n log_res: %f\n price0: %f\n price1: %f" % (tick, a, b, log_res, price0, price1))
   *
   */
  test("Can transform a tick into a price", () => {
    const minTick = BigInt.fromString("202910")
    const maxTick = BigInt.fromString("202920")
    let usdc = new Token(ADDRESS_ZERO)
    let weth = new Token(ADDRESS_ZERO)
    usdc.decimals = BigInt.fromI32(6)
    weth.decimals = BigInt.fromI32(18)

    const minTickPriceInToken1 = tickToPrice(minTick, usdc, weth)
    const maxTickPriceInToken1 = tickToPrice(maxTick, usdc, weth)

    let targetMinTickMin = BigDecimal.fromString("1542.30")
    let targetMinTickMax = BigDecimal.fromString("1542.31")
    let targetMaxTickMin = BigDecimal.fromString("1540.76")
    let targetMaxTickMax = BigDecimal.fromString("1540.77")
    assert.assertTrue(minTickPriceInToken1.gt(targetMinTickMin), "Tick value should be approximately correct")
    assert.assertTrue(minTickPriceInToken1.lt(targetMinTickMax), "Tick value should be approximately correct")
    assert.assertTrue(maxTickPriceInToken1.gt(targetMaxTickMin), "Tick value should be approximately correct")
    assert.assertTrue(maxTickPriceInToken1.lt(targetMaxTickMax), "Tick value should be approximately correct")
  })

  test("Can transform a tick into a price when ticks are negative", () => {
    const tick = BigInt.fromString("-31001")
    let usdc = new Token(ADDRESS_ZERO)
    let weth = new Token(ADDRESS_ZERO)
    usdc.decimals = BigInt.fromI32(6)
    weth.decimals = BigInt.fromI32(18)

    const tickPriceInToken1 = tickToPrice(tick, usdc, weth)

    let targetTickMin = BigDecimal.fromString("22196730546060.1")
    let targetTickMax = BigDecimal.fromString("22196730546060.2")
    assert.assertTrue(tickPriceInToken1.gt(targetTickMin), "Tick value should be approximately correct")
    assert.assertTrue(tickPriceInToken1.lt(targetTickMax), "Tick value should be approximately correct")
  })

  test("Can transform the maxTick in price", () => {
    const tick = BigInt.fromString("887272")
    let usdc = new Token(ADDRESS_ZERO)
    let weth = new Token(ADDRESS_ZERO)
    usdc.decimals = BigInt.fromI32(6)
    weth.decimals = BigInt.fromI32(18)

    const tickPriceInToken1 = tickToPrice(tick, usdc, weth)

    let targetTickMin = BigDecimal.fromString("2.938956807614e-27")
    let targetTickMax = BigDecimal.fromString("2.938956907615e-27")
    assert.assertTrue(tickPriceInToken1.gt(targetTickMin), "Tick value should be approximately correct")
    assert.assertTrue(tickPriceInToken1.lt(targetTickMax), "Tick value should be approximately correct")
  })

  test("Can transform a very negative tick into a price", () => {
    const tick = BigInt.fromString("-100000")
    let usdc = new Token(ADDRESS_ZERO)
    let weth = new Token(ADDRESS_ZERO)
    usdc.decimals = BigInt.fromI32(6)
    weth.decimals = BigInt.fromI32(18)

    const tickPriceInToken1 = tickToPrice(tick, usdc, weth)

    let targetTickMin = BigDecimal.fromString("2.20154560485280e+16")
    let targetTickMax = BigDecimal.fromString("2.20154560485281e+16")

    assert.assertTrue(tickPriceInToken1.gt(targetTickMin), "Tick value should be approximately correct")
    assert.assertTrue(tickPriceInToken1.lt(targetTickMax), "Tick value should be approximately correct")
  })

  test("Can transform the min tick into a price", () => {
    const tick = BigInt.fromString("-887272")
    let usdc = new Token(ADDRESS_ZERO)
    let weth = new Token(ADDRESS_ZERO)
    usdc.decimals = BigInt.fromI32(6)
    weth.decimals = BigInt.fromI32(18)

    const tickPriceInToken1 = tickToPrice(tick, usdc, weth)

    // true value is 340256786833063068514507077617520209684190474534912, close enough
    let targetPrice = BigDecimal.fromString("340256786833063080000000000000000000000000000000000")
    assert.assertTrue(tickPriceInToken1.equals(targetPrice), "Tick value should be approximately correct")
  })

  test("Can transform a tick into a price when decimals are inverted", () => {
    const tick = BigInt.fromString("887272")
    let usdc = new Token(ADDRESS_ZERO)
    let weth = new Token(ADDRESS_ZERO)
    usdc.decimals = BigInt.fromI32(18)
    weth.decimals = BigInt.fromI32(6)

    const tickPriceInToken1 = tickToPrice(tick, weth, usdc)

    let targetTickMin = BigDecimal.fromString("2.93895680761429e-27")
    let targetTickMax = BigDecimal.fromString("2.93895680761430e-27")
    assert.assertTrue(tickPriceInToken1.gt(targetTickMin), "Tick value should be approximately correct")
    assert.assertTrue(tickPriceInToken1.lt(targetTickMax), "Tick value should be approximately correct")
  })

  test("Can transform a very negative tick into a price when decimals are inverted", () => {
    const tick = BigInt.fromString("-887272")
    let usdc = new Token(ADDRESS_ZERO)
    let weth = new Token(ADDRESS_ZERO)
    usdc.decimals = BigInt.fromI32(18)
    weth.decimals = BigInt.fromI32(6)

    const tickPriceInToken1 = tickToPrice(tick, weth, usdc)

    // true value is 340256786833063525436630628682351520367867445903360, close enough
    let targetTick = BigDecimal.fromString("340256786833063080000000000000000000000000000000000")
    assert.assertTrue(tickPriceInToken1.equals(targetTick), "Tick value should be correct")
  })
})
