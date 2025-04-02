import { Address, Bytes, log } from "@graphprotocol/graph-ts"
import { Initialized } from "../../generated/templates/ClassicVault/ClassicVault"
import { getClassic, getClassicStrategy, getClassicVault } from "../classic/entity/classic"
import { getAndSaveTransaction } from "../common/entity/transaction"
import { LSTVault as LstVaultContract, Paused, Unpaused } from "../../generated/LSTVault/LSTVault"
import { getVaultTokenBreakdown, PLATFORM_BEEFY_LST_VAULT } from "../classic/platform"
import { fetchAndSaveTokenData } from "../common/utils/token"
import { PRODUCT_LIFECYCLE_PAUSED, PRODUCT_LIFECYCLE_RUNNING } from "../common/entity/lifecycle"
import { handleClassicLifecycleStatusChanged } from "../classic/lifecycle"

export function handleLSTVaultInitialized(event: Initialized): void {
  const tx = getAndSaveTransaction(event.block, event.transaction)

  const vaultAddress = event.address
  const classicAddress = event.address

  log.info("Creating LST Vault: {}", [vaultAddress.toHexString()])
  const vault = getClassicVault(vaultAddress)
  vault.isInitialized = true
  vault.createdWith = tx.id
  vault.classic = classicAddress
  vault.save()

  const strategy = getClassicStrategy(event.address)
  strategy.isInitialized = true
  strategy.createdWith = tx.id
  strategy.vault = event.address
  strategy.classic = classicAddress
  strategy.save()

  const classic = getClassic(vault.classic)
  classic.underlyingPlatform = PLATFORM_BEEFY_LST_VAULT
  classic.save()

  const vaultContract = LstVaultContract.bind(vaultAddress)

  const underlyingTokenAddressRes = vaultContract.try_want()
  if (underlyingTokenAddressRes.reverted) {
    log.error("Failed to fetch underlying token address for LST: {}", [vaultAddress.toHexString()])
    return
  }
  const underlyingTokenAddress = underlyingTokenAddressRes.value
  const vaultSharesToken = fetchAndSaveTokenData(vaultAddress)
  const underlyingToken = fetchAndSaveTokenData(underlyingTokenAddress)

  classic.vaultSharesToken = vaultSharesToken.id
  classic.underlyingToken = underlyingToken.id
  classic.lifecycle = PRODUCT_LIFECYCLE_RUNNING
  classic.underlyingPlatform = PLATFORM_BEEFY_LST_VAULT
  classic.save()

  const breakdown = getVaultTokenBreakdown(classic)
  const underlyingBreakdownTokens = new Array<Bytes>()
  const underlyingBreakdownTokensOrder = new Array<Bytes>()
  for (let i = 0; i < breakdown.length; i++) {
    underlyingBreakdownTokens.push(breakdown[i].tokenAddress)
    underlyingBreakdownTokensOrder.push(breakdown[i].tokenAddress)
  }
  classic.underlyingBreakdownTokens = underlyingBreakdownTokens
  classic.underlyingBreakdownTokensOrder = underlyingBreakdownTokensOrder
  classic.save()
}

export function handleLSTVaultPaused(event: Paused): void {
  const strategyAddress = event.address
  log.debug("LST Vault strategy paused: {}", [strategyAddress.toHexString()])

  const strategy = getClassicStrategy(strategyAddress)
  const classic = getClassic(strategy.vault)
  handleClassicLifecycleStatusChanged(classic, PRODUCT_LIFECYCLE_PAUSED)
}

export function handleLSTVaultUnpaused(event: Unpaused): void {
  const strategyAddress = event.address
  log.debug("LST Vault strategy unpaused: {}", [strategyAddress.toHexString()])

  const strategy = getClassicStrategy(strategyAddress)
  const classic = getClassic(strategy.vault)
  handleClassicLifecycleStatusChanged(classic, PRODUCT_LIFECYCLE_RUNNING)
}
