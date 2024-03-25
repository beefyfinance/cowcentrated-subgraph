import { log } from "@graphprotocol/graph-ts"
import { BoostDeployed as BoostDeployedEvent } from "../generated/BeefyBoostFactory/BeefyBoostFactory"
import { BeefyBoost as BeefyBoostContract } from "../generated/templates/BeefyBoost/BeefyBoost"
import { getBoost } from "./entity/boost"
import { getTransaction } from "./entity/transaction"
import { fetchAndSaveTokenData } from "./utils/token"
import { BeefyBoost as BeefyBoostTemplate } from "../generated/templates"
import { getBeefyCLVault, isNewVault } from "./entity/vault"

export function handleBoostCreated(event: BoostDeployedEvent): void {
  const boostAddress = event.params.boost

  const tx = getTransaction(event.block, event.transaction, event.receipt)
  tx.save()

  const boostContract = BeefyBoostContract.bind(boostAddress)

  //////
  // fetch additional on-chain data
  const vaultAddressRes = boostContract.try_stakedToken()
  if (vaultAddressRes.reverted) {
    log.error("handleBoostCreated: stakedToken call reverted for boost {}", [boostAddress.toHexString()])
    throw new Error("handleBoostCreated: stakedToken call reverted")
  }
  const vaultAddress = vaultAddressRes.value
  const vault = getBeefyCLVault(vaultAddress)

  // early exit if vault is not part of beefy CL
  if (isNewVault(vault)) {
    log.warning("handleBoostCreated: vault {} does not exist or is not part of Beefy CL", [vaultAddress.toHexString()])
    return
  }

  const rewardTokenAddressRes = boostContract.try_rewardToken()
  if (rewardTokenAddressRes.reverted) {
    log.error("handleBoostCreated: rewardToken call reverted for boost {}", [boostAddress.toHexString()])
    throw new Error("handleBoostCreated: rewardToken call reverted")
  }
  const rewardTokenAddress = rewardTokenAddressRes.value

  const rewardToken = fetchAndSaveTokenData(rewardTokenAddress)

  const boost = getBoost(event.params.boost)
  boost.createdWith = tx.id
  boost.vault = vault.id
  boost.rewardedIn = rewardToken.id
  boost.save()

  // start indexing the new boost
  BeefyBoostTemplate.create(boostAddress)
}
