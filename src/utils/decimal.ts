import { BigDecimal, BigInt } from "@graphprotocol/graph-ts"

export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let TEN_BI = BigInt.fromI32(10)
export let ZERO_BD = BigDecimal.fromString("0")
export let ONE_BD = BigDecimal.fromString("1")
export let TEN_BD = BigDecimal.fromString("10")
export let EIGHTEEN_BI = BigInt.fromI32(18)
export let ONE_ETH_BD = BigDecimal.fromString("1000000000000000000")
export let ONE_ETH_BI = BigInt.fromString("1000000000000000000")
export let ONE_GWEI_BI = BigInt.fromI32(1000000000)
export let ONE_GWEI_BD = BigDecimal.fromString("1000000000")


@inline
export function changeValueEncoding(
  value: BigInt,
  currentDecimalsEncoding: BigInt,
  requestedDecimalsEcoding: BigInt,
): BigInt {
  if (currentDecimalsEncoding.equals(requestedDecimalsEcoding)) {
    return value
  } else if (currentDecimalsEncoding.gt(requestedDecimalsEcoding)) {
    return value.div(exponentToBigInt(currentDecimalsEncoding.minus(requestedDecimalsEcoding)))
  } else {
    return value.times(exponentToBigInt(requestedDecimalsEcoding.minus(currentDecimalsEncoding)))
  }
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
