import { BigInt } from '@graphprotocol/graph-ts'
import { ZERO_BN, ONE_BN, biToBn } from './decimal'
import { Token } from '../../generated/schema'
import { BigNumber } from 'as-bignumber'

let Q96 = (ONE_BN + ONE_BN).pow(96)

/**
 * Calculate the price of the pair given the sqrt price x96
 */
export function sqrtPriceX96ToPriceInToken1(sqrtPriceX96: BigInt, token0: Token, token1: Token): BigNumber {
  let ten = BigNumber.from(10)
  let num = biToBn(sqrtPriceX96).div(Q96).pow(2)
  let div = ten.pow(token1.decimals.toI32() - token0.decimals.toI32())
  let adjusted10 = num.div(div)
  let adjusted01 = ZERO_BN
  if (!adjusted10.eq(0)) {
    adjusted01 = ONE_BN.div(adjusted10)
  }
  return adjusted01
}

// @see: https://github.com/Uniswap/v3-subgraph/blob/bf03f940f17c3d32ee58bd37386f26713cff21e2/src/utils/tick.ts#L42C1-L58C2
export function feeTierToTickSpacing(feeTier: BigInt): BigInt {
  if (feeTier.equals(BigInt.fromI32(10000))) {
    return BigInt.fromI32(200)
  }
  if (feeTier.equals(BigInt.fromI32(3000))) {
    return BigInt.fromI32(60)
  }
  if (feeTier.equals(BigInt.fromI32(500))) {
    return BigInt.fromI32(10)
  }
  if (feeTier.equals(BigInt.fromI32(100))) {
    return BigInt.fromI32(1)
  }

  throw Error('Unexpected fee tier')
}
