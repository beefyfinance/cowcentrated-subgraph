import { Classic } from "../../../generated/schema"
import { TokenBalance } from "./common"
import { Multicall3Params, allResultsSuccess, multicall } from "../../common/utils/multicall"

export function isIchiVault(classic: Classic): boolean {
  const breakdown = getVaultTokenBreakdownIchiLynex(classic)
  return breakdown.length > 0
}

export function getVaultTokenBreakdownIchiLynex(classic: Classic): Array<TokenBalance> {
  let balances = new Array<TokenBalance>()

  const ichiAlmAddress = classic.underlyingToken
  const signatures = [
    new Multicall3Params(classic.id, "balance()", "uint256"),
    new Multicall3Params(ichiAlmAddress, "totalSupply()", "uint256"),
    new Multicall3Params(ichiAlmAddress, "getBasePosition()", "(uint256,uint256,uint256)"),
    new Multicall3Params(ichiAlmAddress, "getLimitPosition()", "(uint256,uint256,uint256)"),
    new Multicall3Params(ichiAlmAddress, "token0()", "address"),
    new Multicall3Params(ichiAlmAddress, "token1()", "address"),
  ]

  const results = multicall(signatures)
  if (!allResultsSuccess(results)) {
    return []
  }

  const wantTotalBalance = results[0].value.toBigInt()
  const totalSupply = results[1].value.toBigInt()
  const basePosition = results[2].value.toTuple()
  const limitPosition = results[3].value.toTuple()
  const token0 = results[4].value.toAddress()
  const token1 = results[5].value.toAddress()

  const basePositionAmount0 = basePosition[1].toBigInt()
  const basePositionAmount1 = basePosition[2].toBigInt()
  const limitPositionAmount0 = limitPosition[1].toBigInt()
  const limitPositionAmount1 = limitPosition[2].toBigInt()

  const wantBalance0 = basePositionAmount0.plus(limitPositionAmount0)
  const wantBalance1 = basePositionAmount1.plus(limitPositionAmount1)
  balances.push(new TokenBalance(token0, wantTotalBalance.times(wantBalance0).div(totalSupply)))
  balances.push(new TokenBalance(token1, wantTotalBalance.times(wantBalance1).div(totalSupply)))

  return balances
}
