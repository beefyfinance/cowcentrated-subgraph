import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts"
import { Transfer as TransferEvent } from "../generated/templates/BeefyCLVault/BeefyVaultConcLiq"
import { getBeefyCLStrategy, getBeefyCLVault, getBeefyCLVaultSnapshot, isVaultInitialized } from "./entity/vault"
import { getTransaction } from "./entity/transaction"
import { getInvestor } from "./entity/investor"
import { ZERO_BI } from "./utils/decimal"
import { VAULT_SNAPSHOT_PERIODS } from "./utils/time"
import { getToken } from "./entity/token"
import { getInvestorPosition } from "./entity/position"
import { fetchVaultLatestData } from "./utils/price"
import { InvestorPositionInteraction } from "../generated/schema"
import { getEventIdentifier } from "./utils/event"
import { SHARE_TOKEN_MINT_ADDRESS } from "./config"

export function handleVaultTransfer(event: TransferEvent): void {
  // sending to self
  if (event.params.from.equals(event.params.to)) {
    return
  }

  // transfering nothing
  if (event.params.value.equals(ZERO_BI)) {
    return
  }

  // don't duplicate processing between Transfer and Deposit/Withdraw
  if (!event.params.from.equals(SHARE_TOKEN_MINT_ADDRESS)) {
    updateUserPosition(event, event.params.from, event.params.value.neg())
  }

  if (!event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS)) {
    updateUserPosition(event, event.params.to, event.params.value)
  }
}

function updateUserPosition(event: ethereum.Event, investorAddress: Address, sharesDelta: BigInt): void {
  let vault = getBeefyCLVault(event.address)
  if (!isVaultInitialized(vault)) {
    return
  }

  const strategy = getBeefyCLStrategy(vault.strategy)
  const sharesToken = getToken(vault.sharesToken)
  const token0 = getToken(vault.underlyingToken0)
  const token1 = getToken(vault.underlyingToken1)
  const investor = getInvestor(investorAddress)
  const position = getInvestorPosition(vault, investor)

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain
  const vaultData = fetchVaultLatestData(vault, strategy, sharesToken, token0, token1)

  ///////
  // update vault data
  vault.totalSupply = vaultData.sharesTotalSupply
  vault.token0ToNativePrice = vaultData.token0ToNativePrice
  vault.token1ToNativePrice = vaultData.token1ToNativePrice
  vault.nativeToUSDPrice = vaultData.nativeToUSDPrice
  vault.priceOfToken0InToken1 = vaultData.priceOfToken0InToken1
  vault.priceRangeMin1 = vaultData.priceRangeMin1
  vault.priceRangeMax1 = vaultData.priceRangeMax1
  vault.underlyingMainAmount0 = vaultData.token0PositionMainBalance
  vault.underlyingMainAmount1 = vaultData.token1PositionMainBalance
  vault.underlyingAltAmount0 = vaultData.token0PositionAltBalance
  vault.underlyingAltAmount1 = vaultData.token1PositionAltBalance
  vault.save()
  for (let i = 0; i < VAULT_SNAPSHOT_PERIODS.length; i++) {
    const period = VAULT_SNAPSHOT_PERIODS[i]
    const snapshot = getBeefyCLVaultSnapshot(vault, event.block.timestamp, period)
    snapshot.totalSupply = vault.totalSupply
    snapshot.token0ToNativePrice = vault.token0ToNativePrice
    snapshot.token1ToNativePrice = vault.token1ToNativePrice
    snapshot.nativeToUSDPrice = vault.nativeToUSDPrice
    snapshot.priceOfToken0InToken1 = vault.priceOfToken0InToken1
    snapshot.priceRangeMin1 = vault.priceRangeMin1
    snapshot.priceRangeMax1 = vault.priceRangeMax1
    snapshot.underlyingMainAmount0 = vault.underlyingMainAmount0
    snapshot.underlyingMainAmount1 = vault.underlyingMainAmount1
    snapshot.underlyingAltAmount0 = vault.underlyingAltAmount0
    snapshot.underlyingAltAmount1 = vault.underlyingAltAmount1
    snapshot.save()
  }

  ///////
  // investor
  investor.save()

  ///////
  // investor position
  if (position.sharesBalance.equals(ZERO_BI)) {
    position.createdWith = event.transaction.hash
  }
  position.sharesBalance = position.sharesBalance.plus(sharesDelta)
  position.save()

  ///////
  // interaction
  const interaction = new InvestorPositionInteraction(getEventIdentifier(event))
  interaction.vault = vault.id
  interaction.investor = investor.id
  interaction.investorPosition = position.id
  interaction.createdWith = event.transaction.hash
  interaction.blockNumber = event.block.number
  interaction.timestamp = event.block.timestamp
  interaction.type = sharesDelta.gt(ZERO_BI) ? "DEPOSIT" : "WITHDRAW"
  interaction.sharesBalance = position.sharesBalance
  interaction.underlyingBalance0 = vaultData.token0Balance
    .times(position.sharesBalance)
    .div(vaultData.sharesTotalSupply)
  interaction.underlyingBalance1 = vaultData.token1Balance
    .times(position.sharesBalance)
    .div(vaultData.sharesTotalSupply)
  interaction.sharesBalanceDelta = sharesDelta
  interaction.underlyingBalance0Delta = vaultData.token0Balance.times(sharesDelta).div(vaultData.sharesTotalSupply)
  interaction.underlyingBalance1Delta = vaultData.token1Balance.times(sharesDelta).div(vaultData.sharesTotalSupply)
  interaction.token0ToNativePrice = vaultData.token0ToNativePrice
  interaction.token1ToNativePrice = vaultData.token1ToNativePrice
  interaction.nativeToUSDPrice = vaultData.nativeToUSDPrice
  interaction.save()
}
