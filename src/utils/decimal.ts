import { BigInt } from "@graphprotocol/graph-ts"

export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let TEN_BI = BigInt.fromI32(10)


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
function exponentToBigInt(decimals: BigInt): BigInt {
  let bd = ONE_BI
  let n = decimals.toI32()
  for (let i = 0; i < n; i++) {
    bd = bd.times(TEN_BI)
  }
  return bd
}
