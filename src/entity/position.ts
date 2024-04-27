import { Bytes, store } from "@graphprotocol/graph-ts"
import { BeefyCLVault, Investor, InvestorPosition } from "../../generated/schema"
import { ADDRESS_ZERO } from "../utils/address"
import { ZERO_BI } from "../utils/decimal"

// @ts-ignore
@inline
function getPositionId(vault: BeefyCLVault, investor: Investor): Bytes {
  return vault.id.concat(investor.id)
}

export function getInvestorPosition(vault: BeefyCLVault, investor: Investor): InvestorPosition {
  let id = getPositionId(vault, investor)
  let position = InvestorPosition.load(id)
  if (!position) {
    position = new InvestorPosition(id)
    position.vault = vault.id
    position.investor = investor.id
    position.createdWith = ADDRESS_ZERO
    position.sharesBalance = ZERO_BI
  }
  return position
}

export function removeInvestorPosition(vault: BeefyCLVault, investor: Investor): void {
  const id = getPositionId(vault, investor)
  store.remove("InvestorPosition", id.toHexString())
}
