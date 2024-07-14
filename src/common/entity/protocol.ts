import { Bytes } from "@graphprotocol/graph-ts"
import { Protocol } from "../../../generated/schema"
import { ONE_BI } from "../utils/decimal"

export type ProtocolId = String
const PROTOCOL_BEEFY_CLASSIC_ID: Bytes = Bytes.fromByteArray(Bytes.fromBigInt(ONE_BI))
const PROTOCOL_BEEFY_CL_ID: Bytes = Bytes.fromByteArray(Bytes.fromBigInt(ONE_BI.plus(ONE_BI)))
const PROTOCOL_BEEFY_RP_ID: Bytes = Bytes.fromByteArray(Bytes.fromBigInt(ONE_BI.plus(ONE_BI).plus(ONE_BI)))

export function getBeefyClassicProtocol(): Protocol {
  const protocolId = PROTOCOL_BEEFY_CLASSIC_ID
  let protocol = Protocol.load(protocolId)
  if (!protocol) {
    protocol = new Protocol(protocolId)
    protocol.name = "Beefy Classic"
    protocol.save()
  }
  return protocol
}

export function getBeefyCLProtocol(): Protocol {
  const protocolId = PROTOCOL_BEEFY_CL_ID
  let protocol = Protocol.load(protocolId)
  if (!protocol) {
    protocol = new Protocol(protocolId)
    protocol.name = "Beefy CL"
    protocol.save()
  }
  return protocol
}

export function getBeefyRewardPoolProtocol(): Protocol {
  const protocolId = PROTOCOL_BEEFY_RP_ID
  let protocol = Protocol.load(protocolId)
  if (!protocol) {
    protocol = new Protocol(protocolId)
    protocol.name = "Beefy Reward Pool"
    protocol.save()
  }
  return protocol
}
