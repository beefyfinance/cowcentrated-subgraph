import { Classic } from "../../../generated/schema"
import { TokenBalance } from "./common"
import { Multicall3Params, allResultsSuccess, multicall } from "../../common/utils/multicall"

export function isDefiveVault(classic: Classic): boolean {
  const breakdown = getVaultTokenBreakdownDefive(classic)
  return breakdown.length > 0
}

export function getVaultTokenBreakdownDefive(classic: Classic): Array<TokenBalance> {
  let balances = new Array<TokenBalance>()

  const signatures = [
    new Multicall3Params(classic.underlyingToken, "getReserves()", "(uint112,uint112,uint32)"),
    new Multicall3Params(classic.underlyingToken, "totalSupply()", "uint256"),
    new Multicall3Params(classic.strategy, "balanceOf()", "uint256"),
    new Multicall3Params(classic.strategy, "lpToken0()", "address"),
    new Multicall3Params(classic.strategy, "lpToken1()", "address"),
  ]

  const results = multicall(signatures)
  if (!allResultsSuccess(results)) {
    return []
  }

  const reserves = results[0].value.toTuple()
  const lpTotalSupply = results[1].value.toBigInt()
  const vaultBalanceOfLp = results[2].value.toBigInt()
  const token0 = results[3].value.toAddress()
  const token1 = results[4].value.toAddress()

  const reserve0 = reserves[0].toBigInt()
  const reserve1 = reserves[1].toBigInt()

  const balance0 = reserve0.times(vaultBalanceOfLp).div(lpTotalSupply)
  const balance1 = reserve1.times(vaultBalanceOfLp).div(lpTotalSupply)

  balances.push(new TokenBalance(token0, balance0))
  balances.push(new TokenBalance(token1, balance1))

  return balances
}
