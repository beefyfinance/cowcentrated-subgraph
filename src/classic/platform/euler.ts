import { Classic } from "../../../generated/schema"
import { TokenBalance } from "./common"
import { Multicall3Params, allResultsSuccess, multicall } from "../../common/utils/multicall"
import { ClassicErc4626Adapter as ERC4626Contract } from "../../../generated/templates/ClassicErc4626Adapter/ClassicErc4626Adapter"

export function isEulerVault(classic: Classic): boolean {
  const breakdown = getVaultTokenBreakdownEuler(classic)
  return breakdown.length > 0
}

export function getVaultTokenBreakdownEuler(classic: Classic): Array<TokenBalance> {
  let balances = new Array<TokenBalance>()

  const signatures = [
    new Multicall3Params(classic.strategy, "balanceOf()", "uint256"),
    new Multicall3Params(classic.strategy, "erc4626Vault()", "address"),
  ]

  const results = multicall(signatures)
  if (!allResultsSuccess(results)) {
    return []
  }

  const balanceOf = results[0].value.toBigInt()
  const erc4626Vault = results[1].value.toAddress()

  const erc4626VaultContract = ERC4626Contract.bind(erc4626Vault)
  const withdrawableBalanceResult = erc4626VaultContract.try_previewWithdraw(balanceOf)
  if (withdrawableBalanceResult.reverted) {
    return []
  }

  const withdrawableBalance = withdrawableBalanceResult.value

  balances.push(new TokenBalance(classic.underlyingToken, withdrawableBalance))

  return balances
}
