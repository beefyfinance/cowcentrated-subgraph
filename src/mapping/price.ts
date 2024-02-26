import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { BeefyCLVault, Token } from '../../generated/schema'
import { StrategyPassiveManagerUniswap as BeefyCLStrategyContract } from '../../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap'
import { ONE_BD, exponentToBigInt, tokenAmountToDecimal } from '../utils/decimal'
import { UniswapQuoterV2 } from '../../generated/templates/BeefyCLStrategy/UniswapQuoterV2'
import { ChainLinkPriceFeed } from '../../generated/templates/BeefyCLStrategy/ChainLinkPriceFeed'

const quoter = UniswapQuoterV2.bind(Address.fromString('0x61ffe014ba17989e743c5f6cb21bf9697530b21e'))
const WNATIVE_DECIMALS = BigInt.fromI32(18)
const nativePriceFeed = ChainLinkPriceFeed.bind(Address.fromString('0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612'))
const PRICE_FEED_DECIMALS = BigInt.fromI32(8)

export function getVaultPrices(vault: BeefyCLVault, token0: Token, token1: Token): VaultPrices {
  log.debug('updateUserPosition: fetching data for vault {}', [vault.id])
  const strategyContract = BeefyCLStrategyContract.bind(Address.fromBytes(Address.fromHexString(vault.strategy)))

  // get the quoter paths for the vault
  // TODO: store these and handle the path updates
  const token0PathRes = strategyContract.try_lpToken0ToNativePath()
  if (token0PathRes.reverted) {
    log.error('updateUserPosition: lpToken0ToNativePath() reverted for strategy {}', [vault.strategy])
    throw Error('updateUserPosition: lpToken0ToNativePath() reverted')
  }
  const token1PathRes = strategyContract.try_lpToken1ToNativePath()
  if (token1PathRes.reverted) {
    log.error('updateUserPosition: lpToken1ToNativePath() reverted for strategy {}', [vault.strategy])
    throw Error('updateUserPosition: lpToken1ToNativePath() reverted')
  }
  const token0Path = token0PathRes.value
  const token1Path = token1PathRes.value

  // fetch the token prices to native
  let token0PriceInNative = ONE_BD
  if (token0Path.length > 0) {
    const token0PriceInNativeRes = quoter.try_quoteExactInput(token0Path, exponentToBigInt(token0.decimals))
    if (token0PriceInNativeRes.reverted) {
      log.error('updateUserPosition: quoteExactInput() reverted for token {}', [token0.id])
      throw Error('updateUserPosition: quoteExactInput() reverted')
    }
    token0PriceInNative = tokenAmountToDecimal(token0PriceInNativeRes.value.getAmountOut(), WNATIVE_DECIMALS)
    log.info('updateUserPosition: token0PriceInNativeRes: {}', [token0PriceInNative.toString()])
  }
  let token1PriceInNative = ONE_BD
  if (token1Path.length > 0) {
    const token1PriceInNativeRes = quoter.try_quoteExactInput(token1Path, exponentToBigInt(token1.decimals))
    if (token1PriceInNativeRes.reverted) {
      log.error('updateUserPosition: quoteExactInput() reverted for token {}', [token1.id])
      throw Error('updateUserPosition: quoteExactInput() reverted')
    }
    token1PriceInNative = tokenAmountToDecimal(token1PriceInNativeRes.value.getAmountOut(), WNATIVE_DECIMALS)
    log.info('updateUserPosition: token1PriceInNativeRes: {}', [token1PriceInNative.toString()])
  }

  // fetch the native price in USD
  const nativePriceUSDRes = nativePriceFeed.try_latestRoundData()
  if (nativePriceUSDRes.reverted) {
    log.error('updateUserPosition: latestRoundData() reverted for native token', [])
    throw Error('updateUserPosition: latestRoundData() reverted')
  }
  const nativePriceUSD = tokenAmountToDecimal(nativePriceUSDRes.value.getAnswer(), PRICE_FEED_DECIMALS)
  log.info('updateUserPosition: nativePriceUSD: {}', [nativePriceUSD.toString()])

  return new VaultPrices(token0PriceInNative, token1PriceInNative, nativePriceUSD)
}

export function getNativePriceUSD(): BigDecimal {
  const nativePriceUSDRes = nativePriceFeed.try_latestRoundData()
  if (nativePriceUSDRes.reverted) {
    log.error('updateUserPosition: latestRoundData() reverted for native token', [])
    throw Error('updateUserPosition: latestRoundData() reverted')
  }
  return tokenAmountToDecimal(nativePriceUSDRes.value.getAnswer(), PRICE_FEED_DECIMALS)
}

class VaultPrices {
  _token0ToNative: BigDecimal
  _token1ToNative: BigDecimal
  _nativeToUsd: BigDecimal
  constructor(_token0ToNative: BigDecimal, _token1ToNative: BigDecimal, _nativeToUsd: BigDecimal) {
    this._token0ToNative = _token0ToNative
    this._token1ToNative = _token1ToNative
    this._nativeToUsd = _nativeToUsd
  }

  get token0ToNative(): BigDecimal {
    return this._token0ToNative
  }

  get token1ToNative(): BigDecimal {
    return this._token1ToNative
  }

  get nativeToUsd(): BigDecimal {
    return this._nativeToUsd
  }
}
