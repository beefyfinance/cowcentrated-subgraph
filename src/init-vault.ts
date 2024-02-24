import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { BeefyCLStrategy, BeefyCLVault, Token } from '../generated/schema'
import { createCallData, multicallContract } from './utils/multicall'
import { Multicall3__aggregate3InputCallsStruct } from '../generated/templates/BeefyCLVault/Multicall3'
import { BeefyVaultConcLiq as BeefyCLVaultContract } from '../generated/templates/BeefyCLVault/BeefyVaultConcLiq'
import { IERC20 as IERC20Contract } from '../generated/templates/BeefyCLVault/IERC20'
import { getToken } from './entity/token'
import { getBeefyCLProtocol, getBeefyCLProtocolSnapshot } from './entity/protocol'
import { PERIODS } from './utils/time'

/**
 * Initialize the vault data.
 * Call this when both the vault and the strategy are initialized.
 */
export function initVaultData(timestamp: BigInt, vault: BeefyCLVault, strategy: BeefyCLStrategy): void {
  const vaultAddress = Address.fromBytes(vault.id)
  /*
  TODO: make a multicall to fetch all data from the vault
  // fetch all data from a multicall
  const res = multicallContract.aggregate3([
    new Multicall3__aggregate3InputCallsStruct(
      ethereum.Value.fromAddress(vaultAddress),
      ethereum.Value.fromBoolean(false),
      ethereum.Value.fromBytes(createCallData('wants()', [])),
    ),
    new Multicall3__aggregate3InputCallsStruct(
      ethereum.Value.fromAddress(vaultAddress),
      ethereum.Value.fromBoolean(false),
      ethereum.Value.fromBytes(createCallData('symbol()', [])),
    ),
    new Multicall3__aggregate3InputCallsStruct(
      ethereum.Value.fromAddress(vaultAddress),
      ethereum.Value.fromBoolean(false),
      ethereum.Value.fromBytes(createCallData('name()', [])),
    ),
    new Multicall3__aggregate3InputCallsStruct(
      ethereum.Value.fromAddress(vaultAddress),
      ethereum.Value.fromBoolean(false),
      ethereum.Value.fromBytes(createCallData('decimals()', [])),
    ),
  ])

  const wantsRes = ethereum.decode('(address,address)', res[0].returnData)
  if (!wantsRes) throw Error('Wants not found')
  const symbolRes = ethereum.decode('(string)', res[1].returnData)
  if (!symbolRes) throw Error('Symbol not found')
  const nameRes = ethereum.decode('(string)', res[2].returnData)
  if (!nameRes) throw Error('Name not found')
  const decimalsRes = ethereum.decode('(uint8)', res[3].returnData)
  if (!decimalsRes) throw Error('Decimals not found')

  const wantRes = wantsRes.toTuple()
  const want0 = wantRes[0].toAddress()
  const want1 = wantRes[1].toAddress()
  const shareTokenSymbol = symbolRes.toString()
  const shareTokenName = nameRes.toString()
  const shareTokenDecimals = decimalsRes.toI32()*/

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

  vault.underlyingToken0 = underlyingToken0.id
  vault.underlyingToken1 = underlyingToken1.id
  vault.save()

  const protocol = getBeefyCLProtocol()
  protocol.activeVaultCount += 1
  protocol.save()

  const periods = PERIODS
  for (let i = 0; i < periods.length; i++) {
    const protocolSnapshot = getBeefyCLProtocolSnapshot(timestamp, periods[i])
    protocolSnapshot.activeVaultCount += 1
    protocolSnapshot.save()
  }
}
