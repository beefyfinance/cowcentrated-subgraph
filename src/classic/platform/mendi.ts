import { Classic } from "../../../generated/schema"
import { TokenBalance } from "./common"
import { ClassicVault as ClassicVaultContract } from "../../../generated/templates/ClassicVault/ClassicVault"
import { Address } from "@graphprotocol/graph-ts"
import { allResultsSuccess, Multicall3Params } from "../../common/utils/multicall"
import { multicall } from "../../common/utils/multicall"

export function isMendiLendingVault(classic: Classic): boolean {
  const signatures = [new Multicall3Params(classic.strategy, "iToken()", "address")]
  const results = multicall(signatures)
  return allResultsSuccess(results)
}

export function isMendiLeverageVault(classic: Classic): boolean {
  const signatures = [new Multicall3Params(classic.strategy, "iToken()", "address")]
  const results = multicall(signatures)
  return allResultsSuccess(results)
}

export function getVaultTokenBreakdownMendiLending(classic: Classic): Array<TokenBalance> {
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

export function getVaultTokenBreakdownMendiLeverage(classic: Classic): Array<TokenBalance> {
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
