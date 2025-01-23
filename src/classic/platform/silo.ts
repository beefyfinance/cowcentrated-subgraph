import { Classic } from "../../../generated/schema"
import { TokenBalance } from "./common"
import { ClassicVault as ClassicVaultContract } from "../../../generated/templates/ClassicVault/ClassicVault"
import { Address } from "@graphprotocol/graph-ts"
import { allResultsSuccess } from "../../common/utils/multicall"
import { multicall, Multicall3Params } from "../../common/utils/multicall"

export function isSiloVault(classic: Classic): boolean {
  const signatures = [new Multicall3Params(classic.strategy, "silo()", "address")]
  const results = multicall(signatures)
  return allResultsSuccess(results)
}

export function getVaultTokenBreakdownSilo(classic: Classic): Array<TokenBalance> {
  let balances = new Array<TokenBalance>()

  const signatures = [
    new Multicall3Params(classic.strategy, "want()", "address"),
    new Multicall3Params(classic.strategy, "balanceOfPool()", "uint256"),
  ]

  const results = multicall(signatures)
  if (!allResultsSuccess(results)) {
    return []
  }

  const wantAddress = results[0].value.toAddress()
  const wantBalance = results[1].value.toBigInt()

  balances.push(new TokenBalance(wantAddress, wantBalance))

  return balances
}
