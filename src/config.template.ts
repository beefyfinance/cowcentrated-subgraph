import { Address, BigInt } from "@graphprotocol/graph-ts"

export const NETWORK_NAME = "{{network}}"
export const WNATIVE_TOKEN_ADDRESS = Address.fromString("{{wrappedNativeAddress}}")
export const WNATIVE_DECIMALS = BigInt.fromU32({{wrappedNativeDecimals}})
export const CHAINLINK_NATIVE_PRICE_FEED_ADDRESS = Address.fromString("{{chainlinkNativePriceFeedAddress}}")
export const PRICE_FEED_DECIMALS = BigInt.fromU32({{chainlinkNativePriceFeedDecimals}})
export const SHARE_TOKEN_MINT_ADDRESS = Address.fromString("{{shareTokenMintAddress}}")
export const BURN_ADDRESS = Address.fromString("{{burnAddress}}")
export const MULTICALL3_ADDRESS = Address.fromString("{{multicall3Address}}")
export const PRICE_STORE_DECIMALS_USD = BigInt.fromU32(18)
export const PRICE_STORE_DECIMALS_TOKEN_TO_NATIVE = BigInt.fromU32(18)
export const BEEFY_SWAPPER_ADDRESS = Address.fromString("{{beefySwapperAddress}}")
export const BEEFY_ORACLE_ADDRESS = Address.fromString("{{beefyOracleAddress}}")
// amount we divide 1 of _fromToken to get 1 of _toToken before asking for the price
// this is to avoid liquidity issues with tokens that have very high price (e.g. BTC)
export const BEEFY_SWAPPER_VALUE_SCALER = BigInt.fromU32(20)