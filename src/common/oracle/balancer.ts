import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { Token } from "../../../generated/schema"
import { BalancerWeightedPool as BalancerWeightedPoolContract } from "../../../generated/Clock/BalancerWeightedPool"
import { BalancerVault as BalancerVaultContract } from "../../../generated/Clock/BalancerVault"
import { ONE_BI, ZERO_BI } from "../utils/decimal"
import { BEEFY_SWAPPER_VALUE_SCALER } from "../../config"
import { changeValueEncoding } from "../utils/decimal"

const ONE_18 = BigInt.fromI32(10).pow(18)
const TWO_18 = ONE_18.plus(ONE_18)
const FOUR_18 = TWO_18.plus(TWO_18)

export function getBalancerWeightedPoolTokenPrice(tokenIn: Token, tokenOutAddress: Bytes, poolId: Bytes): BigInt {
  const poolAddress = Address.fromBytes(Bytes.fromUint8Array(poolId.slice(0, 20)))

  const poolContract = BalancerWeightedPoolContract.bind(poolAddress)
  const vaultAddressResult = poolContract.try_getVault()
  if (vaultAddressResult.reverted) {
    return ZERO_BI
  }
  const vaultAddress = vaultAddressResult.value

  const tokenWeightsResult = poolContract.try_getNormalizedWeights()
  if (tokenWeightsResult.reverted) {
    return ZERO_BI
  }
  const tokenWeights = tokenWeightsResult.value

  const vaultContract = BalancerVaultContract.bind(vaultAddress)
  const poolInfoResult = vaultContract.try_getPoolTokens(poolId)
  if (poolInfoResult.reverted) {
    return ZERO_BI
  }
  const poolInfo = poolInfoResult.value
  const tokens = poolInfo.value0
  const balances = poolInfo.value1

  let tokenInIndex = -1
  let tokenOutIndex = -1
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].equals(tokenIn.id)) {
      tokenInIndex = i
    }
    if (tokens[i].equals(tokenOutAddress)) {
      tokenOutIndex = i
    }
  }
  if (tokenInIndex === -1 || tokenOutIndex === -1) {
    return ZERO_BI
  }

  if (balances.length <= tokenInIndex || balances.length <= tokenOutIndex) {
    return ZERO_BI
  }
  if (tokenWeights.length <= tokenInIndex || tokenWeights.length <= tokenOutIndex) {
    return ZERO_BI
  }

  const balanceOut = balances[tokenOutIndex]
  const balanceIn = balances[tokenInIndex]
  const amountIn = changeValueEncoding(ONE_BI, ZERO_BI, tokenIn.decimals).div(BEEFY_SWAPPER_VALUE_SCALER)
  const weightIn = tokenWeights[tokenInIndex]
  const weightOut = tokenWeights[tokenOutIndex]
  const amountOut = balancerWeightedPoolOutGivenIn(amountIn, balanceOut, balanceIn, weightIn, weightOut)
  return amountOut.times(BEEFY_SWAPPER_VALUE_SCALER)
}

export function balancerWeightedPoolOutGivenIn(
  amountIn: BigInt,
  balanceOut: BigInt,
  balanceIn: BigInt,
  weightIn: BigInt,
  weightOut: BigInt,
): BigInt {
  // https://docs.balancer.fi/concepts/explore-available-balancer-pools/weighted-pool/weighted-math.html
  // https://github.com/balancer/balancer-v2-monorepo/blob/36d282374b457dddea828be7884ee0d185db06ba/pkg/pool-weighted/contracts/WeightedMath.sol#L78
  /**********************************************************************************************
    // outGivenIn                                                                                //
    // aO = amountOut                                                                            //
    // bO = balanceOut                                                                           //
    // bI = balanceIn              /      /            bI             \    (wI / wO) \           //
    // aI = amountIn    aO = bO * |  1 - | --------------------------  | ^            |          //
    // wI = weightIn               \      \       ( bI + aI )         /              /           //
    // wO = weightOut                                                                            //
    **********************************************************************************************/

  // Solidity implementation:
  // complement: x -> (x < 1e18) ? (1e18 - x) : 0;
  //   uint256 denominator = balanceIn.add(amountIn);
  //   uint256 base = balanceIn.divUp(denominator);
  //   uint256 exponent = weightIn.divDown(weightOut);
  //   uint256 power = base.powUp(exponent);
  //   return balanceOut.mulDown(power.complement());

  const denominator = balanceIn.plus(amountIn)
  const base = divUp(balanceIn, denominator)
  const exponent = divDown(weightIn, weightOut)
  const power = powUp(base, exponent)
  const amountOut = mulDown(balanceOut, complement(power))

  return amountOut
}

function mulUp(a: BigInt, b: BigInt): BigInt {
  // uint256 product = a * b;
  // return ((product - 1) / ONE) + 1;
  const product = a.times(b)
  if (product.equals(ZERO_BI)) {
    return ZERO_BI
  }
  return product.minus(ONE_BI).div(ONE_18).plus(ONE_BI)
}

function mulDown(a: BigInt, b: BigInt): BigInt {
  // uint256 product = a * b;
  // return product / ONE;
  const product = a.times(b)
  if (product.equals(ZERO_BI)) {
    return ZERO_BI
  }
  return product.div(ONE_18)
}

function complement(x: BigInt): BigInt {
  // (x < ONE) ? (ONE - x) : 0;
  return x.lt(ONE_18) ? ONE_18.minus(x) : ZERO_BI
}

function divDown(a: BigInt, b: BigInt): BigInt {
  if (a.equals(ZERO_BI) || b.equals(ZERO_BI)) {
    return ZERO_BI
  }
  //uint256 aInflated = a * ONE;
  // return aInflated / b;
  const aInflated = a.times(ONE_18)
  return aInflated.div(b)
}

function divUp(a: BigInt, b: BigInt): BigInt {
  if (a.equals(ZERO_BI) || b.equals(ZERO_BI)) {
    return ZERO_BI
  }
  // uint256 aInflated = a * ONE;
  // return ((aInflated - 1) / b) + 1;
  const aInflated = a.times(ONE_18)
  return aInflated.minus(ONE_BI).div(b).plus(ONE_BI)
}

function powUp(x: BigInt, y: BigInt): BigInt {
  if (y == ONE_18) {
    return x
  } else if (y == TWO_18) {
    return mulUp(x, x)
  } else if (y == FOUR_18) {
    const square = mulUp(x, x)
    return mulUp(square, square)
  } else {
    const count = y.div(ONE_18).toI32()
    let raw = x
    for (let i = 0; i < count; i++) {
      raw = mulUp(raw, x)
    }
    return raw
  }
}
