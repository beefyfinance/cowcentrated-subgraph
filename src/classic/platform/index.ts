import { log } from "@graphprotocol/graph-ts"
import { Classic } from "../../../generated/schema"
import { TokenBalance } from "./common"
import { getVaultTokenBreakdownAave, isAaveVault } from "./aave"
import {
  getVaultTokenBreakdownBalancer,
  getVaultTokenBreakdownBalancerAura,
  isBalancerAuraVault,
  isBalancerVault,
} from "./balancer"
import {
  getVaultTokenBreakdownBeefyCLM,
  getVaultTokenBreakdownBeefyCLMVault,
  isBeefyCLM,
  isBeefyCLMVault,
} from "./beefy_clm"
import { getVaultTokenBreakdownCurve, isCurveVault } from "./curve"
import { getVaultTokenBreakdownGamma, isGammaVault } from "./gamma"
import { getVaultTokenBreakdownIchiLynex, isIchiVault } from "./ichi"
import { getVaultTokenBreakdownLynex, isLynexVault } from "./lynex"
import {
  getVaultTokenBreakdownMendiLending,
  getVaultTokenBreakdownMendiLeverage,
  isMendiLendingVault,
  isMendiLeverageVault,
} from "./mendi"
import { getVaultTokenBreakdownNile, isNileVault } from "./nile"
import { getVaultTokenBreakdownPendle, isPendleVault } from "./pendle"
import { getVaultTokenBreakdownSolidly, isSolidlyVault } from "./solidly"
import { getVaultTokenBreakdownSilo, isSiloVault } from "./silo"
import { getVaultTokenBreakdownBeefyLstVault, isBeefyLstVault } from "./beefy_lst"
import { isDefiveVault, getVaultTokenBreakdownDefive } from "./defive"
import { isEulerVault, getVaultTokenBreakdownEuler } from "./euler"

const PLATFORM_AAVE = "AAVE"
const PLATFORM_BALANCER = "BALANCER"
const PLATFORM_BALANCER_AURA = "BALANCER_AURA"
const PLATFORM_CURVE = "CURVE"
const PLATFORM_EULER = "EULER"
const PLATFORM_DEFIVE = "DEFIVE"
const PLATFORM_GAMMA = "GAMMA"
const PLATFORM_ICHI_LYNEX = "ICHI_LYNEX"
const PLATFORM_LYNEX = "LYNEX"
const PLATFORM_MENDI_LENDING = "MENDI_LENDING"
const PLATFORM_MENDI_LEVERAGE = "MENDI_LEVERAGE"
const PLATFORM_NILE = "NILE"
const PLATFORM_PENDLE_EQUILIBRIA = "PENDLE_EQUILIBRIA"
const PLATFORM_SOLIDLY = "SOLIDLY"
const PLATFORM_SILO = "SILO"
const PLATFORM_BEEFY_CLM = "BEEFY_CLM"
const PLATFORM_BEEFY_CLM_VAULT = "BEEFY_CLM_VAULT"
export const PLATFORM_BEEFY_LST_VAULT = "BEEFY_LST_VAULT"
export const PLATFORM_UNKNOWN = "UNKNOWN"

export function getVaultTokenBreakdown(vault: Classic): Array<TokenBalance> {
  // try to detect underlying platform
  if (vault.underlyingPlatform == PLATFORM_UNKNOWN) {
    vault.underlyingPlatform = detectClassicVaultUnderlyingPlatform(vault)
    vault.save()

    if (vault.underlyingPlatform == PLATFORM_UNKNOWN) {
      return []
    }
  }

  if (vault.underlyingPlatform == PLATFORM_PENDLE_EQUILIBRIA) {
    return getVaultTokenBreakdownPendle(vault)
  } else if (vault.underlyingPlatform == PLATFORM_BALANCER_AURA) {
    return getVaultTokenBreakdownBalancerAura(vault)
  } else if (vault.underlyingPlatform == PLATFORM_BALANCER) {
    return getVaultTokenBreakdownBalancer(vault)
  } else if (vault.underlyingPlatform == PLATFORM_SILO) {
    return getVaultTokenBreakdownSilo(vault)
  } else if (vault.underlyingPlatform == PLATFORM_CURVE) {
    return getVaultTokenBreakdownCurve(vault)
  } else if (vault.underlyingPlatform == PLATFORM_SOLIDLY) {
    return getVaultTokenBreakdownSolidly(vault)
  } else if (vault.underlyingPlatform == PLATFORM_AAVE) {
    return getVaultTokenBreakdownAave(vault)
  } else if (vault.underlyingPlatform == PLATFORM_GAMMA) {
    return getVaultTokenBreakdownGamma(vault)
  } else if (vault.underlyingPlatform == PLATFORM_ICHI_LYNEX) {
    return getVaultTokenBreakdownIchiLynex(vault)
  } else if (vault.underlyingPlatform == PLATFORM_LYNEX) {
    return getVaultTokenBreakdownLynex(vault)
  } else if (vault.underlyingPlatform == PLATFORM_NILE) {
    return getVaultTokenBreakdownNile(vault)
  } else if (vault.underlyingPlatform == PLATFORM_MENDI_LENDING) {
    return getVaultTokenBreakdownMendiLending(vault)
  } else if (vault.underlyingPlatform == PLATFORM_MENDI_LEVERAGE) {
    return getVaultTokenBreakdownMendiLeverage(vault)
  } else if (vault.underlyingPlatform == PLATFORM_BEEFY_CLM) {
    return getVaultTokenBreakdownBeefyCLM(vault)
  } else if (vault.underlyingPlatform == PLATFORM_BEEFY_CLM_VAULT) {
    return getVaultTokenBreakdownBeefyCLMVault(vault)
  } else if (vault.underlyingPlatform == PLATFORM_BEEFY_LST_VAULT) {
    return getVaultTokenBreakdownBeefyLstVault(vault)
  } else if (vault.underlyingPlatform == PLATFORM_DEFIVE) {
    return getVaultTokenBreakdownDefive(vault)
  } else if (vault.underlyingPlatform == PLATFORM_EULER) {
    return getVaultTokenBreakdownEuler(vault)
  }

  log.error("Not implemented platform {} for vault {}", [vault.underlyingPlatform, vault.id.toHexString()])
  throw new Error("Not implemented platform")
}

export function detectClassicVaultUnderlyingPlatform(vault: Classic): string {
  if (isDefiveVault(vault)) {
    return PLATFORM_DEFIVE
  }

  if (isSiloVault(vault)) {
    return PLATFORM_SILO
  }

  if (isSolidlyVault(vault)) {
    return PLATFORM_SOLIDLY
  }

  if (isCurveVault(vault)) {
    return PLATFORM_CURVE
  }

  if (isEulerVault(vault)) {
    return PLATFORM_EULER
  }

  if (isPendleVault(vault)) {
    return PLATFORM_PENDLE_EQUILIBRIA
  }

  if (isBalancerAuraVault(vault)) {
    return PLATFORM_BALANCER_AURA
  }

  if (isBalancerVault(vault)) {
    return PLATFORM_BALANCER
  }

  if (isMendiLendingVault(vault)) {
    return PLATFORM_MENDI_LENDING
  }

  if (isMendiLeverageVault(vault)) {
    return PLATFORM_MENDI_LEVERAGE
  }

  if (isGammaVault(vault)) {
    return PLATFORM_GAMMA
  }

  if (isIchiVault(vault)) {
    return PLATFORM_ICHI_LYNEX
  }

  if (isLynexVault(vault)) {
    return PLATFORM_LYNEX
  }

  if (isNileVault(vault)) {
    return PLATFORM_NILE
  }

  if (isAaveVault(vault)) {
    return PLATFORM_AAVE
  }

  if (isBeefyCLMVault(vault)) {
    return PLATFORM_BEEFY_CLM_VAULT
  }

  if (isBeefyLstVault(vault)) {
    return PLATFORM_BEEFY_LST_VAULT
  }

  if (isBeefyCLM(vault)) {
    return PLATFORM_BEEFY_CLM
  }

  return PLATFORM_UNKNOWN
}
