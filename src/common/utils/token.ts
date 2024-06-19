import { IERC20 as IERC20Contract } from "../../../generated/templates/ClmManager/IERC20"
import { Token } from "../../../generated/schema"
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { getToken } from "../entity/token"

export function fetchAndSaveTokenData(tokenAddress: Bytes): Token {
  const tokenContract = IERC20Contract.bind(Address.fromBytes(tokenAddress))
  // use individual calls as there is a good change other subgraph has requested
  // this token's metadata and it's already in the graph-node cache

  // if any of these calls revert, we will just use the default values to avoid a subgraph crash
  const tokenDecimalsRes = tokenContract.try_decimals()
  const tokenDecimals = tokenDecimalsRes.reverted ? 18 : tokenDecimalsRes.value

  const tokenNameRes = tokenContract.try_name()
  const tokenName = tokenNameRes.reverted ? "Unknown" : tokenNameRes.value

  const tokenSymbolRes = tokenContract.try_symbol()
  const tokenSymbol = tokenSymbolRes.reverted ? "UNKNOWN" : tokenSymbolRes.value

  const token = getToken(tokenAddress)
  token.name = tokenName
  token.symbol = tokenSymbol
  token.decimals = BigInt.fromI32(tokenDecimals)
  token.save()

  return token
}
