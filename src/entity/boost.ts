import { Bytes } from "@graphprotocol/graph-ts"
import { BeefyBoost } from "../../generated/schema"
import { ADDRESS_ZERO } from "../utils/address"
import { ZERO_BD } from "../utils/decimal"

export function isBoostAddress(address: Bytes): boolean {
  return BeefyBoost.load(address) !== null
}

export function getBoost(boostAddress: Bytes): BeefyBoost {
  let boost = BeefyBoost.load(boostAddress)
  if (!boost) {
    boost = new BeefyBoost(boostAddress)
    boost.createdWith = ADDRESS_ZERO
    boost.vault = ADDRESS_ZERO
    boost.owner = ADDRESS_ZERO
    boost.rewardedIn = ADDRESS_ZERO
    boost.incentiveAmount = ZERO_BD
    boost.cumulativeClaimedAmount = ZERO_BD
    boost.cumulativeClaimedAmountUSD = ZERO_BD
  }

  return boost
}
