import { Classic } from "../../../generated/schema"
import { TokenBalance } from "./common"
import { Multicall3Params, allResultsSuccess, multicall } from "../../common/utils/multicall"
import { ZERO_BI } from "../../common/utils/decimal"

export function isBeefyCLM(classic: Classic): boolean {
  return getVaultTokenBreakdownBeefyCLM(classic).length > 0
}

export function isBeefyCLMVault(classic: Classic): boolean {
  const breakdown = getVaultTokenBreakdownBeefyCLMVault(classic)
  return breakdown.length > 0
}

export function getVaultTokenBreakdownBeefyCLM(classic: Classic): Array<TokenBalance> {
  let balances = new Array<TokenBalance>()

  const signatures = [
    new Multicall3Params(classic.id, "wants()", "(address,address)"),
    new Multicall3Params(classic.id, "balances()", "(uint256,uint256)"),
  ]

  const results = multicall(signatures)
  if (!allResultsSuccess(results)) {
    return []
  }

  const wants = results[0].value.toTuple()
  const wantBalances = results[1].value.toTuple()

  for (let i = 0; i < wants.length; i++) {
    const want = wants[i].toAddress()
    const balance = wantBalances[i].toBigInt()
    balances.push(new TokenBalance(want, balance))
  }

  return balances
}

export function getVaultTokenBreakdownBeefyCLMVault(classic: Classic): Array<TokenBalance> {
  let balances = new Array<TokenBalance>()

  const clmAddress = classic.underlyingToken
  const signatures = [
    new Multicall3Params(classic.id, "balance()", "uint256"),
    new Multicall3Params(classic.id, "totalSupply()", "uint256"),
    new Multicall3Params(clmAddress, "wants()", "(address,address)"),
    new Multicall3Params(clmAddress, "balances()", "(uint256,uint256)"),
  ]

  const results = multicall(signatures)
  if (!allResultsSuccess(results)) {
    return []
  }

  const vaultBalance = results[0].value.toBigInt()
  const vaultTotalSupply = results[1].value.toBigInt()
  const clmTokens = results[2].value.toTuple()
  const clmBalances = results[3].value.toTuple()

  for (let i = 0; i < clmTokens.length; i++) {
    const token = clmTokens[i].toAddress()
    const totalClmBalance = clmBalances[i].toBigInt()

    let balance = ZERO_BI
    if (vaultTotalSupply.gt(ZERO_BI)) {
      balance = totalClmBalance.times(vaultBalance).div(vaultTotalSupply)
    }

    balances.push(new TokenBalance(token, balance))
  }

  return balances
}
