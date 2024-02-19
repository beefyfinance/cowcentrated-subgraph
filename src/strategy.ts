import { Harvest as HarvestSchema } from '../generated/schema'
import { Harvest as HarvestEvent } from '../generated/templates/BeefyVaultConcLiqStrategy/StrategyPassiveManagerUniswap'
import {
  getEventIdentifier,
  getExistingStrategy,
  getExistingVault,
  getOrCreateToken,
  getOrCreateTransaction,
} from './common'
import { BeefyVaultConcLiq as BeefyVaultConcLiqContract } from '../generated/templates/BeefyVaultConcLiq/BeefyVaultConcLiq'
import { Address, BigInt } from '@graphprotocol/graph-ts'

export function handleHarvest(event: HarvestEvent): void {
  let strategy = getExistingStrategy(event.address)
  let tx = getOrCreateTransaction(event.block, event.transaction)
  let vault = getExistingVault(strategy.vault)

  let harvest = new HarvestSchema(getEventIdentifier(event))
  harvest.vault = vault.id
  harvest.strategy = strategy.id
  harvest.createdWith = tx.id
  harvest.fee0 = event.params.fee0
  harvest.fee1 = event.params.fee1
  harvest.save()

  // fetch additional data
  let vaultContract = BeefyVaultConcLiqContract.bind(Address.fromBytes(strategy.vault))
  let pricesPerToken = vaultContract.getTokensPerShare(BigInt.fromI32(1))

  // update the vault
  let sharesToken = getOrCreateToken(vault.id)
  let currentTotalSupply = sharesToken.totalSupply
  if (currentTotalSupply === null) throw Error('Vault not initialized')
  vault.underlyingAmount0 = currentTotalSupply.times(pricesPerToken.value0)
  vault.underlyingAmount1 = currentTotalSupply.times(pricesPerToken.value1)
  vault.save()

  // update all the current positions
  let positions = vault.positions.load()
  for (let i = 0; i < positions.length; i++) {
    let userPosition = positions[i]
    userPosition.underlyingBalance0 = userPosition.sharesBalance.times(pricesPerToken.value0)
    userPosition.underlyingBalance1 = userPosition.sharesBalance.times(pricesPerToken.value1)
    userPosition.save()
  }
}
