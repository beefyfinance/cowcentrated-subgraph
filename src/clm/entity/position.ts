import { Bytes, store } from "@graphprotocol/graph-ts"
import { Investor, ClmPosition, CLM } from "../../../generated/schema"
import { ADDRESS_ZERO } from "../../common/utils/address"
import { ZERO_BI } from "../../common/utils/decimal"

// @ts-ignore
@inline
function getPositionId(clm: CLM, investor: Investor): Bytes {
  return clm.id.concat(investor.id)
}

export function getClmPosition(clm: CLM, investor: Investor): ClmPosition {
  let id = getPositionId(clm, investor)
  let position = ClmPosition.load(id)
  if (!position) {
    position = new ClmPosition(id)
    position.clm = clm.id
    position.investor = investor.id
    position.createdWith = ADDRESS_ZERO
    position.managerBalance = ZERO_BI
    position.rewardPoolBalance = ZERO_BI
  }
  return position
}

export function removeClmPosition(clm: CLM, investor: Investor): void {
  const id = getPositionId(clm, investor)
  store.remove("ClmPosition", id.toHexString())
}
