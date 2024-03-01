import { BigInt, Bytes } from "@graphprotocol/graph-ts";


@inline
export function getSnapshotIdSuffix(period: BigInt, interval: BigInt):Bytes  {
  return Bytes.fromByteArray(Bytes.fromBigInt(period)).concat(Bytes.fromByteArray(Bytes.fromBigInt(interval)))
}