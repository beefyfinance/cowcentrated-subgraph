import { Address, BigInt } from "@graphprotocol/graph-ts"

export const NETWORK_NAME = "{{network}}"
export const WNATIVE_TOKEN_ADDRESS = Address.fromString("{{wrappedNativeAddress}}")
export const WNATIVE_DECIMALS = BigInt.fromU32({{wrappedNativeDecimals}})
export const CHAINLINK_NATIVE_PRICE_FEED_ADDRESS = Address.fromString("{{chainlinkNativePriceFeedAddress}}")
export const PRICE_FEED_DECIMALS = BigInt.fromU32({{chainlinkNativePriceFeedDecimals}})
export const SHARE_TOKEN_MINT_ADDRESS = Address.fromString("{{shareTokenMintAddress}}")