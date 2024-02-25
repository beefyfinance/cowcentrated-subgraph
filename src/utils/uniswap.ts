import { BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { ONE_BD, ZERO_BD, TEN_BD, bigDecimalExponated } from './decimal'
import { Token } from '../../generated/schema'

const Q96_BD = new BigDecimal(BigInt.fromI32(2).pow(96))

/**
 * Calculate the price of the pair given the sqrt price x96
 * @see https://blog.uniswap.org/uniswap-v3-math-primer
 */
export function sqrtPriceX96ToPriceInToken1(sqrtPriceX96: BigInt, token0: Token, token1: Token): BigDecimal {
  // here we have to use more precise maths as we are dealing with big numbers
  const sqrtPriceX96Dec = new BigDecimal(sqrtPriceX96)
  let p = sqrtPriceX96Dec.div(Q96_BD)
  let num = bigDecimalExponated(p, BigInt.fromI32(2))
  let div = bigDecimalExponated(TEN_BD, BigInt.fromI32(token1.decimals.toI32() - token0.decimals.toI32()))
  let adjusted10 = num.div(div)
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
export function tickToPrice(tickIdx: BigInt, token0: Token, token1: Token): BigDecimal {
  // we can safely use standard maths here as we are certain to deal with small numbers in the range [-887272;887272]
  let num = f64(1.0001 ** f64(tickIdx.toU64()))
  let den = f64(10 ** (token1.decimals - token0.decimals).toU32())
  let adjusted10 = num / den
  let adjusted01 = f64(0.0)
  if (adjusted10 != 0) {
    adjusted01 = 1 / adjusted10
  }
  return BigDecimal.fromString(adjusted01.toString())
}
