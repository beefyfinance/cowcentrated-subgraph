import { BigInt } from "@graphprotocol/graph-ts"
import { BeefyCLStrategy, BeefyCLVault, Token } from "../../generated/schema"
import { ZERO_BI, changeValueEncoding } from "./decimal"
import { CHAINLINK_NATIVE_PRICE_FEED_ADDRESS, PRICE_FEED_DECIMALS, PRICE_STORE_DECIMALS_USD } from "../config"
import { Multicall3Params, multicall } from "./multicall"
import { isNullToken } from "../entity/token"

export function fetchVaultLatestData(
  vault: BeefyCLVault,
  strategy: BeefyCLStrategy,
  sharesToken: Token,
  rewardPoolToken: Token,
  token0: Token,
  token1: Token,
): VaultData {
  const signatures = [
    new Multicall3Params(vault.id, "totalSupply()", "uint256"),
    new Multicall3Params(vault.id, "balances()", "(uint256,uint256)"),
    new Multicall3Params(strategy.id, "balancesOfPool()", "(uint256,uint256,uint256,uint256,uint256,uint256)"),
    new Multicall3Params(strategy.id, "price()", "uint256", true), // this can revert when the liquidity is 0
    new Multicall3Params(strategy.id, "range()", "(uint256,uint256)", true), // this can revert when the liquidity is 0
    new Multicall3Params(strategy.id, "lpToken0ToNativePrice()", "uint256"),
    new Multicall3Params(strategy.id, "lpToken1ToNativePrice()", "uint256"),
    new Multicall3Params(strategy.id, "output0ToNativePrice()", "uint256", true), // only some strategies have this
    new Multicall3Params(
      CHAINLINK_NATIVE_PRICE_FEED_ADDRESS,
      "latestRoundData()",
      "(uint80,int256,uint256,uint256,uint80)",
    ),
    new Multicall3Params(rewardPoolToken.id, "totalSupply()", "uint256", true), // only some vaults have a reward pool token
  ]

  const results = multicall(signatures)
  const totalSupplyRes = results[0];
  const balanceRes = results[1];
  const balanceOfPoolRes = results[2];
  const priceRes = results[3];
  const rangeRes = results[4];
  const token0ToNativePriceRes = results[5];
  const token1ToNativePriceRes = results[6];
  const output0ToNativePriceRes = results[7];
  const chainLinkAnswerRes = results[8];
  const rewardPoolTotalSupplyRes = results[9];

  const totalSupply = totalSupplyRes.value.toBigInt()
  const balances = balanceRes.value.toTuple()
  const token0Balance = balances[0].toBigInt()
  const token1Balance = balances[1].toBigInt()

  const balanceOfPool = balanceOfPoolRes.value.toTuple()
  const token0PositionMainBalance = balanceOfPool[2].toBigInt()
  const token1PositionMainBalance = balanceOfPool[3].toBigInt()
  const token0PositionAltBalance = balanceOfPool[4].toBigInt()
  const token1PositionAltBalance = balanceOfPool[5].toBigInt()

  // price is the amount of token1 per token0, expressed with 36 decimals
  const priceDecimals = BigInt.fromU32(36)
  let priceOfToken0InToken1 = ZERO_BI
  if (!priceRes.reverted) {
    priceOfToken0InToken1 = changeValueEncoding(priceRes.value.toBigInt(), priceDecimals, token1.decimals)
  }

  // price range
  let priceRangeMin1 = ZERO_BI
  let priceRangeMax1 = ZERO_BI
  if (!rangeRes.reverted) {
    const range = rangeRes.value.toTuple()
    priceRangeMin1 = changeValueEncoding(range[0].toBigInt(), priceDecimals, token1.decimals)
    priceRangeMax1 = changeValueEncoding(range[1].toBigInt(), priceDecimals, token1.decimals)
  }

  // and now the prices
  const token0ToNativePrice = token0ToNativePriceRes.value.toBigInt()
  const token1ToNativePrice = token1ToNativePriceRes.value.toBigInt()
  let output0ToNativePrice = ZERO_BI
  if (!output0ToNativePriceRes.reverted) {
    output0ToNativePrice = output0ToNativePriceRes.value.toBigInt()
  }

  // and have a native price in USD
  const chainLinkAnswer = chainLinkAnswerRes.value.toTuple()
  const nativeToUSDPrice = changeValueEncoding(
    chainLinkAnswer[1].toBigInt(),
    PRICE_FEED_DECIMALS,
    PRICE_STORE_DECIMALS_USD,
  )

  let rewardPoolTotalSupply = ZERO_BI
  if (!isNullToken(rewardPoolToken)) {
    rewardPoolTotalSupply = rewardPoolTotalSupplyRes.value.toBigInt()
  }

  return new VaultData(
    totalSupply,
    rewardPoolTotalSupply,
    token0Balance,
    token1Balance,

    token0PositionMainBalance,
    token1PositionMainBalance,
    token0PositionAltBalance,
    token1PositionAltBalance,

    priceOfToken0InToken1,
    priceRangeMin1,
    priceRangeMax1,

    token0ToNativePrice,
    token1ToNativePrice,
    output0ToNativePrice,
    nativeToUSDPrice,
  )
}

class VaultData {
  constructor(
    public sharesTotalSupply: BigInt,
    public rewardPoolTotalSupply: BigInt,
    public token0Balance: BigInt,
    public token1Balance: BigInt,

    public token0PositionMainBalance: BigInt,
    public token1PositionMainBalance: BigInt,
    public token0PositionAltBalance: BigInt,
    public token1PositionAltBalance: BigInt,

    public priceOfToken0InToken1: BigInt,
    public priceRangeMin1: BigInt,
    public priceRangeMax1: BigInt,

    public token0ToNativePrice: BigInt,
    public token1ToNativePrice: BigInt,
    public output0ToNativePrice: BigInt,
    public nativeToUSDPrice: BigInt,
  ) {}
}
