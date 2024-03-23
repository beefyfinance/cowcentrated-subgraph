import {
  SetLpToken0ToNativePath as SetLpToken0ToNativePathEvent,
  SetLpToken1ToNativePath as SetLpToken1ToNativePathEvent,
} from "../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap"
import { log } from "@graphprotocol/graph-ts"
import { getBeefyCLStrategy, getBeefyCLVault } from "./entity/vault"

export function handleSetLpToken0ToNativePath(event: SetLpToken0ToNativePathEvent): void {
  log.info("handleSetLpToken0ToNativePath: {}", [event.transaction.hash.toHexString()])

  let strategy = getBeefyCLStrategy(event.address)
  let vault = getBeefyCLVault(strategy.vault)

  vault.lpToken0ToNativePath = event.params.path
  vault.save()
}

export function handleSetLpToken1ToNativePath(event: SetLpToken1ToNativePathEvent): void {
  log.info("handleSetLpToken1ToNativePath: {}", [event.transaction.hash.toHexString()])

  let strategy = getBeefyCLStrategy(event.address)
  let vault = getBeefyCLVault(strategy.vault)

  vault.lpToken1ToNativePath = event.params.path
  vault.save()
}
