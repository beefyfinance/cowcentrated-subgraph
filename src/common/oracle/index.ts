import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import { Token } from "../../../generated/schema"
import { exponentToBigInt, ZERO_BI } from "../utils/decimal"
import { NETWORK_NAME, WNATIVE_DECIMALS, WNATIVE_TOKEN_ADDRESS } from "../../config"
import { getBeefyClassicWrapperTokenToNativePrice } from "./beefyWrapper"
import { getSolidlyTokenToNativePrice } from "./solidly"
import { getSwapxCLMultiHopTokenToNativePrice, getSwapxTokenToNativePrice } from "./swapx"
import { getBalancerWeightedPoolTokenPrice } from "./balancer"
import { getAlgebraTokenToNativePrice, AlgebraPathItem } from "./algebra"

/**
 * Detect missing swapper infos with the following queries:
 

 select

    (
        toDecimal256 (classic.underlyingAmount, 18) / pow(10, t_underlying.decimals)
    ) * (
        toDecimal256 (classic.underlyingToNativePrice, 18) / pow(10, 18)
    ) * (
        toDecimal256 (classic.nativeToUSDPrice, 18) / pow(10, 18)
    ) as underlying_token_amount_usd,
    classic.underlyingBreakdownToNativePrices,
    classic.underlyingBreakdownTokens
 from `Classic` classic
 LEFT JOIN Token t_underlying ON classic.underlyingToken = t_underlying.id
where vaultSharesTotalSupply > 0
and has(underlyingBreakdownToNativePrices, '0');
 




WITH
    -- Precompute USD value and extract breakdown tokens/prices
    snapshot_data AS (
        SELECT
            (
                toDecimal256(s.underlyingAmount, 18) / pow(10, t.decimals)
            ) * (
                toDecimal256(s.underlyingToNativePrice, 18) / pow(10, 18)
            ) * (
                toDecimal256(s.nativeToUSDPrice, 18) / pow(10, 18)
            ) AS underlying_token_amount_usd,
            s.timestamp,
            toDate(s.timestamp) AS datetime,
            c.id AS classic_id,
            c.underlyingBreakdownTokensOrder AS breakdown_tokens,
            s.underlyingBreakdownToNativePrices AS breakdown_prices
        FROM ClassicSnapshot AS s
        INNER JOIN Classic AS c ON s.classic = c.id
        LEFT JOIN Token AS t ON c.underlyingToken = t.id
        WHERE s.vaultSharesTotalSupply > 0
          AND s.period = 86400
    )
SELECT
    t.id AS token_id,
    t.symbol,
    t.name,
    COUNT(*) AS total_occurrences,
    countIf(bp = '0') AS zero_price_occurrences
FROM snapshot_data sd
ARRAY JOIN
    sd.breakdown_tokens AS bt,
    sd.breakdown_prices AS bp
LEFT JOIN Token AS t ON bt = t.id
GROUP BY t.id, t.symbol, t.name
ORDER BY zero_price_occurrences DESC, total_occurrences DESC;
 */

const SONIC_SWAPX_QUOTER_V2 = Bytes.fromHexString("0xd74a9Bd1C98B2CbaB5823107eb2BE9C474bEe09A")
const SONIC_SHADOW_QUOTER_V2 = Bytes.fromHexString("0x219b7ADebc0935a3eC889a148c6924D51A07535A")
const SONIC_EQUALIZER_ROUTER = Bytes.fromHexString("0xcc6169aa1e879d3a4227536671f85afdb2d23fad")

const SONIC_sfrxETH = Bytes.fromHexString("0x3Ec3849C33291a9eF4c5dB86De593EB4A37fDe45")
const SONIC_frxETH = Bytes.fromHexString("0x43edd7f3831b08fe70b7555ddd373c8bf65a9050")
const SONIC_scETH = Bytes.fromHexString("0x3bce5cb273f0f148010bbea2470e7b5df84c7812")
const SONIC_OS = Bytes.fromHexString("0xb1e25689d55734fd3fffc939c4c3eb52dff8a794")
const SONIC_SWPx = Bytes.fromHexString("0xa04bc7140c26fc9bb1f36b1a604c7a5a88fb0e70")
const SONIC_WBTC = Bytes.fromHexString("0x0555e30da8f98308edb960aa94c0db47230d2b9c")
const SONIC_bUSDCe20 = Bytes.fromHexString("0x322e1d5384aa4ed66aeca770b95686271de61dc3")
const SONIC_wstkscUSD = Bytes.fromHexString("0x9fb76f7ce5fceaa2c42887ff441d46095e494206")
const SONIC_scBTC = Bytes.fromHexString("0xbb30e76d9bb2cc9631f7fc5eb8e87b5aff32bfbd")
const SONIC_scUSD = Bytes.fromHexString("0xd3dce716f3ef535c5ff8d041c1a41c3bd89b97ae")
const SONIC_beSonic = Bytes.fromHexString("0x871a101dcf22fe4fe37be7b654098c801cba1c88")
const SONIC_stkscUSD = Bytes.fromHexString("0x4d85ba8c3918359c78ed09581e5bc7578ba932ba")
const SONIC_aSonUSDC = Bytes.fromHexString("0x578ee1ca3a8e1b54554da1bf7c583506c4cd11c6")
const SONIC_USDC = Bytes.fromHexString("0x29219dd400f2Bf60E5a23d13Be72B486D4038894")
const SONIC_wmooSiloV2SonicUSDCe = Bytes.fromHexString("0x7870ddfd5aca4e977b2287e9a212bcbe8fc4135a")
const SONIC_GFI = Bytes.fromHexString("0xbf5899166ac476370b3117c9256b7fc45624f4ea")
const SONIC_frxUSD = Bytes.fromHexString("0x80eede496655fb9047dd39d9f418d5483ed600df")
const SONIC_Silo = Bytes.fromHexString("0x53f753e4b17f4075d6fa2c6909033d224b81e698")
const SONIC_EGGS = Bytes.fromHexString("0xf26ff70573ddc8a90bd7865af8d7d70b8ff019bc")
const SONIC_USDT = Bytes.fromHexString("0x6047828dc181963ba44974801ff68e538da5eaf9")
const SONIC_LUDWIG = Bytes.fromHexString("0xe6cc4d855b4fd4a9d02f46b9adae4c5efb1764b5")
const SONIC_Beets_stS = Bytes.fromHexString("0xE5DA20F15420aD15DE0fa650600aFc998bbE3955")
const SONIC_stkscETH = Bytes.fromHexString("0x455d5f11Fea33A8fa9D3e285930b478B6bF85265")
const SONIC_wstkscETH = Bytes.fromHexString("0xe8a41c62bb4d5863c6eadc96792cfe90a1f37c47")
const SONIC_STRIKE = Bytes.fromHexString("0x8bb21b10f32a10bed94041746ffd32003bad6534")
const SONIC_wS = WNATIVE_TOKEN_ADDRESS

export function getTokenToNativePrice(inputToken: Token): BigInt {
  // sonic-sentio or sonic-mainnet
  if (NETWORK_NAME === "146" || NETWORK_NAME === "sonic") {
    if (inputToken.id.equals(SONIC_scETH)) {
      return getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, [SONIC_scETH, SONIC_wS])
    }

    if (inputToken.id.equals(SONIC_sfrxETH)) {
      const path = [SONIC_sfrxETH, SONIC_frxETH, SONIC_scETH, SONIC_wS]
      return getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_frxETH)) {
      const path = [SONIC_frxETH, SONIC_scETH, SONIC_wS]
      return getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_OS)) {
      const path = [SONIC_OS, SONIC_wS]
      return getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_SWPx)) {
      const path = [SONIC_SWPx, SONIC_wS]
      return getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_WBTC)) {
      const path = [SONIC_WBTC, SONIC_scBTC, SONIC_wS]
      return getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_bUSDCe20)) {
      const path = [SONIC_bUSDCe20, SONIC_wstkscUSD, SONIC_scUSD, SONIC_OS, SONIC_wS]
      return getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_wstkscUSD)) {
      const path = [SONIC_wstkscUSD, SONIC_scUSD, SONIC_OS, SONIC_wS]
      return getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_scBTC)) {
      const path = [SONIC_scBTC, SONIC_wS]
      return getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_beSonic)) {
      const path = [SONIC_beSonic, SONIC_OS, SONIC_wS]
      return getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_stkscUSD)) {
      const path = [SONIC_stkscUSD, SONIC_scUSD, SONIC_OS, SONIC_wS]
      return getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_aSonUSDC)) {
      // @dev: this is assuming aSonUSDC is equal to USDC.e, this is not true but close enough for our purpose
      //       of attributing user points and showing PnL in USD
      const path = [SONIC_USDC, SONIC_OS, SONIC_wS]
      return getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_wmooSiloV2SonicUSDCe)) {
      return getBeefyClassicWrapperTokenToNativePrice(inputToken)
    }

    if (inputToken.id.equals(SONIC_GFI)) {
      return getSolidlyTokenToNativePrice(inputToken, SONIC_EQUALIZER_ROUTER)
    }

    if (inputToken.id.equals(SONIC_frxUSD)) {
      const path = [SONIC_frxUSD, SONIC_scUSD, SONIC_wS]
      return getSwapxCLMultiHopTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_Silo)) {
      const path = [SONIC_Silo, SONIC_OS, SONIC_wS]
      return getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_EGGS)) {
      const path = [SONIC_EGGS, SONIC_OS, SONIC_wS]
      return getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_USDT)) {
      const path = [SONIC_USDT, SONIC_USDC, SONIC_wS]
      return getSwapxCLMultiHopTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_STRIKE)) {
      const path = [
        // STRIKE -> USDC
        new AlgebraPathItem(
          Address.fromBytes(Bytes.fromHexString("0xbCDBed4aC295dE3ea173469FDb9Cf5fD17ecf214")),
          6, // USDC
          18, // STRIKE
          false, // token1 -> token0
        ),
        // USDC -> wS
        new AlgebraPathItem(
          Address.fromBytes(Bytes.fromHexString("0x5c4b7d607aaf7b5cde9f09b5f03cf3b5c923aeea")),
          18, // wS
          6, // USDC
          false, // token1 -> token0
        ),
      ]
      return getAlgebraTokenToNativePrice(path)
    }

    if (inputToken.id.equals(SONIC_LUDWIG)) {
      // first get the price of Beets_stS
      const weightedPoolId = Bytes.fromHexString("0x21fed4063bf8ebf4f51f4adf4ecfc9717aa4ca9d000100000000000000000044")
      const ludwigPriceInBeets_stS = getBalancerWeightedPoolTokenPrice(inputToken, SONIC_Beets_stS, weightedPoolId)

      // then get the price of Beets_stS in wS
      const path = [SONIC_Beets_stS, SONIC_wS]
      const beets_stS_priceInwS = getSwapxTokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)

      return ludwigPriceInBeets_stS
        .times(beets_stS_priceInwS)
        .div(exponentToBigInt(BigInt.fromI32(18 /* decimals of Beets_stS */)))
    }

    log.error("Unhandled oracle for token: {}", [inputToken.id.toHexString()])
    return ZERO_BI
  }

  return ZERO_BI
}
