import { assert, clearStore, test, describe, afterAll } from "matchstick-as/assembly/index"
import { Address, ethereum } from "@graphprotocol/graph-ts"
import { createCallData } from "../../src/utils/multicall"

describe("Multicall", () => {
  afterAll(() => {
    clearStore()
  })

  test("Can create calldata with the function signature only", () => {
    const res = createCallData("strategy()", [])
    assert.stringEquals(res.toHexString(), "0xa8c62e76", "Call data should match")
  })

  test("Can create calldata from a function descriptor and values array", () => {
    const signature = "myFunction(uint256,address)"
    const parameters = [
      ethereum.Value.fromI32(123),
      ethereum.Value.fromAddress(Address.fromString("0x1234567890123456789012345678901234567890")),
    ]

    const res = createCallData(signature, parameters)
    assert.stringEquals(
      res.toHexString(),
      "0x9b62c59a000000000000000000000000000000000000000000000000000000000000007b0000000000000000000000001234567890123456789012345678901234567890",
      "Call data should match",
    )
  })
})
