import { ChargedFees } from "../generated/templates/BeefyCLStrategy/BeefyStrategy"
import { getBeefyCLStrategy, getBeefyCLVault, getBeefyCLVaultSnapshot, isVaultRunning } from "./entity/vault"
import { PROTOCOL_SNAPSHOT_PERIODS, VAULT_SNAPSHOT_PERIODS } from "./utils/time"
import { getTransaction } from "./entity/transaction"
import { getBeefyCLProtocolSnapshot } from "./entity/protocol"
import { weiToBigDecimal } from "./utils/decimal"
import { fetchNativePriceUSD } from "./utils/price"

export function handleStrategyChargedFees(event: ChargedFees): void {
  let strategy = getBeefyCLStrategy(event.address)
  let vault = getBeefyCLVault(strategy.vault)
  if (!isVaultRunning(vault)) {
    return
  }

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain
  const nativePriceUSD = fetchNativePriceUSD()

  ///////
  // compute derived values
  const beefyFeeNative = weiToBigDecimal(event.params.beefyFeeAmount)
  const callerFeeNative = weiToBigDecimal(event.params.callFeeAmount)
  const strategistFeeNative = weiToBigDecimal(event.params.strategistFeeAmount)

  ///////
  // update protocol entities
  for (let i = 0; i < PROTOCOL_SNAPSHOT_PERIODS.length; i++) {
    const period = PROTOCOL_SNAPSHOT_PERIODS[i]
    const protocolSnapshot = getBeefyCLProtocolSnapshot(event.block.timestamp, period)
    protocolSnapshot.protocolFeesCollectedNative = protocolSnapshot.protocolFeesCollectedNative.plus(beefyFeeNative)
    protocolSnapshot.protocolFeesCollectedUSD = protocolSnapshot.protocolFeesCollectedUSD.plus(
      beefyFeeNative.times(nativePriceUSD),
    )
    protocolSnapshot.strategistFeesCollectedNative =
      protocolSnapshot.strategistFeesCollectedNative.plus(strategistFeeNative)
    protocolSnapshot.strategistFeesCollectedUSD = protocolSnapshot.strategistFeesCollectedUSD.plus(
      strategistFeeNative.times(nativePriceUSD),
    )
    protocolSnapshot.harvesterFeesCollectedNative = protocolSnapshot.harvesterFeesCollectedNative.plus(callerFeeNative)
    protocolSnapshot.harvesterFeesCollectedUSD = protocolSnapshot.harvesterFeesCollectedUSD.plus(
      callerFeeNative.times(nativePriceUSD),
    )

    protocolSnapshot.save()
  }

  ///////
  // update vault entities
  vault.cumulativeProtocolFeeCollectedNative = vault.cumulativeProtocolFeeCollectedNative.plus(beefyFeeNative)
  vault.cumulativeProtocolFeeCollectedUSD = vault.cumulativeProtocolFeeCollectedUSD.plus(
    beefyFeeNative.times(nativePriceUSD),
  )
  vault.cumulativeHarvesterFeeCollectedNative = vault.cumulativeHarvesterFeeCollectedNative.plus(callerFeeNative)
  vault.cumulativeHarvesterFeeCollectedUSD = vault.cumulativeHarvesterFeeCollectedUSD.plus(
    callerFeeNative.times(nativePriceUSD),
  )
  vault.cumulativeStrategistFeeCollectedNative = vault.cumulativeStrategistFeeCollectedNative.plus(strategistFeeNative)
  vault.cumulativeStrategistFeeCollectedUSD = vault.cumulativeStrategistFeeCollectedUSD.plus(
    strategistFeeNative.times(nativePriceUSD),
  )
  vault.save()

  for (let i = 0; i < VAULT_SNAPSHOT_PERIODS.length; i++) {
    const period = VAULT_SNAPSHOT_PERIODS[i]
    const vaultSnapshot = getBeefyCLVaultSnapshot(vault, event.block.timestamp, period)
    vaultSnapshot.protocolFeeCollectedNative = vaultSnapshot.protocolFeeCollectedNative.plus(beefyFeeNative)
    vaultSnapshot.protocolFeeCollectedUSD = vaultSnapshot.protocolFeeCollectedUSD.plus(
      beefyFeeNative.times(nativePriceUSD),
    )
    vaultSnapshot.harvesterFeeCollectedNative = vaultSnapshot.harvesterFeeCollectedNative.plus(callerFeeNative)
    vaultSnapshot.harvesterFeeCollectedUSD = vaultSnapshot.harvesterFeeCollectedUSD.plus(
      callerFeeNative.times(nativePriceUSD),
    )
    vaultSnapshot.strategistFeeCollectedNative = vaultSnapshot.strategistFeeCollectedNative.plus(strategistFeeNative)
    vaultSnapshot.strategistFeeCollectedUSD = vaultSnapshot.strategistFeeCollectedUSD.plus(
      strategistFeeNative.times(nativePriceUSD),
    )
    vaultSnapshot.save()
  }
}
