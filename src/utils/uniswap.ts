import { BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import { ONE_BD, ZERO_BD } from "./decimal"
import { Token } from "../../generated/schema"

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
  const f_den = f64(10 ** (token1.decimals.toI32() - token0.decimals.toI32()))
  let den = BigDecimal.fromString(f_den.toString())
  let adjusted10 = num.div(den)
  let adjusted01 = ZERO_BD
  if (!adjusted10.equals(ZERO_BD)) {
    adjusted01 = ONE_BD.div(adjusted10)
  }
  return adjusted01
}

const LOG_1_0001 = f64(Math.log(1.0001))
const LOG_10 = f64(Math.log(10))

/**
 * Get the token price of a tick
 * @see https://blog.uniswap.org/uniswap-v3-math-primer
 */
@inline
export function tickToPrice(tickIdx: BigInt, token0: Token, token1: Token): BigDecimal {
  // 1 / ((1.0001 ** x) / (10 ** d)) = exp(d * log(10) - x * log(1.0001))
  const d = f64(token1.decimals.toI64() - token0.decimals.toI64())
  const a = d * LOG_10
  const b = f64(tickIdx.toI64()) * LOG_1_0001
  const log_res = a - b
  const res = Math.exp(log_res)
  // FIXME: find a better way to convert the float to a BigDecimal
  // at the moment, toString converts the float into scientific notation
  // this is loosing some precision. as we don't ever use the whole 34 digits of precision
  // of BigDecimal, if we could convert the float to a string without scientific notation
  // or with a scientific notation that shows 34 decimals of precision, we could use that
  // instead.
  return BigDecimal.fromString(res.toString())
}
