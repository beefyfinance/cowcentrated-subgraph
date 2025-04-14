import { Address, BigInt } from "@graphprotocol/graph-ts"
import { Classic, Token } from "../../../generated/schema"
import { ClassicErc4626Adapter as ClassicErc4626AdapterContract } from "../../../generated/templates/ClassicErc4626Adapter/ClassicErc4626Adapter"
import { exponentToBigInt, ZERO_BI } from "../utils/decimal"
import { fetchClassicData } from "../../classic/utils/classic-data"
import { getToken } from "../entity/token"

export function getBeefyClassicWrapperTokenToNativePrice(inputToken: Token): BigInt {
  const beetsWrapperContract = ClassicErc4626AdapterContract.bind(Address.fromBytes(inputToken.id))

  const vault = beetsWrapperContract.try_vault()
  if (vault.reverted) {
    return ZERO_BI
  }

  const classic = Classic.load(vault.value)
  if (!classic) {
    return ZERO_BI
  }

  const classicData = fetchClassicData(classic)

  const underlyingToken = getToken(classic.underlyingToken)
  const underlyingTokenPow = exponentToBigInt(underlyingToken.decimals)
  const sharesToken = getToken(classic.vaultSharesToken)
  const sharesTokenPow = exponentToBigInt(sharesToken.decimals)

  const totalNativeValue = classicData.vaultUnderlyingTotalSupply
    .times(classicData.underlyingToNativePrice)
    .div(underlyingTokenPow)
  const nativePerToken = totalNativeValue.times(sharesTokenPow).div(classicData.vaultSharesTotalSupply)

  return nativePerToken
}
