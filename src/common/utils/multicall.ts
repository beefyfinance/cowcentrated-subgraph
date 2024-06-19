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

class MulticallResult {
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
    const functionSignature = Bytes.fromUint8Array(
      crypto.keccak256(ByteArray.fromUTF8(callParam.functionSignature)).slice(0, 4),
    )

    let functionCallBytes = functionSignature
    for (let j = 0; j < callParam.args.length; j++) {
      functionCallBytes = functionCallBytes.concat(callParam.args[j].toBytes())
    }

    params.push(
      // @ts-ignore
      changetype<ethereum.Tuple>([
        ethereum.Value.fromAddress(Address.fromBytes(callParam.contractAddress)),
        ethereum.Value.fromBoolean(true),
        ethereum.Value.fromBytes(functionCallBytes),
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
      const value = res[1]
      if (value == null) {
        log.error("Failed to decode result for {}", [callParam.functionSignature])
        results.push(new MulticallResult(ethereum.Value.fromI32(0), true))
      } else {
        results.push(new MulticallResult(value, false))
      }
    } else {
      log.warning("Call failed for {}", [callParam.functionSignature])
      results.push(new MulticallResult(ethereum.Value.fromBytes(Bytes.fromI32(0)), true))
    }
  }

  return results
}
