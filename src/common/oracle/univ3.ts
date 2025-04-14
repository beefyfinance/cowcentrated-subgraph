import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import { Univ3QuoterV2 } from "../../../generated/Clock/Univ3QuoterV2"
import { changeValueEncoding } from "../utils/decimal"
import { ONE_BI } from "../utils/decimal"
import { Token } from "../../../generated/schema"
import { ZERO_BI } from "../utils/decimal"
import { BEEFY_SWAPPER_VALUE_SCALER, WNATIVE_TOKEN_ADDRESS } from "../../config"

/**
 * Get the price of a token in native currency using the Univ3QuoterV2 contract
 * Applicable to univ3, shadow, algebrav4, aerodrome, etc.
 *
 * @param inputToken - The token to get the price of
 * @param quoterV2Address - The address of the Univ3QuoterV2 contract
 * @param tokenAndFeePath - [tokenA, feeAB, tokenB, feeBC, tokenC, ...]
 * @returns Output amount of token
 */
export function getUniv3TokenToNativePrice(
  inputToken: Token,
  quoterV2Address: Bytes,
  tokenAndFeePath: Array<Bytes>,
): BigInt {
  const quoter = Univ3QuoterV2.bind(Address.fromBytes(quoterV2Address))

  if (inputToken.id.equals(WNATIVE_TOKEN_ADDRESS)) {
    return ONE_BI
  }

  if (inputToken.id.notEqual(tokenAndFeePath[0])) {
    throw new Error("Input token is not the first token in the path")
  }

  if (WNATIVE_TOKEN_ADDRESS.notEqual(tokenAndFeePath[tokenAndFeePath.length - 1])) {
    throw new Error("Last token in the path is not the native token")
  }

  if (tokenAndFeePath.length < 3) {
    throw new Error("Path must contain at least 2 tokens and 1 fee")
  }

  const amountIn = changeValueEncoding(ONE_BI, ZERO_BI, inputToken.decimals).div(BEEFY_SWAPPER_VALUE_SCALER)

  let bytesLength = (tokenAndFeePath.length / 2) * 20 + (tokenAndFeePath.length / 2 - 1) * 2
  const pathBytes = new Uint8Array(bytesLength)
  for (let i = 0; i < tokenAndFeePath.length; i++) {
    // consume one token address
    const tokenAddress = tokenAndFeePath[i]
    for (let j = 0; j < 20; j++) {
      pathBytes[i * 20 + j] = tokenAddress[j]
    }

    // consume one fee
    if (i !== tokenAndFeePath.length - 1) {
      const fee = tokenAndFeePath[i + 1]
      for (let j = 0; j < 2; j++) {
        pathBytes[i * 20 + j] = fee[j]
      }
    }
  }
  const path = Bytes.fromUint8Array(pathBytes)

  const result = quoter.try_quoteExactInput(path, amountIn)
  if (!result.reverted) {
    const amountOut = result.value.getAmountOut()
    return amountOut.times(BEEFY_SWAPPER_VALUE_SCALER)
  }

  log.error("Failed to get price for token {} using path {}", [inputToken.id.toHex(), path.toHex()])

  return ZERO_BI
}
