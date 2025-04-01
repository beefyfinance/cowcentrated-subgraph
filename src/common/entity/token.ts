import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { Token, TokenTransfer } from "../../../generated/schema"
import { ADDRESS_ZERO } from "../utils/address"

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

export function getTokenTransferId(tokenAddress: Bytes, transactionHash: Bytes, logIndex: BigInt): Bytes {
  return tokenAddress.concat(transactionHash).concat(Bytes.fromI32(logIndex.toI32()))
}

export function createAndSaveTokenTransfer(
  event: ethereum.Event,
  from: Bytes,
  to: Bytes,
  amount: BigInt,
): TokenTransfer | null {
  // create the token transfer
  const tokenTransfer = new TokenTransfer(getTokenTransferId(event.address, event.transaction.hash, event.logIndex))
  tokenTransfer.transactionHash = event.transaction.hash
  tokenTransfer.blockNumber = event.block.number
  tokenTransfer.blockTimestamp = event.block.timestamp
  tokenTransfer.logIndex = event.logIndex
  tokenTransfer.token = event.address
  tokenTransfer.from = from
  tokenTransfer.to = to
  tokenTransfer.amount = amount
  tokenTransfer.save()

  return tokenTransfer
}
