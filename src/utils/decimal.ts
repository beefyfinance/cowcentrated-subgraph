import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'

export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let TEN_BI = BigInt.fromI32(10)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let TEN_BD = BigDecimal.fromString('10')
export let ONE_ETH_BD = BigDecimal.fromString('1000000000000000000')
export let ONE_GWEI_BI = BigInt.fromI32(1000000000)
export let ONE_GWEI_BD = BigDecimal.fromString('1000000000')

/**
 * Adapted from uniswap subgraph
 * @see https://github.com/Uniswap/v3-subgraph/blob/bf03f940f17c3d32ee58bd37386f26713cff21e2/src/utils/index.ts#L41-L46
 */
@inline
export function tokenAmountToDecimal(tokenAmount: BigInt, exchangeDecimals: BigInt): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return tokenAmount.toBigDecimal()
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals))
}

@inline
export function decimalToTokenAmount(decimal: BigDecimal, exchangeDecimals: BigInt): BigInt {
  if (exchangeDecimals == ZERO_BI) {
    return BigInt.fromString(decimal.toString())
  }
  return BigInt.fromString(decimal.times(exponentToBigDecimal(exchangeDecimals)).toString())
}

@inline
export function weiToBigDecimal(wei: BigInt): BigDecimal {
  return tokenAmountToDecimal(wei, BigInt.fromI32(18))
}

/**
 * Adapted from uniswap subgraph
 * @see https://github.com/Uniswap/v3-subgraph/blob/bf03f940f17c3d32ee58bd37386f26713cff21e2/src/utils/index.ts#L6-L12
 */
@inline
export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = ONE_BD
  let n = decimals.toI32()
  for (let i = 0; i < n; i++) {
    bd = bd.times(TEN_BD)
  }
  return bd
}

@inline
export function exponentToBigInt(decimals: BigInt): BigInt {
  let bd = ONE_BI
  let n = decimals.toI32()
  for (let i = 0; i < n; i++) {
    bd = bd.times(TEN_BI)
  }
  return bd
}

/**
 * Ver
 * @see https://github.com/pancakeswap/pancake-subgraph/blob/e57f6313d5c4e8759f26945a893518d496944d4c/subgraphs/exchange-v3/lite/utils/index.ts#L23-L39
 */
@inline
export function bigDecimalExponated(value: BigDecimal, power: BigInt): BigDecimal {
  if (power.equals(ZERO_BI)) {
    return ONE_BD
  }
  let negativePower = power.lt(ZERO_BI)
  let result = ZERO_BD.plus(value)
  let powerAbs = power.abs()
  for (let i = ONE_BI; i.lt(powerAbs); i = i.plus(ONE_BI)) {
    result = result.times(value)
  }

  if (negativePower) {
    result = safeDiv(ONE_BD, result)
  }

  return result
}

/**
 * Adapted from uniswap subgraph
 * @see https://github.com/Uniswap/v3-subgraph/blob/bf03f940f17c3d32ee58bd37386f26713cff21e2/src/utils/index.ts#L15-L21
 */
@inline
function safeDiv(amount0: BigDecimal, amount1: BigDecimal): BigDecimal {
  if (amount1.equals(ZERO_BD)) {
    return ZERO_BD
  } else {
    return amount0.div(amount1)
  }
}
