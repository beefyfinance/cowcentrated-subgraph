import { Classic } from "../../../generated/schema"
import { TokenBalance } from "./common"
import { ClassicVault as ClassicVaultContract } from "../../../generated/templates/ClassicVault/ClassicVault"
import { BalancerPool as BalancerPoolContract } from "../../../generated/templates/ClassicVault/BalancerPool"
import { BalancerVault as BalancerVaultContract } from "../../../generated/templates/ClassicVault/BalancerVault"
import { Address } from "@graphprotocol/graph-ts"

export function isBalancerVault(classic: Classic): boolean {
  const breakdown = getVaultTokenBreakdownBalancer(classic)
  return breakdown.length > 0
}

export function getVaultTokenBreakdownBalancer(classic: Classic): Array<TokenBalance> {
  let balances = new Array<TokenBalance>()

  const vaultContract = ClassicVaultContract.bind(Address.fromBytes(classic.vaultSharesToken))
  const wantTotalBalanceResult = vaultContract.try_balance()
  if (wantTotalBalanceResult.reverted) {
    return []
  }
  const wantTotalBalance = wantTotalBalanceResult.value

  // fetch on chain data
  const balancerPoolContract = BalancerPoolContract.bind(Address.fromBytes(classic.underlyingToken))
  const balancerVaultAddressResult = balancerPoolContract.try_getVault()
  if (balancerVaultAddressResult.reverted) {
    return []
  }
  const balancerVaultAddress = balancerVaultAddressResult.value
  const balancerPoolIdResult = balancerPoolContract.try_getPoolId()
  if (balancerPoolIdResult.reverted) {
    return []
  }
  const balancerPoolId = balancerPoolIdResult.value
  const balancerTotalSupplyResult = balancerPoolContract.try_getActualSupply()
  if (balancerTotalSupplyResult.reverted) {
    return []
  }
  const balancerTotalSupply = balancerTotalSupplyResult.value
  const balancerVaultContract = BalancerVaultContract.bind(balancerVaultAddress)
  const poolTokensRes = balancerVaultContract.try_getPoolTokens(balancerPoolId)
  if (poolTokensRes.reverted) {
    return []
  }
  const poolTokens = poolTokensRes.value.getTokens()
  const poolBalances = poolTokensRes.value.getBalances()

  // compute breakdown
  for (let i = 0; i < poolTokens.length; i++) {
    const poolToken = poolTokens[i]
    const poolBalance = poolBalances[i]
    balances.push(new TokenBalance(poolToken, poolBalance.times(wantTotalBalance).div(balancerTotalSupply)))
  }

  return balances
}
