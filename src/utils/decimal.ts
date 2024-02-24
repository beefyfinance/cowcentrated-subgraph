import { BigDecimal, BigInt, ByteArray } from '@graphprotocol/graph-ts'

export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let ONE_ETH_BD = BigDecimal.fromString('1000000000000000000')
export let ONE_GWEI_BI = BigInt.fromI32(1000000000)
export let ONE_GWEI_BD = BigDecimal.fromString('1000000000')

export function tokenAmountToDecimal(tokenAmount: BigInt, decimals: BigInt): BigDecimal {
  if (decimals == ZERO_BI) {
    return tokenAmount.toBigDecimal()
  }
  let div = BigDecimal.fromString('1'.concat('0'.repeat(decimals.toI32())))
  return tokenAmount.toBigDecimal().div(div)
}

export function weiToDecimal(wei: BigInt): BigDecimal {
  return wei.toBigDecimal().div(ONE_ETH_BD)
}
