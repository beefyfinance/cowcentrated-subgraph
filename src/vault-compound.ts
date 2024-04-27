import { BigInt, ethereum } from "@graphprotocol/graph-ts"
import {
  ClaimedFees as ClaimedFeesEvent,
  ClaimedOutput as ClaimedOutputEvent,
} from "../generated/templates/BeefyCLStrategy/BeefyStrategy"
import { getBeefyCLStrategy, getBeefyCLVault, getBeefyCLVaultSnapshot, isVaultRunning } from "./entity/vault"
import { getTransaction } from "./entity/transaction"
import { BeefyCLVaultUnderlyingFeesCollectedEvent } from "../generated/schema"
import { getEventIdentifier } from "./utils/event"
import { getToken } from "./entity/token"
import { ZERO_BI } from "./utils/decimal"
import { VAULT_SNAPSHOT_PERIODS } from "./utils/time"
import { fetchVaultLatestData } from "./utils/price"

export function handleStrategyClaimedFees(event: ClaimedFeesEvent): void {
  handleStrategyFees(
    event,
    event.params.feeAlt0.plus(event.params.feeMain0),
    event.params.feeAlt1.plus(event.params.feeMain1),
    ZERO_BI,
  )
}
export function handleStrategyClaimedOutput(event: ClaimedOutputEvent): void {
  handleStrategyFees(event, ZERO_BI, ZERO_BI, event.params.fees)
}

function handleStrategyFees(
  event: ethereum.Event,
  collectedAmount0: BigInt,
  collectedAmount1: BigInt,
  collectedEarned: BigInt,
): void {
  let strategy = getBeefyCLStrategy(event.address)
  let vault = getBeefyCLVault(strategy.vault)
  if (!isVaultRunning(vault)) {
    return
  }

  const sharesToken = getToken(vault.sharesToken)
  const token0 = getToken(vault.underlyingToken0)
  const token1 = getToken(vault.underlyingToken1)

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain
  const vaultData = fetchVaultLatestData(vault, strategy, sharesToken, token0, token1)

  ///////
  // store the raw collect event
  let collect = new BeefyCLVaultUnderlyingFeesCollectedEvent(getEventIdentifier(event))
  collect.vault = vault.id
  collect.strategy = strategy.id
  collect.createdWith = tx.id
  collect.timestamp = event.block.timestamp
  collect.underlyingMainAmount0 = vaultData.token0PositionMainBalance
  collect.underlyingMainAmount1 = vaultData.token1PositionMainBalance
  collect.underlyingAltAmount0 = vaultData.token0PositionAltBalance
  collect.underlyingAltAmount1 = vaultData.token1PositionAltBalance
  collect.collectedAmount0 = collectedAmount0
  collect.collectedAmount1 = collectedAmount1
  collect.token0ToNativePrice = vaultData.token0ToNativePrice
  collect.token1ToNativePrice = vaultData.token1ToNativePrice
  collect.nativeToUSDPrice = vaultData.nativeToUSDPrice
  collect.save()

  ///////
  // update vault entity
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
}
