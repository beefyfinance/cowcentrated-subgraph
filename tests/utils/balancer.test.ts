import { BigInt, log } from "@graphprotocol/graph-ts"
import { assert, test, describe } from "matchstick-as"
import { balancerWeightedPoolOutGivenIn } from "../../src/common/oracle/balancer"

describe("balancer", () => {
  test("balancerWeightedPoolOutGivenIn base case", () => {
    const amountIn = BigInt.fromString("1000000000000000000")
    const balanceOut = BigInt.fromString("1000000000000000000")
    const balanceIn = BigInt.fromString("1000000000000000000")
    const weightIn = BigInt.fromString("1000000000000000000")
    const weightOut = BigInt.fromString("1000000000000000000")
    const amountOut = balancerWeightedPoolOutGivenIn(amountIn, balanceOut, balanceIn, weightIn, weightOut)
    assert.bigIntEquals(amountOut, BigInt.fromString("500000000000000000"))
  })

  test("balancerWeightedPoolOutGivenIn real world", () => {
    const amountIn = BigInt.fromString("1000000000000000000")
    const balanceOut = BigInt.fromString("42046346668505392725117")
    const balanceIn = BigInt.fromString("5751263482696533390841535")
    const weightIn = BigInt.fromString("600000000000000000")
    const weightOut = BigInt.fromString("250000000000000000")
    const amountOut = balancerWeightedPoolOutGivenIn(amountIn, balanceOut, balanceIn, weightIn, weightOut)
    assert.bigIntEquals(amountOut, BigInt.fromString("21932397380095997"))
  })

  test("balancerWeightedPoolOutGivenIn real world 2", () => {
    const amountIn = BigInt.fromString("1000000000000000")
    const balanceOut = BigInt.fromString("40346155326879211805717")
    const balanceIn = BigInt.fromString("5976604677172986392177163")
    const weightIn = BigInt.fromString("600000000000000000")
    const weightOut = BigInt.fromString("250000000000000000")
    const amountOut = balancerWeightedPoolOutGivenIn(amountIn, balanceOut, balanceIn, weightIn, weightOut)
    assert.bigIntEquals(amountOut, BigInt.fromString("20252044691799"))
  })
})
