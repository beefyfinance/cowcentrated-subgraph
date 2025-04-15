import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import { Univ2QuoterV2 } from "../../../generated/Clock/Univ2QuoterV2"
import { changeValueEncoding } from "../utils/decimal"
import { ONE_BI } from "../utils/decimal"
import { Token } from "../../../generated/schema"
import { ZERO_BI } from "../utils/decimal"
import { BEEFY_SWAPPER_VALUE_SCALER, WNATIVE_TOKEN_ADDRESS } from "../../config"
import { getUniv2TokenToNativePrice, buildUniv2Path } from "./univ2"

/**
 * Get the price of a token in native currency using the SwapxCLQuoterV2 contract
 * Applicable to swapx CL routes
 *
 * SwapX CL can only get
 *
 * @param inputToken - The token to get the price of
 * @param quoterV2Address - The address of the SwapxCLQuoterV2 contract
 * @param tokenPath - [tokenA, tokenB, tokenC, ...]
 * @returns Output amount of token
 */
export function getSwapxTokenToNativePrice(inputToken: Token, quoterV2Address: Bytes, tokenPath: Array<Bytes>): BigInt {
  if (inputToken.id.equals(WNATIVE_TOKEN_ADDRESS)) {
    return ONE_BI
  }

  if (tokenPath.length < 2) {
    throw new Error("Path must contain at least two tokens")
  }

  // first, try to get the full path price like univ2
  const amountOut = getUniv2TokenToNativePrice(inputToken, quoterV2Address, tokenPath)
  if (amountOut.gt(ZERO_BI)) {
    return amountOut
  }

  // if not and we have a single hop path, nothing we can do
  if (tokenPath.length == 2) {
    return ZERO_BI
  }

  return getSwapxCLMultiHopTokenToNativePrice(inputToken, quoterV2Address, tokenPath)
}

export function getSwapxCLMultiHopTokenToNativePrice(
  inputToken: Token,
  quoterV2Address: Bytes,
  tokenPath: Array<Bytes>,
): BigInt {
  const quoter = Univ2QuoterV2.bind(Address.fromBytes(quoterV2Address))

  if (inputToken.id.equals(WNATIVE_TOKEN_ADDRESS)) {
    return ONE_BI
  }

  if (tokenPath.length < 3) {
    throw new Error("Path must contain at least three tokens")
  }

  // if not and we have a multi-hop path, try to get the price by breaking down the path
  let currentAmount = changeValueEncoding(ONE_BI, ZERO_BI, inputToken.decimals).div(BEEFY_SWAPPER_VALUE_SCALER)
  for (let i = 0; i < tokenPath.length - 2; i++) {
    const path = buildUniv2Path(tokenPath.slice(i, i + 2))

    const result = quoter.try_quoteExactInput(path, currentAmount)
    if (result.reverted) {
      log.error("Failed to get price for token {} using path {}", [inputToken.id.toHex(), path.toHex()])
      return ZERO_BI
    }

    currentAmount = result.value.getAmountOut()
  }

  return currentAmount.times(BEEFY_SWAPPER_VALUE_SCALER)
}
