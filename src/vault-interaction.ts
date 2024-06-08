import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts"
import { Transfer as VaultShareTransferEvent } from "../generated/templates/BeefyCLVault/BeefyVaultConcLiq"
import { Transfer as RewardPoolTransferEvent } from "../generated/templates/BeefyCLRewardPool/BeefyRewardPool"
import {
  getBeefyCLRewardPool,
  getBeefyCLStrategy,
  getBeefyCLVault,
  getBeefyCLVaultSnapshot,
  isVaultInitialized,
} from "./entity/vault"
import { getTransaction } from "./entity/transaction"
import { getInvestor } from "./entity/investor"
import { ZERO_BI } from "./utils/decimal"
import { VAULT_SNAPSHOT_PERIODS } from "./utils/time"
import { getToken } from "./entity/token"
import { getInvestorPosition } from "./entity/position"
import { fetchVaultLatestData } from "./utils/vault-data"
import { BeefyCLVault, InvestorPositionInteraction } from "../generated/schema"
import { getEventIdentifier } from "./utils/event"
import { SHARE_TOKEN_MINT_ADDRESS } from "./config"

export function handleClmVaultTransfer(event: VaultShareTransferEvent): void {
  // sending to self
  if (event.params.from.equals(event.params.to)) {
    return
  }

  // transfering nothing
  if (event.params.value.equals(ZERO_BI)) {
    return
  }

  const vault = getBeefyCLVault(event.address)

  // don't store transfers to/from the share token mint address
  if (!event.params.from.equals(SHARE_TOKEN_MINT_ADDRESS)) {
    updateUserPosition(vault, event, event.params.from, event.params.value.neg(), ZERO_BI)
  }

  if (!event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS)) {
    updateUserPosition(vault, event, event.params.to, event.params.value, ZERO_BI)
  }
}

export function handleRewardPoolTransfer(event: RewardPoolTransferEvent): void {
  // sending to self
  if (event.params.from.equals(event.params.to)) {
    return
  }

  // transfering nothing
  if (event.params.value.equals(ZERO_BI)) {
    return
  }

  const rewardPool = getBeefyCLRewardPool(event.address)
  const vault = getBeefyCLVault(rewardPool.vault)

  // don't store transfers to/from the share token mint address
  if (!event.params.from.equals(SHARE_TOKEN_MINT_ADDRESS) && !event.params.from.equals(rewardPool.id)) {
    updateUserPosition(vault, event, event.params.from, ZERO_BI, event.params.value.neg())
  }

  if (!event.params.to.equals(SHARE_TOKEN_MINT_ADDRESS) && !event.params.to.equals(rewardPool.id)) {
    updateUserPosition(vault, event, event.params.to, ZERO_BI, event.params.value)
  }
}

function updateUserPosition(
  vault: BeefyCLVault,
  event: ethereum.Event,
  investorAddress: Address,
  sharesDelta: BigInt,
  rewardPoolDelta: BigInt,
): void {
  if (!isVaultInitialized(vault)) {
    return
  }

  const strategy = getBeefyCLStrategy(vault.strategy)
  const sharesToken = getToken(vault.sharesToken)
  const rewardPoolToken = getToken(vault.rewardPoolToken)
  const token0 = getToken(vault.underlyingToken0)
  const token1 = getToken(vault.underlyingToken1)
  const investor = getInvestor(investorAddress)
  const position = getInvestorPosition(vault, investor)

  let tx = getTransaction(event.block, event.transaction)
  tx.save()

  ///////
  // fetch data on chain
  const vaultData = fetchVaultLatestData(vault, strategy, sharesToken, rewardPoolToken, token0, token1)

  ///////
  // update vault data
  vault.totalSupply = vaultData.sharesTotalSupply
  vault.rewardPoolTotalSupply = vaultData.rewardPoolTotalSupply
  vault.token0ToNativePrice = vaultData.token0ToNativePrice
  vault.token1ToNativePrice = vaultData.token1ToNativePrice
  vault.nativeToUSDPrice = vaultData.nativeToUSDPrice
  vault.priceOfToken0InToken1 = vaultData.priceOfToken0InToken1
  vault.priceRangeMin1 = vaultData.priceRangeMin1
  vault.priceRangeMax1 = vaultData.priceRangeMax1
  vault.underlyingMainAmount0 = vaultData.token0PositionMainBalance
  vault.underlyingMainAmount1 = vaultData.token1PositionMainBalance
  vault.underlyingAltAmount0 = vaultData.token0PositionAltBalance
  vault.underlyingAltAmount1 = vaultData.token1PositionAltBalance
  vault.save()
  for (let i = 0; i < VAULT_SNAPSHOT_PERIODS.length; i++) {
    const period = VAULT_SNAPSHOT_PERIODS[i]
    const snapshot = getBeefyCLVaultSnapshot(vault, event.block.timestamp, period)
    snapshot.totalSupply = vault.totalSupply
    snapshot.rewardPoolTotalSupply = vault.rewardPoolTotalSupply
    snapshot.token0ToNativePrice = vault.token0ToNativePrice
    snapshot.token1ToNativePrice = vault.token1ToNativePrice
    snapshot.nativeToUSDPrice = vault.nativeToUSDPrice
    snapshot.priceOfToken0InToken1 = vault.priceOfToken0InToken1
    snapshot.priceRangeMin1 = vault.priceRangeMin1
    snapshot.priceRangeMax1 = vault.priceRangeMax1
    snapshot.underlyingMainAmount0 = vault.underlyingMainAmount0
    snapshot.underlyingMainAmount1 = vault.underlyingMainAmount1
    snapshot.underlyingAltAmount0 = vault.underlyingAltAmount0
    snapshot.underlyingAltAmount1 = vault.underlyingAltAmount1
    snapshot.save()
  }

  ///////
  // investor
  investor.save()

  ///////
  // investor position
  if (position.sharesBalance.equals(ZERO_BI) && position.rewardPoolBalance.equals(ZERO_BI)) {
    position.createdWith = event.transaction.hash
  }
  position.sharesBalance = position.sharesBalance.plus(sharesDelta)
  position.rewardPoolBalance = position.rewardPoolBalance.plus(rewardPoolDelta)
  position.save()

  ///////
  // interaction
  const isSharesTransfer = !sharesDelta.equals(ZERO_BI)
  const isRewardPoolTransfer = !rewardPoolDelta.equals(ZERO_BI)

  // if both shares and reward pool are transferred, we need to create two interactions
  let interactionId = investor.id.concat(getEventIdentifier(event))
  if (isSharesTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(0))
  } else if (isRewardPoolTransfer) {
    interactionId = interactionId.concat(Bytes.fromI32(1))
  }
  const interaction = new InvestorPositionInteraction(interactionId)
  interaction.vault = vault.id
  interaction.investor = investor.id
  interaction.investorPosition = position.id
  interaction.createdWith = event.transaction.hash
  interaction.blockNumber = event.block.number
  interaction.timestamp = event.block.timestamp
  if (isSharesTransfer) {
    interaction.type = sharesDelta.gt(ZERO_BI) ? "VAULT_DEPOSIT" : "VAULT_WITHDRAW"
  } else if (isRewardPoolTransfer) {
    interaction.type = rewardPoolDelta.gt(ZERO_BI) ? "REWARD_POOL_STAKE" : "REWARD_POOL_UNSTAKE"
  }
  interaction.sharesBalance = position.sharesBalance
  interaction.rewardPoolBalance = position.rewardPoolBalance
  interaction.sharesBalanceDelta = sharesDelta
  interaction.rewardPoolBalanceDelta = rewardPoolDelta

  interaction.underlyingBalance0 = ZERO_BI
  interaction.underlyingBalance1 = ZERO_BI
  interaction.underlyingBalance0Delta = ZERO_BI
  interaction.underlyingBalance1Delta = ZERO_BI
  if (!vaultData.sharesTotalSupply.equals(ZERO_BI)) {
    interaction.underlyingBalance0 = interaction.underlyingBalance0.plus(
      vaultData.token0Balance.times(position.sharesBalance).div(vaultData.sharesTotalSupply),
    )
    interaction.underlyingBalance1 = interaction.underlyingBalance1.plus(
      vaultData.token1Balance.times(position.sharesBalance).div(vaultData.sharesTotalSupply),
    )
    interaction.underlyingBalance0Delta = interaction.underlyingBalance0Delta.plus(
      vaultData.token0Balance.times(sharesDelta).div(vaultData.sharesTotalSupply),
    )
    interaction.underlyingBalance1Delta = interaction.underlyingBalance1Delta.plus(
      vaultData.token1Balance.times(sharesDelta).div(vaultData.sharesTotalSupply),
    )
  }
  if (!vaultData.rewardPoolTotalSupply.equals(ZERO_BI)) {
    interaction.underlyingBalance0 = interaction.underlyingBalance0.plus(
      vaultData.token0Balance.times(position.rewardPoolBalance).div(vaultData.rewardPoolTotalSupply),
    )
    interaction.underlyingBalance1 = interaction.underlyingBalance1.plus(
      vaultData.token1Balance.times(position.rewardPoolBalance).div(vaultData.rewardPoolTotalSupply),
    )
    interaction.underlyingBalance0Delta = interaction.underlyingBalance0Delta.plus(
      vaultData.token0Balance.times(rewardPoolDelta).div(vaultData.rewardPoolTotalSupply),
    )
    interaction.underlyingBalance1Delta = interaction.underlyingBalance1Delta.plus(
      vaultData.token1Balance.times(rewardPoolDelta).div(vaultData.rewardPoolTotalSupply),
    )
  }
  interaction.token0ToNativePrice = vaultData.token0ToNativePrice
  interaction.token1ToNativePrice = vaultData.token1ToNativePrice
  interaction.nativeToUSDPrice = vaultData.nativeToUSDPrice
  interaction.save()
}
