import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { Token } from "../../generated/schema"
import { ADDRESS_ZERO } from "../utils/address"


@inline
export function isNullToken(token: Token): boolean {
  return token.id.equals(ADDRESS_ZERO)
}

export function getNullToken(): Token {
  let token = Token.load(ADDRESS_ZERO)
  if (!token) {
    token = new Token(ADDRESS_ZERO)
    token.symbol = "NULL"
    token.name = "NULL"
    token.decimals = BigInt.fromI32(18)
    token.save()
  }
  return token
}


@inline
export function getToken(tokenAddress: Bytes): Token {
  if (tokenAddress == ADDRESS_ZERO) {
    return getNullToken()
  }
  let token = Token.load(tokenAddress)
  if (!token) {
    token = new Token(tokenAddress)
    token.symbol = ""
    token.name = ""
    token.decimals = BigInt.fromI32(18)
  }
  return token
}
