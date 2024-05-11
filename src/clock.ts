import { ethereum, log } from "@graphprotocol/graph-ts"
import { ClockTick } from "../generated/schema"
import { HOUR, VAULT_SNAPSHOT_PERIODS } from "./utils/time"
import { getClockTick } from "./entity/clock"
import { getBeefyCLProtocol } from "./entity/protocol"
import { getToken } from "./entity/token"
import { fetchVaultLatestData } from "./utils/vault-data"
import { getBeefyCLStrategy, getBeefyCLVaultSnapshot, isVaultInitialized } from "./entity/vault"

export function handleClockTick(block: ethereum.Block): void {
  const timestamp = block.timestamp

  let tickRes1h = getClockTick(timestamp, HOUR)
  if (!tickRes1h.isNew) {
    log.debug("handleClockTick: tick already exists for 1h period", [])
    return
  }
  tickRes1h.tick.save()

  updateDataOnClockTick(tickRes1h.tick)
}

function updateDataOnClockTick(tick: ClockTick): void {
  const protocol = getBeefyCLProtocol()
  const vaults = protocol.vaults.load()

  for (let i = 0; i < vaults.length; i++) {
    const vault = vaults[i]
    if (!isVaultInitialized(vault)) {
      continue
    }

    const strategy = getBeefyCLStrategy(vault.strategy)
    const sharesToken = getToken(vault.sharesToken)
    const rewardPoolToken = getToken(vault.rewardPoolToken)
    const token0 = getToken(vault.underlyingToken0)
    const token1 = getToken(vault.underlyingToken1)

    ///////
    // fetch data on chain for that vault
    const vaultData = fetchVaultLatestData(vault, strategy, sharesToken, rewardPoolToken, token0, token1)

    // update vault data
    vault.totalSupply = vaultData.sharesTotalSupply
    vault.rewardPoolTotalSupply = vaultData.rewardPoolTotalSupply
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
      const snapshot = getBeefyCLVaultSnapshot(vault, tick.timestamp, period)
      snapshot.totalSupply = vault.totalSupply
      snapshot.rewardPoolTotalSupply = vault.rewardPoolTotalSupply
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
}
