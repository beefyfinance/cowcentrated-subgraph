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
    new Multicall3Params(classic.strategy, "getReserves()", "(uint112,uint112,uint32)"),
    new Multicall3Params(classic.strategy, "token0()", "address"),
    new Multicall3Params(classic.strategy, "token1()", "address"),
  ]

  const results = multicall(signatures)
  if (!allResultsSuccess(results)) {
    return []
  }

  const reserves = results[0].value.toTuple()
  const reserve0 = reserves[0].toBigInt()
  const reserve1 = reserves[1].toBigInt()
  const token0 = results[1].value.toAddress()
  const token1 = results[2].value.toAddress()

  const wantBalance0 = reserve0.div(reserve1)
  const wantBalance1 = reserve1.div(reserve0)

  balances.push(new TokenBalance(token0, wantBalance0))
  balances.push(new TokenBalance(token1, wantBalance1))

  return balances
}
