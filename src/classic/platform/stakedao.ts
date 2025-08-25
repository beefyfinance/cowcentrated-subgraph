import { Classic } from "../../../generated/schema"
import { TokenBalance } from "./common"
import { Multicall3Params, allResultsSuccess, multicall } from "../../common/utils/multicall"
import { ADDRESS_ZERO } from "../../common/utils/address"
import { ethereum } from "@graphprotocol/graph-ts"
import { ONE_BI, ZERO_BI } from "../../common/utils/decimal"

export function isStakedaoV2Vault(classic: Classic): boolean {
  const signatures = [new Multicall3Params(classic.strategy, "sdVault()", "address")]
  const results = multicall(signatures)
  if (!allResultsSuccess(results)) {
    return false
  }
  const sdVault = results[0].value.toAddress()
  return sdVault.notEqual(ADDRESS_ZERO)
}

export function getVaultTokenBreakdownStakedaoV2(classic: Classic): Array<TokenBalance> {
  let balances = new Array<TokenBalance>()

  // balance i: beefyVault.balance() * want.balances(i) / want.totalSupply()
  let results = multicall([
    new Multicall3Params(classic.id, "balance()", "uint256"),
    new Multicall3Params(classic.underlyingToken, "totalSupply()", "uint256"),
    new Multicall3Params(classic.underlyingToken, "N_COINS()", "uint256"),
  ])
  if (!allResultsSuccess(results)) return []
  const vaultBalance = results[0].value.toBigInt()
  const wantTotalSupply = results[1].value.toBigInt()
  const nCoins = results[2].value.toBigInt()

  for (let i = ZERO_BI; i.lt(nCoins); i = i.plus(ONE_BI)) {
    results = multicall([
      new Multicall3Params(classic.underlyingToken, "coins(uint256)", "address", [
        ethereum.Value.fromUnsignedBigInt(i),
      ]),
      new Multicall3Params(classic.underlyingToken, "balances(uint256)", "uint256", [
        ethereum.Value.fromUnsignedBigInt(i),
      ]),
    ])
    if (!allResultsSuccess(results)) return []
    const coin = results[0].value.toAddress()
    const wantBalance = results[1].value.toBigInt()
    balances.push(new TokenBalance(coin, vaultBalance.times(wantBalance).div(wantTotalSupply)))
  }

  return balances
}
