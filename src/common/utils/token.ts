import { IERC20 as IERC20Contract } from "../../../generated/templates/ClmManager/IERC20"
import { Token } from "../../../generated/schema"
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { getToken } from "../entity/token"

export function fetchAndSaveTokenData(tokenAddress: Bytes): Token {
  const tokenContract = IERC20Contract.bind(Address.fromBytes(tokenAddress))
  const tokenDecimals = tokenContract.decimals()
  const tokenName = tokenContract.name()
  const tokenSymbol = tokenContract.symbol()

  const token = getToken(tokenAddress)
  token.name = tokenName
  token.symbol = tokenSymbol
  token.decimals = BigInt.fromI32(tokenDecimals)
  token.save()

  return token
}
