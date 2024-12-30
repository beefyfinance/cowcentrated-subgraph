import { Classic } from "../../../generated/schema"
import { TokenBalance } from "./common"
import { ClassicVault as ClassicVaultContract } from "../../../generated/templates/ClassicVault/ClassicVault"
import { Address } from "@graphprotocol/graph-ts"
import { allResultsSuccess } from "../../common/utils/multicall"
import { multicall, Multicall3Params } from "../../common/utils/multicall"

export function isAaveVault(classic: Classic): boolean {
  const signatures = [new Multicall3Params(classic.strategy, "aToken()", "address")]

  const results = multicall(signatures)
  return allResultsSuccess(results)
}

/**
 * @dev assumes no lend/borrow looping
 */
export function getVaultTokenBreakdownAave(classic: Classic): Array<TokenBalance> {
  let balances = new Array<TokenBalance>()

  const vaultContract = ClassicVaultContract.bind(Address.fromBytes(classic.vaultSharesToken))
  const wantTotalBalanceResult = vaultContract.try_balance()
  if (wantTotalBalanceResult.reverted) {
    return []
  }
  const wantTotalBalance = wantTotalBalanceResult.value

  balances.push(new TokenBalance(classic.underlyingToken, wantTotalBalance))

  return balances
}
