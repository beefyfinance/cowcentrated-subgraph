import { Bytes, ethereum, log, crypto, ByteArray, Address } from "@graphprotocol/graph-ts"
import { Multicall3 as Multicall3Contract } from "../../generated/templates/BeefyCLStrategy/Multicall3"
import { MULTICALL3_ADDRESS } from "../config"

export class MulticallParams {
    constructor(public contractAddress: Bytes, public functionSignature: string, public resultType: string) {}
}

export function multicallRead(callParams: Array<MulticallParams>): Array<ethereum.Value> {
  const multicallContract = Multicall3Contract.bind(MULTICALL3_ADDRESS)

  let params: Array<ethereum.Tuple> = []
  for (let i = 0; i < callParams.length; i++) {
    const callParam = callParams[i]
    const sig = Bytes.fromUint8Array(crypto.keccak256(ByteArray.fromUTF8(callParam.functionSignature)).slice(0, 4))
    params.push(
      changetype<ethereum.Tuple>([
        ethereum.Value.fromAddress(Address.fromBytes(callParam.contractAddress)),
        ethereum.Value.fromBytes(sig),
      ]),
    )
  }

  // need a low level call, can't call aggregate due to typing issues
  const callResult = multicallContract.tryCall("aggregate", "aggregate((address,bytes)[]):(uint256,bytes[])", [
    ethereum.Value.fromTupleArray(params),
  ])
  if (callResult.reverted) {
    log.error("Multicall failed", [])
    throw Error("Multicall failed")
  }

  const multiResults = callResult.value[1].toBytesArray()
  let results: Array<ethereum.Value> = []
  for (let i = 0; i < callParams.length; i++) {
    const callParam = callParams[i]
    results.push(ethereum.decode(callParam.resultType, multiResults[i])!)
  }

  return results
}
