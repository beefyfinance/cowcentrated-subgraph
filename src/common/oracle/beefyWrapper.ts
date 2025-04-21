import { Address, BigInt, log } from "@graphprotocol/graph-ts"
import { Classic, Token } from "../../../generated/schema"
import { ClassicErc4626Adapter as ClassicErc4626AdapterContract } from "../../../generated/templates/ClassicErc4626Adapter/ClassicErc4626Adapter"
import { exponentToBigInt, ZERO_BI } from "../utils/decimal"
import { fetchClassicData } from "../../classic/utils/classic-data"
import { getToken } from "../entity/token"
import { IERC20 as IERC20Contract } from "../../../generated/templates/ClmManager/IERC20"
export function getBeefyClassicWrapperTokenToNativePrice(inputToken: Token): BigInt {
  const wrapperAddress = Address.fromBytes(inputToken.id)
  const beetsWrapperContract = ClassicErc4626AdapterContract.bind(wrapperAddress)

  const vault = beetsWrapperContract.try_vault()
  if (vault.reverted) {
    return ZERO_BI
  }
  const vaultAddress = Address.fromBytes(vault.value)

  const classic = Classic.load(vaultAddress)
  if (!classic) {
    return ZERO_BI
  }

  const classicData = fetchClassicData(classic)

  const underlyingToken = getToken(classic.underlyingToken)
  const underlyingTokenPow = exponentToBigInt(underlyingToken.decimals)
  const sharesToken = getToken(classic.vaultSharesToken)
  const sharesTokenPow = exponentToBigInt(sharesToken.decimals)

  const totalNativeValue = classicData.underlyingAmount
    .times(classicData.underlyingToNativePrice)
    .div(underlyingTokenPow)

  const totalNativePerVaultShare = totalNativeValue.times(sharesTokenPow).div(classicData.vaultSharesTotalSupply)

  // the wrapper has 1-1 equivalence with the vault shares
  // but they might have different decimals
  const vaultContract = IERC20Contract.bind(vaultAddress)
  const wrapperVaultSharesBalanceResult = vaultContract.try_balanceOf(wrapperAddress)
  if (wrapperVaultSharesBalanceResult.reverted) {
    return ZERO_BI
  }
  const wrapperVaultSharesBalance = wrapperVaultSharesBalanceResult.value

  const totalNativeInWrapper = totalNativePerVaultShare.times(wrapperVaultSharesBalance).div(sharesTokenPow)

  const wrapperTotalSupplyResult = beetsWrapperContract.try_totalSupply()
  if (wrapperTotalSupplyResult.reverted) {
    return ZERO_BI
  }
  const wrapperTotalSupply = wrapperTotalSupplyResult.value

  const wrapperToken = getToken(wrapperAddress)
  const wrapperTokenPow = exponentToBigInt(wrapperToken.decimals)

  const nativePerWrapperToken = totalNativeInWrapper.times(wrapperTokenPow).div(wrapperTotalSupply)

  return nativePerWrapperToken
}
