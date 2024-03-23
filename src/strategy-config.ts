import {
  SetLpToken0ToNativePath as SetLpToken0ToNativePathEvent,
  SetLpToken1ToNativePath as SetLpToken1ToNativePathEvent,
} from "../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap"
import { log } from "@graphprotocol/graph-ts"
import { getBeefyCLStrategy } from "./entity/vault"

export function handleStrategySetLpToken0ToNativePath(event: SetLpToken0ToNativePathEvent): void {
  log.info("handleSetLpToken0ToNativePath: {}", [event.transaction.hash.toHexString()])
  let strategy = getBeefyCLStrategy(event.address)
  strategy.lpToken0ToNativePath = event.params.path
  strategy.save()
}

export function handleStrategySetLpToken1ToNativePath(event: SetLpToken1ToNativePathEvent): void {
  log.info("handleSetLpToken1ToNativePath: {}", [event.transaction.hash.toHexString()])
  let strategy = getBeefyCLStrategy(event.address)
  strategy.lpToken1ToNativePath = event.params.path
  strategy.save()
}
