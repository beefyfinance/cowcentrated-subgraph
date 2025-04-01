import { Classic } from "../../../generated/schema"
import { TokenBalance } from "./common"
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { ClassicVault as ClassicVaultContract } from "../../../generated/templates/ClassicVault/ClassicVault"
import { CurveToken as CurveTokenContract } from "../../../generated/templates/ClassicVault/CurveToken"
import { CurvePool as CurvePoolContract } from "../../../generated/templates/ClassicVault/CurvePool"

export function isCurveVault(classic: Classic): boolean {
  const breakdown = getVaultTokenBreakdownCurve(classic)
  return breakdown.length > 0
}

/**
 * @dev This breaks when the lp token and lp pool are different
 * @dev Does not break down meta pools
 * TODO try to find an on-chain way to get the lp pool (as vault only provides the lp token)
 * TODO try to break down meta pools (where one token of the pool is another pool)
 */
export function getVaultTokenBreakdownCurve(classic: Classic): Array<TokenBalance> {
  let balances = new Array<TokenBalance>()

  const vaultContract = ClassicVaultContract.bind(Address.fromBytes(classic.vaultSharesToken))
  const wantTotalBalanceResult = vaultContract.try_balance()
  if (wantTotalBalanceResult.reverted) {
    return balances
  }
  const wantTotalBalance = wantTotalBalanceResult.value

  const underlyingTokenAddress = Address.fromBytes(classic.underlyingToken)

  // fetch on chain data
  const curveTokenContract = CurveTokenContract.bind(underlyingTokenAddress)
  const totalSupplyResult = curveTokenContract.try_totalSupply()
  if (totalSupplyResult.reverted) {
    return []
  }
  const totalSupply = totalSupplyResult.value

  // Some pools have N_COINS but some don't, so we have to resort to trying until we get a revert
  const curvePoolContract = CurvePoolContract.bind(underlyingTokenAddress)
  const coins = new Array<Address>()
  const coinsResult = curvePoolContract.try_coins(BigInt.zero())
  if (coinsResult.reverted) {
    return []
  }
  coins.push(coinsResult.value)
  const coinsResult2 = curvePoolContract.try_coins(BigInt.fromI32(1))
  if (coinsResult2.reverted) {
    return []
  }
  coins.push(coinsResult2.value) // always at least 2 coins
  for (let i = 2; i < 8; ++i) {
    const nextCoinResult = curvePoolContract.try_coins(BigInt.fromI32(i))
    if (nextCoinResult.reverted) {
      return []
    }
    coins.push(nextCoinResult.value)
  }

  // Some pools have get_balances() but some don't, so we have to resort to looping
  const reserves = new Array<BigInt>()
  for (let i = 0; i < coins.length; ++i) {
    const balancesResult = curvePoolContract.try_balances(BigInt.fromI32(i))
    if (balancesResult.reverted) {
      return []
    }
    reserves.push(balancesResult.value)
  }

  for (let i = 0; i < coins.length; ++i) {
    balances.push(new TokenBalance(coins[i], reserves[i].times(wantTotalBalance).div(totalSupply)))
  }

  return balances
}
