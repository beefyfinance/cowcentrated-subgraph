import { Address, BigInt } from "@graphprotocol/graph-ts"

export const NETWORK_NAME = "{{network}}"
export const WNATIVE_TOKEN_ADDRESS = Address.fromString("{{wrappedNativeAddress}}")
export const WNATIVE_DECIMALS = BigInt.fromU32({{wrappedNativeDecimals}})
export const CHAINLINK_NATIVE_PRICE_FEED_ADDRESS = Address.fromString("{{chainlinkNativePriceFeedAddress}}")
export const PRICE_FEED_DECIMALS = BigInt.fromU32({{chainlinkNativePriceFeedDecimals}})
export const SHARE_TOKEN_MINT_ADDRESS = Address.fromString("{{shareTokenMintAddress}}")
export const MULTICALL3_ADDRESS = Address.fromString("{{multicall3Address}}")
export const PRICE_STORE_DECIMALS_USD = BigInt.fromU32(18)
export const PRICE_STORE_DECIMALS_TOKEN_TO_NATIVE = BigInt.fromU32(18)