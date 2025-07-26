import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import { AlgebraPool } from "../../../generated/Clock/AlgebraPool"
import { ONE_BD, ZERO_BD, ZERO_BI, exponentToBigInt } from "../utils/decimal"
import { WNATIVE_DECIMALS } from "../../config"

// @see: https://gist.github.com/codeislight1/b487525088d1a90bbf90f9b159a1b3cc

export class AlgebraPathItem {
  pool: Address
  // @ts-expect-error: u8 is an assemblyscript dialect, not typescript
  token0Decimals: u8
  // @ts-expect-error: u8 is an assemblyscript dialect, not typescript
  token1Decimals: u8
  zeroToOne: boolean

  // @ts-expect-error: u8 is an assemblyscript dialect, not typescript
  constructor(pool: Address, token0Decimals: u8, token1Decimals: u8, zeroToOne: boolean) {
    this.pool = pool
    this.token0Decimals = token0Decimals
    this.token1Decimals = token1Decimals
    this.zeroToOne = zeroToOne
  }
}

export function getAlgebraTokenToNativePrice(poolsPath: Array<AlgebraPathItem>): BigInt {
  let finalPrice = ONE_BD

  for (let i = 0; i < poolsPath.length; i++) {
    const pathItem = poolsPath[i]
    const sqrtPriceX96 = getSqrtPrice(pathItem.pool)
    const routePrice = sqrtPriceX96ToTokenPrices(sqrtPriceX96, pathItem)
    finalPrice = finalPrice.times(routePrice)
  }

  // @ts-expect-error: u8 is an assemblyscript dialect, not typescript
  const outputDecimals = WNATIVE_DECIMALS.toU32() as u8
  return toBigInt(finalPrice, outputDecimals)
}

function getSqrtPrice(pool: Address): BigInt {
  const poolContract = AlgebraPool.bind(pool)
  const result = poolContract.try_globalState()

  if (result.reverted) {
    return ZERO_BI
  }

  return result.value.getPrice()
}

const Q192_BD = BigInt.fromI32(2).pow(192).toBigDecimal()

// @see: https://github.com/Uniswap/v3-subgraph/blob/main/src/common/pricing.ts#L11
function sqrtPriceX96ToTokenPrices(sqrtPriceX96: BigInt, pathItem: AlgebraPathItem): BigDecimal {
  let num = sqrtPriceX96.times(sqrtPriceX96).toBigDecimal()
  let denom = BigDecimal.fromString(Q192_BD.toString())
  let price1 = safeDiv(
    safeDiv(num, denom).times(exponentToBigInt(BigInt.fromI32(pathItem.token0Decimals)).toBigDecimal()),
    exponentToBigInt(BigInt.fromI32(pathItem.token1Decimals)).toBigDecimal(),
  )

  if (pathItem.zeroToOne) {
    return price1
  } else {
    return safeDiv(BigDecimal.fromString("1"), price1)
  }
}

// return 0 if denominator is 0 in division
function safeDiv(amount0: BigDecimal, amount1: BigDecimal): BigDecimal {
  if (amount1.equals(ZERO_BD)) {
    return ZERO_BD
  } else {
    return amount0.div(amount1)
  }
}

// @see: https://github.com/protofire/subgraph-toolkit/blob/main/lib/utils.ts#L58C1-L62C4
// @ts-expect-error: u8 is an assemblyscript dialect, not typescript
function toBigInt(value: BigDecimal, decimals: u8): BigInt {
  return value.times(getPrecision(decimals).toBigDecimal()).truncate(0).digits
}

// @ts-expect-error: u8 is an assemblyscript dialect, not typescript
function getPrecision(decimals: u8): BigInt {
  return BigInt.fromI32(10).pow(decimals)
}
