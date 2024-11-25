import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"

export const NETWORK_NAME = "{{{network}}}"
export const WNATIVE_TOKEN_ADDRESS = Address.fromString("{{wrappedNativeAddress}}")
export const WNATIVE_DECIMALS = BigInt.fromU32({{wrappedNativeDecimals}})
export const PRICE_ORACLE_TYPE: string = "{{priceOracleType}}"
export const CHAINLINK_NATIVE_PRICE_FEED_ADDRESS = Address.fromString("{{chainlinkNativePriceFeedAddress}}")
export const CHAINLINK_NATIVE_PRICE_FEED_DECIMALS = BigInt.fromU32({{chainlinkNativePriceFeedDecimals}})
export const PYTH_PRICE_FEED_ADDRESS = Address.fromString("{{pythPriceFeedAddress}}")
export const PYTH_NATIVE_PRICE_ID = Bytes.fromHexString("{{pythNativePriceId}}")
export const UMBRELLA_REGISTRY_ADDRESS = Address.fromString("{{umbrellaRegistryAddress}}")
export const UMBRELLA_REGISTRY_FEED_KEY_BYTES_32 = Bytes.fromHexString("0x556d6272656c6c61466565647300000000000000000000000000000000000000") // bytes32("UmbrellaFeeds")
export const UMBRELLA_REGISTRY_PRICE_FEED_NAME = "{{umbrellaRegistryPriceFeedName}}"
export const UMBRELLA_REGISTRY_PRICE_FEED_NAME_BYTES_32 = Bytes.fromHexString("{{umbrellaRegistryPriceFeedNameBytes32}}") // keccak256(abi.encodePacked(_name));
export const UMBRELLA_REGISTRY_PRICE_FEED_DECIMALS = BigInt.fromU32({{umbrellaRegistryPriceFeedDecimals}})
export const SHARE_TOKEN_MINT_ADDRESS = Address.fromString("{{shareTokenMintAddress}}")
export const BURN_ADDRESS = Address.fromString("{{burnAddress}}")
export const MULTICALL3_ADDRESS = Address.fromString("{{multicall3Address}}")
export const PRICE_STORE_DECIMALS_USD = BigInt.fromU32(18)
export const PRICE_STORE_DECIMALS_TOKEN_TO_NATIVE = BigInt.fromU32(18)
export const BEEFY_SWAPPER_ADDRESS = Address.fromString("{{beefySwapperAddress}}")
export const BEEFY_ORACLE_ADDRESS = Address.fromString("{{beefyOracleAddress}}")

// amount we divide 1 of _fromToken to get 1 of _toToken before asking for the price
// this is to avoid liquidity issues with tokens that have very high price (e.g. BTC)
export const BEEFY_SWAPPER_VALUE_SCALER = BigInt.fromU32(1000)

// on some network the classic vaults are supported by other data systems (databarn)
export const ONLY_KEEP_CLM_CLASSIC_VAULTS = {{onlyKeepClmClassicVaults}}

// set to true to enable position snapshots, this will increase db size significantly
// but makes tracking user positions over time way simpler
export const POSITION_SNAPSHOT_ENABLED = {{positionSnapshotEnabled}}
