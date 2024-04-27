import { Bytes, ethereum } from "@graphprotocol/graph-ts"


@inline
export function getEventIdentifier(event: ethereum.Event): Bytes {
  return event.transaction.hash.concat(Bytes.fromByteArray(Bytes.fromBigInt(event.logIndex)))
}
