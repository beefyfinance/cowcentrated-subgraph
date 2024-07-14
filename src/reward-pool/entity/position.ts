import { Bytes, store } from "@graphprotocol/graph-ts"
import { Investor, RewardPool, RewardPoolPosition } from "../../../generated/schema"
import { ADDRESS_ZERO } from "../../common/utils/address"
import { ZERO_BI } from "../../common/utils/decimal"

// @ts-ignore
@inline
function getPositionId(rewardPool: RewardPool, investor: Investor): Bytes {
  return rewardPool.id.concat(investor.id)
}

export function getRewardPoolPosition(rewardPool: RewardPool, investor: Investor): RewardPoolPosition {
  let id = getPositionId(rewardPool, investor)
  let position = RewardPoolPosition.load(id)
  if (!position) {
    position = new RewardPoolPosition(id)
    position.rewardPool = rewardPool.id
    position.investor = investor.id
    position.createdWith = ADDRESS_ZERO
    position.rewardPoolBalance = ZERO_BI
    position.totalBalance = ZERO_BI
  }
  return position
}

export function removeRewardPoolPosition(rewardPool: RewardPool, investor: Investor): void {
  const id = getPositionId(rewardPool, investor)
  store.remove("RewardPoolPosition", id.toHexString())
}
