import { BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import { Token } from "../../../generated/schema"
import { ZERO_BI } from "../utils/decimal"
import { NETWORK_NAME, WNATIVE_TOKEN_ADDRESS } from "../../config"
import { getUniv2TokenToNativePrice } from "./univ2"
import { getBeefyClassicWrapperTokenToNativePrice } from "./beefyWrapper"

/**
 * Detect missing swapper infos with the following query:
WITH indices AS (
    SELECT 
        arrayEnumerate(underlyingBreakdownToNativePrices) AS indices
    FROM Classic
    WHERE has(underlyingBreakdownToNativePrices, '0')
),
token_prices AS (
    SELECT 
        arrayElement(underlyingBreakdownToNativePrices, index) AS price,
        arrayElement(underlyingBreakdownTokensOrder, index) AS token
    FROM Classic, indices
    ARRAY JOIN indices AS index
    WHERE has(underlyingBreakdownToNativePrices, '0')
)
SELECT token, count(*)
FROM token_prices
WHERE price = '0'
GROUP BY token
ORDER BY count(*) DESC;
 */

const SONIC_SWAPX_QUOTER_V2 = Bytes.fromHexString("0xd74a9Bd1C98B2CbaB5823107eb2BE9C474bEe09A")
const SONIC_SHADOW_QUOTER_V2 = Bytes.fromHexString("0x219b7ADebc0935a3eC889a148c6924D51A07535A")
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

const SONIC_wS = WNATIVE_TOKEN_ADDRESS

export function getTokenToNativePrice(inputToken: Token): BigInt {
  // sonic-sentio or sonic-mainnet
  if (NETWORK_NAME === "146" || NETWORK_NAME === "sonic") {
    if (inputToken.id.equals(SONIC_sfrxETH)) {
      const path = [SONIC_sfrxETH, SONIC_frxETH, SONIC_scETH, SONIC_wS]
      return getUniv2TokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_frxETH)) {
      const path = [SONIC_frxETH, SONIC_scETH, SONIC_wS]
      return getUniv2TokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_OS)) {
      const path = [SONIC_OS, SONIC_wS]
      return getUniv2TokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_SWPx)) {
      const path = [SONIC_SWPx, SONIC_wS]
      return getUniv2TokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_WBTC)) {
      const path = [SONIC_WBTC, SONIC_scBTC, SONIC_wS]
      return getUniv2TokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_bUSDCe20)) {
      const path = [SONIC_bUSDCe20, SONIC_scUSD, SONIC_OS, SONIC_wS]
      return getUniv2TokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_wstkscUSD)) {
      const path = [SONIC_wstkscUSD, SONIC_scUSD, SONIC_OS, SONIC_wS]
      return getUniv2TokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_scBTC)) {
      const path = [SONIC_scBTC, SONIC_wS]
      return getUniv2TokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_beSonic)) {
      const path = [SONIC_beSonic, SONIC_OS, SONIC_wS]
      return getUniv2TokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_stkscUSD)) {
      const path = [SONIC_stkscUSD, SONIC_scUSD, SONIC_OS, SONIC_wS]
      return getUniv2TokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_aSonUSDC)) {
      const path = [SONIC_aSonUSDC, SONIC_USDC, SONIC_OS, SONIC_wS]
      return getUniv2TokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_wmooSiloV2SonicUSDCe)) {
      return getBeefyClassicWrapperTokenToNativePrice(inputToken)
    }

    if (inputToken.id.equals(SONIC_GFI)) {
      // TODO: add gravity oracle: https://dexscreener.com/search?q=0xbf5899166ac476370b3117c9256b7fc45624f4ea
      log.info("TODO implement oracle for SONIC_GFI: {}", [inputToken.id.toHexString()])
      return ZERO_BI
    }

    if (inputToken.id.equals(SONIC_frxUSD)) {
      const path = [SONIC_frxUSD, SONIC_scUSD, SONIC_wS]
      return getUniv2TokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_Silo)) {
      const path = [SONIC_Silo, SONIC_OS, SONIC_wS]
      return getUniv2TokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    if (inputToken.id.equals(SONIC_EGGS)) {
      const path = [SONIC_EGGS, SONIC_OS, SONIC_wS]
      return getUniv2TokenToNativePrice(inputToken, SONIC_SWAPX_QUOTER_V2, path)
    }

    log.error("Unhandled oracle for token: {}", [inputToken.id.toHexString()])
    return ZERO_BI
  }

  return ZERO_BI
}
