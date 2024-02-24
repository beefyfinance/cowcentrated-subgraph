import { Address, BigInt } from '@graphprotocol/graph-ts'
import { BeefyCLVault } from '../generated/schema'
import { BeefyVaultConcLiq as BeefyCLVaultContract } from '../generated/templates/BeefyCLVault/BeefyVaultConcLiq'
import { IERC20 as IERC20Contract } from '../generated/templates/BeefyCLVault/IERC20'
import { getToken } from './entity/token'
import { getBeefyCLProtocol, getBeefyCLProtocolSnapshot } from './entity/protocol'
import { PERIODS } from './utils/time'
import { BEEFY_CL_VAULT_LIFECYCLE_RUNNING } from './entity/vault'

/**
 * Initialize the vault data.
 * Call this when both the vault and the strategy are initialized.
 */
export function fetchInitialVaultData(timestamp: BigInt, vault: BeefyCLVault): BeefyCLVault {
  const vaultAddress = Address.fromBytes(vault.id)
  const vaultContract = BeefyCLVaultContract.bind(vaultAddress)
  const wants = vaultContract.wants()
  const underlyingToken0Address = wants.value0
  const underlyingToken1Address = wants.value1

  const shareTokenContract = IERC20Contract.bind(vaultAddress)
  const shareTokenSymbol = shareTokenContract.symbol()
  const shareTokenName = shareTokenContract.name()
  const shareTokenDecimals = shareTokenContract.decimals()

  const underlyingToken0Contract = IERC20Contract.bind(underlyingToken0Address)
  const underlyingToken0Decimals = underlyingToken0Contract.decimals()
  const underlyingToken0Name = underlyingToken0Contract.name()
  const underlyingToken0Symbol = underlyingToken0Contract.symbol()

  const underlyingToken1Contract = IERC20Contract.bind(underlyingToken1Address)
  const underlyingToken1Decimals = underlyingToken1Contract.decimals()
  const underlyingToken1Name = underlyingToken1Contract.name()
  const underlyingToken1Symbol = underlyingToken1Contract.symbol()

  const sharesToken = getToken(vaultAddress)
  sharesToken.name = shareTokenName
  sharesToken.symbol = shareTokenSymbol
  sharesToken.decimals = shareTokenDecimals
  sharesToken.save()

  const underlyingToken0 = getToken(underlyingToken0Address)
  underlyingToken0.name = underlyingToken0Name
  underlyingToken0.symbol = underlyingToken0Symbol
  underlyingToken0.decimals = underlyingToken0Decimals
  underlyingToken0.save()

  const underlyingToken1 = getToken(underlyingToken1Address)
  underlyingToken1.name = underlyingToken1Name
  underlyingToken1.symbol = underlyingToken1Symbol
  underlyingToken1.decimals = underlyingToken1Decimals
  underlyingToken1.save()

  const protocol = getBeefyCLProtocol()
  protocol.activeVaultCount += 1
  protocol.save()

  const periods = PERIODS
  for (let i = 0; i < periods.length; i++) {
    const protocolSnapshot = getBeefyCLProtocolSnapshot(timestamp, periods[i])
    protocolSnapshot.activeVaultCount += 1
    protocolSnapshot.save()
  }

  vault.sharesToken = sharesToken.id
  vault.underlyingToken0 = underlyingToken0.id
  vault.underlyingToken1 = underlyingToken1.id
  vault.lifecycle = BEEFY_CL_VAULT_LIFECYCLE_RUNNING

  return vault
}
