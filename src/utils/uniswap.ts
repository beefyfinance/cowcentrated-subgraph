import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { ONE_BD, ZERO_BD, TEN_BD, bigDecimalExponated, safeDiv } from './decimal'
import { Token } from '../../generated/schema'

const Q96 = new BigDecimal(BigInt.fromI32(2).pow(96))

/**
 * Calculate the price of the pair given the sqrt price x96
 * @see https://blog.uniswap.org/uniswap-v3-math-primer
 */
export function sqrtPriceX96ToPriceInToken1(sqrtPriceX96: BigInt, token0: Token, token1: Token): BigDecimal {
  const sqrtPriceX96Dec = new BigDecimal(sqrtPriceX96)
  let p = sqrtPriceX96Dec.div(Q96)
  let num = bigDecimalExponated(p, BigInt.fromI32(2))
  let div = bigDecimalExponated(TEN_BD, BigInt.fromI32(token1.decimals.toI32() - token0.decimals.toI32()))
  let adjusted10 = num.div(div)
  let adjusted01 = ZERO_BD
  if (!adjusted10.equals(ZERO_BD)) {
    adjusted01 = ONE_BD.div(adjusted10)
  }
  return adjusted01
}

const TICK_N = BigDecimal.fromString('1.0001')

/**
 * Get the token price of a tick
 * @see https://blog.uniswap.org/uniswap-v3-math-primer
 * Note: this is extremely slow and inefficient, call with caution.
 */
export function tickToPrice(tickIdx: BigInt, token0: Token, token1: Token): BigDecimal {
  let num = bigDecimalExponated(TICK_N, tickIdx)
  let div = bigDecimalExponated(TEN_BD, BigInt.fromI32(token1.decimals.toI32() - token0.decimals.toI32()))
  let adjusted10 = num.div(div)
  let adjusted01 = safeDiv(ONE_BD, adjusted10)
  return adjusted01
}
