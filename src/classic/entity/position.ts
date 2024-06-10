import { Bytes, store } from "@graphprotocol/graph-ts"
import { Investor, ClassicPosition, CLM, Classic } from "../../../generated/schema"
import { ADDRESS_ZERO } from "../../common/utils/address"
import { ZERO_BI } from "../../common/utils/decimal"

// @ts-ignore
@inline
function getPositionId(classic: Classic, investor: Investor): Bytes {
  return classic.id.concat(investor.id)
}

export function getClassicPosition(classic: Classic, investor: Investor): ClassicPosition {
  let id = getPositionId(classic, investor)
  let position = ClassicPosition.load(id)
  if (!position) {
    position = new ClassicPosition(id)
    position.classic = classic.id
    position.investor = investor.id
    position.createdWith = ADDRESS_ZERO
    position.vaultBalance = ZERO_BI
    position.boostBalance = ZERO_BI
    position.totalBalance = ZERO_BI
  }
  return position
}

export function removeClassicPosition(classic: Classic, investor: Investor): void {
  const id = getPositionId(classic, investor)
  store.remove("ClassicPosition", id.toHexString())
}
