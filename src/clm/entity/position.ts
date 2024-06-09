import { Bytes, store } from "@graphprotocol/graph-ts"
import { Investor, CLMPosition, CLM } from "../../../generated/schema"
import { ADDRESS_ZERO } from "../../common/utils/address"
import { ZERO_BI } from "../../common/utils/decimal"

// @ts-ignore
@inline
function getPositionId(clm: CLM, investor: Investor): Bytes {
  return clm.id.concat(investor.id)
}

export function getCLMPosition(clm: CLM, investor: Investor): CLMPosition {
  let id = getPositionId(clm, investor)
  let position = CLMPosition.load(id)
  if (!position) {
    position = new CLMPosition(id)
    position.clm = clm.id
    position.investor = investor.id
    position.createdWith = ADDRESS_ZERO
    position.managerBalance = ZERO_BI
    position.rewardPoolBalance = ZERO_BI
  }
  return position
}

export function removeCLMPosition(clm: CLM, investor: Investor): void {
  const id = getPositionId(clm, investor)
  store.remove("CLMPosition", id.toHexString())
}
