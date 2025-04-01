import { Classic } from "../../../generated/schema"
import { TokenBalance } from "./common"
import { ClassicVault as ClassicVaultContract } from "../../../generated/templates/ClassicVault/ClassicVault"
import { PendleMarket as PendleMarketContract } from "../../../generated/templates/ClassicVault/PendleMarket"
import { PendleSyToken as PendleSyTokenContract } from "../../../generated/templates/ClassicVault/PendleSyToken"
import { Address } from "@graphprotocol/graph-ts"

const PENDLE_ROUTER_ADDRESS = Address.fromString("0x00000000005BBB0EF59571E58418F9a4357b68A0")

export function isPendleVault(classic: Classic): boolean {
  const breakdown = getVaultTokenBreakdownPendle(classic)
  return breakdown.length > 0
}

export function getVaultTokenBreakdownPendle(classic: Classic): Array<TokenBalance> {
  let balances = new Array<TokenBalance>()

  const vaultContract = ClassicVaultContract.bind(Address.fromBytes(classic.vaultSharesToken))
  const wantTotalBalanceResult = vaultContract.try_balance()
  if (wantTotalBalanceResult.reverted) {
    return []
  }
  const wantTotalBalance = wantTotalBalanceResult.value

  // fetch on chain data
  const pendleMarketContract = PendleMarketContract.bind(Address.fromBytes(classic.underlyingToken))
  const tokenAddressesResult = pendleMarketContract.try_readTokens()
  if (tokenAddressesResult.reverted) {
    return []
  }
  const tokenAddresses = tokenAddressesResult.value

  const pendleStateResult = pendleMarketContract.try_readState(PENDLE_ROUTER_ADDRESS)
  if (pendleStateResult.reverted) {
    return []
  }
  const pendleState = pendleStateResult.value

  const syTokenContract = PendleSyTokenContract.bind(tokenAddresses.value0)
  const syUnderlyingAddressResult = syTokenContract.try_yieldToken()
  if (syUnderlyingAddressResult.reverted) {
    return []
  }
  const syUnderlyingAddress = syUnderlyingAddressResult.value

  // compute breakdown
  balances.push(
    new TokenBalance(syUnderlyingAddress, pendleState.totalSy.times(wantTotalBalance).div(pendleState.totalLp)),
  )

  return balances
}
