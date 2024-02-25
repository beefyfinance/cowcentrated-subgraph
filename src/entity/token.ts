import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import { Token } from '../../generated/schema'

export function getToken(tokenAddress: string): Token {
  let token = Token.load(tokenAddress)
  if (!token) {
    token = new Token(tokenAddress)
    token.symbol = ''
    token.name = ''
    token.decimals = BigInt.fromI32(18)
  }
  return token
}
