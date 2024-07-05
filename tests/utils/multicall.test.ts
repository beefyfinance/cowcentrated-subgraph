import { assert, test, describe } from "matchstick-as/assembly/index"
import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts"
import { BEEFY_ORACLE_ADDRESS, PYTH_NATIVE_PRICE_ID, PYTH_PRICE_FEED_ADDRESS } from "../../src/config"
import { Multicall3Params, _multicall3ParamsToCallData } from "../../src/common/utils/multicall"

describe("multicall", () => {
  test("Encodes solo signature properly", () => {
    const someAddress = Address.fromBytes(Bytes.fromHexString("0x0dc808adce2099a9f62aa87d9670745aba741746"))

    const params = new Multicall3Params(someAddress, "totalSupply()", "uint256")

    const functionCall = _multicall3ParamsToCallData(params)

    assert.assertTrue(functionCall.equals(Bytes.fromHexString("0x18160ddd")))
  })

  test("Must encode one address parameter properly", () => {
    const someAddress = Address.fromBytes(Bytes.fromHexString("0x0dc808adce2099a9f62aa87d9670745aba741746"))

    const params = new Multicall3Params(BEEFY_ORACLE_ADDRESS, "getFreshPrice(address)", "(uint256,bool)", [
      ethereum.Value.fromAddress(someAddress),
    ])

    const functionCall = _multicall3ParamsToCallData(params)

    assert.assertTrue(
      functionCall.equals(
        Bytes.fromHexString("0xbaeb325b0000000000000000000000000dc808adce2099a9f62aa87d9670745aba741746"),
      ),
    )
  })

  test("Must encode pyth bytes32 parameter properly", () => {
    const params = new Multicall3Params(
      PYTH_PRICE_FEED_ADDRESS,
      "getPriceUnsafe(bytes32)",
      "(int64,uint64,int32,uint256)",
      [ethereum.Value.fromFixedBytes(PYTH_NATIVE_PRICE_ID)],
    )
    const functionCall = _multicall3ParamsToCallData(params)

    assert.assertTrue(
      functionCall.equals(
        Bytes.fromHexString("0x96834ad3ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"),
      ),
    )
  })
})
