import { Bytes } from "@graphprotocol/graph-ts"
import { Investor } from "../../../generated/schema"

export function getInvestor(accountAddress: Bytes): Investor {
  let investor = Investor.load(accountAddress)
  if (!investor) {
    investor = new Investor(accountAddress)
  }

  return investor
}
