import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import { changeValueEncoding } from "../utils/decimal"
import { ONE_BI } from "../utils/decimal"
import { Token } from "../../../generated/schema"
import { ZERO_BI } from "../utils/decimal"
import { BEEFY_SWAPPER_VALUE_SCALER, WNATIVE_TOKEN_ADDRESS } from "../../config"
import { SolidlyRouter02 } from "../../../generated/Clock/SolidlyRouter02"

/**
 * Get the price of a token in native currency using solidly router
 * Applicable to equalizer, solidly, etc.
 *
 * @param inputToken - The token to get the price of
 * @param router02Address - The address of the SolidlyRouter02 contract
 * @returns Output amount of token
 */
export function getSolidlyTokenToNativePrice(inputToken: Token, router02Address: Bytes): BigInt {
  const router = SolidlyRouter02.bind(Address.fromBytes(router02Address))

  if (inputToken.id.equals(WNATIVE_TOKEN_ADDRESS)) {
    return ONE_BI
  }

  const amountIn = changeValueEncoding(ONE_BI, ZERO_BI, inputToken.decimals).div(BEEFY_SWAPPER_VALUE_SCALER)
  const result = router.try_getAmountOut(amountIn, Address.fromBytes(inputToken.id), WNATIVE_TOKEN_ADDRESS)
  if (!result.reverted) {
    const amountOut = result.value.value0
    return amountOut.times(BEEFY_SWAPPER_VALUE_SCALER)
  }

  log.error("Failed to get price for token {}", [inputToken.id.toHex()])

  return ZERO_BI
}
