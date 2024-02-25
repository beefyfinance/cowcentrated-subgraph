import { BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { ONE_BD, ZERO_BD, bigDecimalExponated } from './decimal'
import { Token } from '../../generated/schema'

const Q96_BD = new BigDecimal(BigInt.fromI32(2).pow(96))

/**
 * Calculate the price of the pair given the sqrt price x96
 * @see https://blog.uniswap.org/uniswap-v3-math-primer
 */
@inline
export function sqrtPriceX96ToPriceInToken1(sqrtPriceX96: BigInt, token0: Token, token1: Token): BigDecimal {
  // here we have to use more precise maths as we are dealing with big numbers
  const sqrtPriceX96Dec = new BigDecimal(sqrtPriceX96)
  let p = sqrtPriceX96Dec.div(Q96_BD)
  let num = p.times(p) // p^2
  let den = decimalDenominatorBigDecimals(token0, token1)
  let adjusted10 = num.div(den)
  let adjusted01 = ZERO_BD
  if (!adjusted10.equals(ZERO_BD)) {
    adjusted01 = ONE_BD.div(adjusted10)
  }
  return adjusted01
}

/**
 * Get the token price of a tick
 * @see https://blog.uniswap.org/uniswap-v3-math-primer
 */
@inline
export function tickToPrice(tickIdx: BigInt, token0: Token, token1: Token): BigDecimal {
  // use a floating point approach for ticks that are not too negative
  // slow version can take as long as 5s to run on a single tick
  // fast version takes a negligible amount of time
  // however the fast version lead to +Infinity results for indexes too negative due to the
  // 1.0001 ** tickIdx operation.
  // experimentally, the fast version is good for indexes above -32000
  if (tickIdx.lt(BigInt.fromI32(-32000))) {
    log.warning('Using slow version of tickToPrice for tickIdx: {}', [tickIdx.toString()])
    return tickToPriceExactButSlow(tickIdx, token0, token1)
  }
  return tickToPriceFloatingPoint(tickIdx, token0, token1)
}

const TICK_N = BigDecimal.fromString('1.0001')
@inline
function tickToPriceExactButSlow(tickIdx: BigInt, token0: Token, token1: Token): BigDecimal {
  // 1.0001 ** tickIdx. This is the slow part
  // could probably be optimized. maybe using an operation to only calculate positive powers of 1.0001
  // use this and add another function for negative powers, idk
  let num = bigDecimalExponated(TICK_N, tickIdx) 
  let den = decimalDenominatorBigDecimals(token0, token1)
  let adjusted10 = num.div(den)
  let adjusted01 = ZERO_BD
  if (! adjusted10.equals(ZERO_BD)) {
    adjusted01 = ONE_BD.div(adjusted10)
  }
  return adjusted01
}

@inline
function tickToPriceFloatingPoint(tickIdx: BigInt, token0: Token, token1: Token): BigDecimal {
  let num = f64(1.0001 ** f64(tickIdx.toU64()))
  let den = decimalDenominator(token0, token1)
  let adjusted10 = num / den
  let adjusted01 = f64(0.0)
  if (adjusted10 != 0) {
    adjusted01 = 1 / adjusted10
  }
  return BigDecimal.fromString(adjusted01.toString())
}


/**
 * Just a helper function not to forget to cast decimals to signed integers
 * before subtracting them.
 */
@inline
function decimalDenominator(token0: Token, token1: Token): f64 {
  return f64(10 ** (token1.decimals.toI32() - token0.decimals.toI32()))
}

@inline
function decimalDenominatorBigDecimals(token0: Token, token1: Token): BigDecimal {
  return BigDecimal.fromString(decimalDenominator(token0, token1).toString())
}