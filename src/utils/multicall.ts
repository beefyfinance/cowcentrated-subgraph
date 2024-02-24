import { Address, ByteArray, Bytes, crypto, ethereum } from '@graphprotocol/graph-ts'
import { Multicall3, Multicall3__aggregate3InputCallsStruct } from '../../generated/templates/BeefyCLVault/Multicall3'

const MULTICALL_ADDRESS = Address.fromString('0xcA11bde05977b3631167028862bE2a173976CA11')
export const multicallContract = Multicall3.bind(MULTICALL_ADDRESS)

const signatureCache = new Map<string, Bytes>()

/**
 * the Method ID is derived as the first 4 bytes of the Keccak-256 hash of the ASCII form of the signature
 */
function getMethodId(signature: string): Bytes {
  if (signatureCache.has(signature)) {
    return signatureCache.get(signature) as Bytes
  }
  const id = Bytes.fromUint8Array(crypto.keccak256(ByteArray.fromUTF8(signature)).slice(0, 4))
  signatureCache.set(signature, id)
  return id
}

/**
 * Create call data bytes for a function signature
 */
export function createCallData(signature: string, parameters: ethereum.Value[]): Bytes {
  const methodId = getMethodId(signature)

  let callData = methodId
  for (let i = 0; i < parameters.length; i++) {
    const param = parameters[i]
    const paramBytes = ethereum.encode(param)
    if (!paramBytes) {
      throw Error('Parameter encoding failed')
    }
    callData = callData.concat(paramBytes)
  }

  return callData
}

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
