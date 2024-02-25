import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { Token } from '../../generated/schema'
import { BigNumber } from 'as-bignumber'

export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let ZERO_BN = BigNumber.fromString('0')
export let ONE_BN = BigNumber.fromString('1')
export let ONE_ETH_BD = BigDecimal.fromString('1000000000000000000')
export let ONE_ETH_BN = BigNumber.fromString('1000000000000000000')
export let ONE_GWEI_BI = BigInt.fromI32(1000000000)
export let ONE_GWEI_BD = BigDecimal.fromString('1000000000')
export let ONE_GWEI_BN = BigNumber.fromString('1000000000')

export function tokenAmountToBigNumber(tokenAmount: BigInt, token: Token): BigNumber {
  let amount = biToBn(tokenAmount)
  if (token.decimals.equals(ZERO_BI)) {
    return amount
  }
  let div = decimalsToDivisor(token.decimals)
  return amount.div(div)
}

export function decimalsToDivisor(decimals: BigInt): BigNumber {
  let ten = BigNumber.from(10)
  return ten.pow(decimals.toI32())
}

export function weiToBigNumber(wei: BigInt): BigNumber {
  return biToBn(wei).div(ONE_ETH_BN)
}

export function bnToBd(bn: BigNumber): BigDecimal {
  return BigDecimal.fromString(bn.toString())
}
export function bdToBn(bd: BigDecimal): BigNumber {
  return BigNumber.fromString(bd.toString())
}
export function biToBn(bi: BigInt): BigNumber {
  return BigNumber.fromString(bi.toString())
}
