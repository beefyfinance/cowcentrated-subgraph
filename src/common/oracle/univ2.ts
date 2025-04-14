import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import { Univ2QuoterV2 } from "../../../generated/Clock/Univ2QuoterV2"
import { changeValueEncoding } from "../utils/decimal"
import { ONE_BI } from "../utils/decimal"
import { Token } from "../../../generated/schema"
import { ZERO_BI } from "../utils/decimal"
import { BEEFY_SWAPPER_VALUE_SCALER, WNATIVE_TOKEN_ADDRESS } from "../../config"

/**
 * Get the price of a token in native currency using the Univ2QuoterV2 contract
 * Applicable to univ2, algebrav3, swapx, etc.
 *
 * @param inputToken - The token to get the price of
 * @param quoterV2Address - The address of the Univ2QuoterV2 contract
 * @param tokenPath - [tokenA, tokenB, tokenC, ...]
 * @returns Output amount of token
 */
export function getUniv2TokenToNativePrice(inputToken: Token, quoterV2Address: Bytes, tokenPath: Array<Bytes>): BigInt {
  const quoter = Univ2QuoterV2.bind(Address.fromBytes(quoterV2Address))

  if (inputToken.id.equals(WNATIVE_TOKEN_ADDRESS)) {
    return ONE_BI
  }

  if (inputToken.id.notEqual(tokenPath[0])) {
    throw new Error("Input token is not the first token in the path")
  }

  if (WNATIVE_TOKEN_ADDRESS.notEqual(tokenPath[tokenPath.length - 1])) {
    throw new Error("Last token in the path is not the native token")
  }

  if (tokenPath.length < 2) {
    throw new Error("Path must contain at least two tokens")
  }

  const amountIn = changeValueEncoding(ONE_BI, ZERO_BI, inputToken.decimals).div(BEEFY_SWAPPER_VALUE_SCALER)
  const path = buildUniv2Path(tokenPath)

  const result = quoter.try_quoteExactInput(path, amountIn)
  if (!result.reverted) {
    const amountOut = result.value.getAmountOut()
    return amountOut.times(BEEFY_SWAPPER_VALUE_SCALER)
  }

  log.error("Failed to get price for token {} using path {}", [inputToken.id.toHex(), path.toHex()])

  return ZERO_BI
}

export function buildUniv2Path(tokenPath: Array<Bytes>): Bytes {
  const pathBytes = new Uint8Array(tokenPath.length * 20)
  for (let i = 0; i < tokenPath.length; i++) {
    const tokenAddress = tokenPath[i]
    for (let j = 0; j < 20; j++) {
      pathBytes[i * 20 + j] = tokenAddress[j]
    }
  }
  const path = Bytes.fromUint8Array(pathBytes)

  return path
}
