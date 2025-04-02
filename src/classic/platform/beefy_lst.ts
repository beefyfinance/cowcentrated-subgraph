import { Classic } from "../../../generated/schema"
import { TokenBalance } from "./common"
import { Multicall3Params, allResultsSuccess, multicall } from "../../common/utils/multicall"

export function getVaultTokenBreakdownBeefyLstVault(classic: Classic): Array<TokenBalance> {
  let balances = new Array<TokenBalance>()

  const signatures = [
    new Multicall3Params(classic.id, "want()", "address"),
    new Multicall3Params(classic.id, "totalAssets()", "uint256"),
  ]

  const results = multicall(signatures)
  if (!allResultsSuccess(results)) {
    return []
  }

  const want = results[0].value.toAddress()
  const totalAssets = results[1].value.toBigInt()

  balances.push(new TokenBalance(want, totalAssets))

  return balances
}
