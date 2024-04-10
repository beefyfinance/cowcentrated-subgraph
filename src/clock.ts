import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts"
import { ClockTick, Investor } from "../generated/schema"
import { DAY, MINUTES_15, SNAPSHOT_PERIODS } from "./utils/time"
import { getClockTick } from "./entity/clock"
import { getBeefyCLProtocol, getBeefyCLProtocolSnapshot } from "./entity/protocol"
import { ZERO_BD, tokenAmountToDecimal } from "./utils/decimal"
import { getToken } from "./entity/token"
import { fetchCurrentPriceInToken1, fetchVaultPrices } from "./utils/price"
import { getBeefyCLStrategy, getBeefyCLVaultSnapshot, isVaultRunning } from "./entity/vault"
import { getInvestorPositionSnapshot } from "./entity/position"
import { getInvestorSnapshot } from "./entity/investor"
import { BeefyVaultConcLiq as BeefyCLVaultContract } from "../generated/templates/BeefyCLVault/BeefyVaultConcLiq"
import { DailyAvgCalc, DailyAvgState } from "./utils/daily-avg"

export function handleClockTick(block: ethereum.Block): void {
  const timestamp = block.timestamp

  let tickRes15min = getClockTick(timestamp, MINUTES_15)
  if (!tickRes15min.isNew) {
    log.debug("handleClockTick: tick already exists for 15 minutes period", [])
    return
  }
  tickRes15min.tick.save()

  let tickResDay = getClockTick(timestamp, DAY)
  tickResDay.tick.save()

  updateDataOnClockTick(tickRes15min.tick, tickResDay.isNew)
}

function updateDataOnClockTick(tick: ClockTick, isNewDay: boolean): void {
  log.debug("updateDataOnClockTick: processing new tick: {}", [tick.roundedTimestamp.toString()])

  const periods = SNAPSHOT_PERIODS
  const protocol = getBeefyCLProtocol()
  let protocolTotalValueLockedUSD = ZERO_BD
  let protocolActiveVaultCount = 0
  let protocolActiveInvestorCount = 0

  const vaults = protocol.vaults.load()
  const investorTVL = new Map<string, BigDecimal>()

  log.debug("updateDataOnClockTick: fetching data for {} vaults", [vaults.length.toString()])

  for (let i = 0; i < vaults.length; i++) {
    const vault = vaults[i]
    if (!isVaultRunning(vault)) {
      log.debug("updateDataOnClockTick: vault {} is not running", [vault.id.toHexString()])
      continue
    }

    const strategy = getBeefyCLStrategy(vault.strategy)
    const positions = vault.positions.load()
    const token0 = getToken(vault.underlyingToken0)
    const token1 = getToken(vault.underlyingToken1)
    const earnedToken = getToken(vault.earnedToken)

    ///////
    // fetch data on chain
    log.debug("updateDataOnClockTick: fetching on chain data for vault {}", [vault.id.toHexString()])
    const vaultContract = BeefyCLVaultContract.bind(Address.fromBytes(vault.id))
    const vaultBalancesRes = vaultContract.try_balances()
    if (vaultBalancesRes.reverted) {
      log.error("handleNew15Minutes: balances() reverted for strategy {}", [vault.strategy.toHexString()])
      throw Error("handleNew15Minutes: balances() reverted")
    }
    const vaultBalanceUnderlying0 = tokenAmountToDecimal(vaultBalancesRes.value.value0, token0.decimals)
    const vaultBalanceUnderlying1 = tokenAmountToDecimal(vaultBalancesRes.value.value1, token1.decimals)
    const currentPriceInToken1 = fetchCurrentPriceInToken1(vault.strategy, false)
    const prices = fetchVaultPrices(vault, strategy, token0, token1, earnedToken)
    const token0PriceInNative = prices.token0ToNative
    const token1PriceInNative = prices.token1ToNative
    const nativePriceUSD = prices.nativeToUsd

    ///////
    // compute derived values
    log.debug("updateDataOnClockTick: computing derived values for vault {}", [vault.id.toHexString()])
    const token0PriceInUSD = token0PriceInNative.times(nativePriceUSD)
    const token1PriceInUSD = token1PriceInNative.times(nativePriceUSD)

    //////
    // update vault usd values
    log.debug("updateDataOnClockTick: updating vault usd values for vault {}", [vault.id.toHexString()])
    vault.currentPriceOfToken0InToken1 = currentPriceInToken1
    vault.currentPriceOfToken0InUSD = token0PriceInUSD
    vault.priceRangeMinUSD = vault.priceRangeMin1.times(token1PriceInUSD)
    vault.priceRangeMaxUSD = vault.priceRangeMax1.times(token1PriceInUSD)
    vault.underlyingAmount0 = vaultBalanceUnderlying0
    vault.underlyingAmount1 = vaultBalanceUnderlying1
    vault.underlyingAmount0USD = vault.underlyingAmount0.times(token0PriceInUSD)
    vault.underlyingAmount1USD = vault.underlyingAmount1.times(token1PriceInUSD)
    vault.totalValueLockedUSD = vault.underlyingAmount0USD.plus(vault.underlyingAmount1USD)
    vault.save()
    // update vault snapshots
    for (let j = 0; j < periods.length; j++) {
      const period = periods[j]
      log.debug("updateDataOnClockTick: updating vault snapshot for vault {} and period {}", [
        vault.id.toHexString(),
        period.toString(),
      ])
      const vaultSnapshot = getBeefyCLVaultSnapshot(vault, tick.timestamp, period)
      vaultSnapshot.currentPriceOfToken0InToken1 = vault.currentPriceOfToken0InToken1
      vaultSnapshot.currentPriceOfToken0InUSD = vault.currentPriceOfToken0InUSD
      vaultSnapshot.priceRangeMinUSD = vault.priceRangeMinUSD
      vaultSnapshot.priceRangeMaxUSD = vault.priceRangeMaxUSD
      vaultSnapshot.underlyingAmount0 = vault.underlyingAmount0
      vaultSnapshot.underlyingAmount1 = vault.underlyingAmount1
      vaultSnapshot.underlyingAmount0USD = vault.underlyingAmount0USD
      vaultSnapshot.underlyingAmount1USD = vault.underlyingAmount1USD
      vaultSnapshot.totalValueLockedUSD = vault.totalValueLockedUSD
      vaultSnapshot.save()
    }

    //////
    // keep track of protocol values
    log.debug("handleNew15Minutes: updating protocol values for vault {}, contributing TVL {}", [
      vault.id.toHexString(),
      vault.totalValueLockedUSD.toString(),
    ])
    protocolTotalValueLockedUSD = protocolTotalValueLockedUSD.plus(vault.totalValueLockedUSD)
    protocolActiveVaultCount = protocolActiveVaultCount + 1

    log.debug("updateDataOnClockTick: updating {} positions for vault {}", [
      positions.length.toString(),
      vault.id.toHexString(),
    ])

    for (let j = 0; j < positions.length; j++) {
      const position = positions[j]
      if (position.sharesBalance.equals(ZERO_BD)) {
        log.debug("updateDataOnClockTick: position {} has zero shares", [position.id.toHexString()])
        continue
      }

      const investor = Investor.load(position.investor)
      if (!investor) {
        log.error("updateDataOnClockTick: investor {} not found", [position.investor.toHexString()])
        continue
      }

      //////
      // update position usd values
      log.debug("updateDataOnClockTick: updating position usd values for position {}", [position.id.toHexString()])
      position.underlyingBalance0USD = position.underlyingBalance0.times(token0PriceInUSD)
      position.underlyingBalance1USD = position.underlyingBalance1.times(token1PriceInUSD)
      position.positionValueUSD = position.underlyingBalance0USD.plus(position.underlyingBalance1USD)
      let state = DailyAvgState.deserialize(position.averageDailyPositionValueUSDState)
      if (isNewDay) {
        state.addValue(position.positionValueUSD)
        state.resetPendingValue()
      } else {
        state.updatePendingValueTimestamp(tick.timestamp)
      }
      position.averageDailyPositionValueUSD30D = DailyAvgCalc.avg(DAY.times(BigInt.fromU32(30)), state)
      position.averageDailyPositionValueUSDState = state.serialize()
      position.save()
      // update position snapshot
      for (let k = 0; k < periods.length; k++) {
        const period = periods[k]
        log.debug("updateDataOnClockTick: updating position snapshot for position {} and period {}", [
          position.id.toHexString(),
          period.toString(),
        ])
        const positionSnapshot = getInvestorPositionSnapshot(vault, investor, tick.timestamp, period)
        positionSnapshot.underlyingBalance0USD = position.underlyingBalance0USD
        positionSnapshot.underlyingBalance1USD = position.underlyingBalance1USD
        positionSnapshot.positionValueUSD = position.positionValueUSD
        positionSnapshot.save()
      }

      if (!investorTVL.has(investor.id.toHexString())) {
        investorTVL.set(investor.id.toHexString(), ZERO_BD)
      }
      let tvl = investorTVL.get(investor.id.toHexString())
      // @ts-ignore
      tvl = tvl.plus(position.positionValueUSD)
      investorTVL.set(investor.id.toHexString(), tvl)
    }
  }

  // @ts-ignore
  let investorIdStrings: Array<string> = investorTVL.keys()

  // update investor moving averages
  log.debug("updateDataOnClockTick: updating investor moving averages for {} investors", [
    investorIdStrings.length.toString(),
  ])
  for (let i = 0; i < investorIdStrings.length; i++) {
    const investorIdStr = investorIdStrings[i]
    const id = Bytes.fromHexString(investorIdStr)
    const investor = Investor.load(id)
    if (!investor) {
      log.error("updateDataOnClockTick: investor {} not found", [investorIdStr])
      continue
    }
    //////
    // keep track of protocol values
    protocolActiveInvestorCount = protocolActiveInvestorCount + 1

    // @ts-ignore
    const tvl: BigDecimal = investorTVL.get(investorIdStr)
    investor.totalPositionValueUSD = tvl

    let state = DailyAvgState.deserialize(investor.averageDailyTotalPositionValueUSDState)
    if (isNewDay) {
      state.addValue(tvl)
      state.resetPendingValue()
    } else {
      state.updatePendingValueTimestamp(tick.timestamp)
    }
    investor.averageDailyTotalPositionValueUSD30D = DailyAvgCalc.avg(DAY.times(BigInt.fromU32(30)), state)
    investor.averageDailyTotalPositionValueUSDState = state.serialize()
    investor.save()
    for (let j = 0; j < periods.length; j++) {
      const period = periods[j]
      log.debug("updateDataOnClockTick: updating investor snapshot for investor {} and period {}", [
        investor.id.toHexString(),
        period.toString(),
      ])
      const investorSnapshot = getInvestorSnapshot(investor, tick.timestamp, period)
      investorSnapshot.totalPositionValueUSD = tvl
      investorSnapshot.save()
    }
  }

  ///////
  // update protocol values
  log.debug("updateDataOnClockTick: updating protocol values", [])
  protocol.totalValueLockedUSD = protocolTotalValueLockedUSD
  protocol.activeVaultCount = protocolActiveVaultCount
  protocol.activeInvestorCount = protocolActiveInvestorCount
  protocol.save()
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]
    log.debug("updateDataOnClockTick: updating protocol snapshot for period {}", [period.toString()])
    const protocolSnapshot = getBeefyCLProtocolSnapshot(tick.timestamp, period)
    protocolSnapshot.totalValueLockedUSD = protocol.totalValueLockedUSD
    protocolSnapshot.activeVaultCount = protocol.activeVaultCount
  }

  log.debug("updateDataOnClockTick: done for {} vaults", [vaults.length.toString()])
}
