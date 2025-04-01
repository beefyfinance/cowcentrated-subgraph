import { BigInt, Bytes } from "@graphprotocol/graph-ts"

export class TokenBalance {
  constructor(
    public tokenAddress: Bytes,
    public rawBalance: BigInt,
  ) {}

  public toString(): string {
    return (
      "TokenBalance[tokenAddress: " +
      this.tokenAddress.toHexString() +
      ", rawBalance:" +
      this.rawBalance.toString() +
      "]"
    )
  }
}
