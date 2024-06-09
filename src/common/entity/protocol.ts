import { Bytes } from "@graphprotocol/graph-ts"
import { Protocol } from "../../../generated/schema"
import { ONE_BI } from "../utils/decimal"

export type ProtocolId = String
export const PROTOCOL_BEEFY_CL: ProtocolId = "CLM"
export const PROTOCOL_BEEFY_CL_ID: Bytes = Bytes.fromByteArray(Bytes.fromBigInt(ONE_BI))

export function getBeefyCLProtocol(): Protocol {
  const protocolId = PROTOCOL_BEEFY_CL_ID
  let protocol = Protocol.load(protocolId)
  if (!protocol) {
    protocol = new Protocol(protocolId)
    protocol.name = "Beefy CL"
  }
  return protocol
}
