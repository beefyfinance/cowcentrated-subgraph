import { Bytes, ethereum, log, crypto, ByteArray, Address } from "@graphprotocol/graph-ts"
import { Multicall3 as Multicall3Contract } from "../../../generated/templates/ClmStrategy/Multicall3"
import { MULTICALL3_ADDRESS } from "../../config"

export class Multicall3Params {
  constructor(
    public contractAddress: Bytes,
    public functionSignature: string,
    public resultType: string,
    public args: Array<ethereum.Value> = [],
  ) {}
}

export class MulticallResult {
  constructor(
    public value: ethereum.Value,
    public reverted: boolean,
  ) {}
}

export function multicall(callParams: Array<Multicall3Params>): Array<MulticallResult> {
  const multicallContract = Multicall3Contract.bind(MULTICALL3_ADDRESS)

  let params: Array<ethereum.Tuple> = []
  for (let i = 0; i < callParams.length; i++) {
    const callParam = callParams[i]
    const functionCall = _multicall3ParamsToCallData(callParam)
    params.push(
      // @ts-expect-error assemblyscript native function
      changetype<ethereum.Tuple>([
        ethereum.Value.fromAddress(Address.fromBytes(callParam.contractAddress)),
        ethereum.Value.fromBoolean(true),
        ethereum.Value.fromBytes(functionCall),
      ]),
    )
  }

  // need a low level call, can't call aggregate due to typing issues
  const callResult = multicallContract.tryCall("aggregate3", "aggregate3((address,bool,bytes)[]):((bool,bytes)[])", [
    ethereum.Value.fromTupleArray(params),
  ])

  let results: Array<MulticallResult> = []

  // return all failed results if the call failed to prevent crashing
  if (callResult.reverted) {
    log.error("Multicall aggregate3 call failed", [])

    for (let i = 0; i < callParams.length; i++) {
      results.push(new MulticallResult(ethereum.Value.fromI32(0), true))
    }

    return results
  }

  const multiResults: Array<ethereum.Tuple> = callResult.value[0].toTupleArray<ethereum.Tuple>()

  for (let i = 0; i < callParams.length; i++) {
    const callParam = callParams[i]
    const res = multiResults[i]
    const success = res[0].toBoolean()
    if (success) {
      const value = ethereum.decode(callParam.resultType, res[1].toBytes())
      if (value == null) {
        log.warning("Failed to decode result for {}, function {}, with resultType {} and result bytes {}", [
          callParam.contractAddress.toHexString(),
          callParam.functionSignature,
          callParam.resultType,
          res[1].toBytes().toHexString(),
        ])
        results.push(new MulticallResult(ethereum.Value.fromI32(0), true))
      } else {
        results.push(new MulticallResult(value, false))
      }
    } else {
      log.warning("Multicall call failed for function {} on {}", [
        callParam.functionSignature,
        callParam.contractAddress.toHexString(),
      ])
      results.push(new MulticallResult(ethereum.Value.fromBytes(Bytes.fromI32(0)), true))
    }
  }

  return results
}

export function _multicall3ParamsToCallData(callParam: Multicall3Params): Bytes {
  const signature = Bytes.fromUint8Array(crypto.keccak256(ByteArray.fromUTF8(callParam.functionSignature)).slice(0, 4))

  let functionCall = signature
  if (callParam.args.length > 0) {
    const calldata = ethereum.encode(
      ethereum.Value.fromTuple(
        // @ts-expect-error assemblyscript native function
        changetype<ethereum.Tuple>(callParam.args),
      ),
    )

    if (calldata) {
      functionCall = functionCall.concat(calldata)
    } else {
      log.error("Failed to encode calldata for function {}", [callParam.functionSignature])
    }
  }

  return functionCall
}
