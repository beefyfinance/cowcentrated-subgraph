import { Address, BigDecimal, Bytes, ethereum, log } from "@graphprotocol/graph-ts"
import { ClockTick, Investor, Token } from "../generated/schema"
import { DAY, MINUTES_15, getIntervalFromTimestamp } from "./utils/time"
import { getClockTickId } from "./entity/clock"
import { getBeefyCLProtocol, getBeefyCLProtocolSnapshot } from "./entity/protocol"
import { ZERO_BD, tokenAmountToDecimal } from "./utils/decimal"
import { getToken } from "./entity/token"
import { fetchCurrentPriceInToken1, fetchVaultPrices } from "./utils/price"
import { getBeefyCLVaultSnapshot, isVaultRunning } from "./entity/vault"
import { getInvestorPositionSnapshot } from "./entity/position"
import { getInvestorSnapshot } from "./entity/investor"
import { BeefyVaultConcLiq as BeefyCLVaultContract } from "../generated/templates/BeefyCLVault/BeefyVaultConcLiq"

export function handleClockTick(block: ethereum.Block): void {
  const timestamp = block.timestamp

  log.debug("handleClockTick: new tick detected: {}", [timestamp.toString()])

  let period = MINUTES_15
  let interval = getIntervalFromTimestamp(timestamp, period)
  let id = getClockTickId(timestamp, period)
  let tick = ClockTick.load(id)
  log.debug("handleClockTick: MINUTES_15 range {} (timestamp: {}, interval: {}, period: {}, id: {})", [
    tick ? "exists" : "new",
    timestamp.toString(),
    interval.toString(),
    period.toString(),
    id.toHexString(),
  ])
  if (!tick) {
    tick = new ClockTick(id)
    tick.timestamp = timestamp
    tick.period = period
    tick.roundedTimestamp = interval
    tick.save()

    handleNew15Minutes(tick)
  }

  period = DAY
  interval = getIntervalFromTimestamp(timestamp, period)
  id = getClockTickId(timestamp, period)
  tick = ClockTick.load(id)
  log.debug("handleClockTick: DAY range {} (timestamp: {}, interval: {}, period: {}, id: {})", [
    tick ? "exists" : "new",
    timestamp.toString(),
    interval.toString(),
    period.toString(),
    id.toHexString(),
  ])
  if (!tick) {
    tick = new ClockTick(id)
    tick.timestamp = timestamp
    tick.period = period
    tick.roundedTimestamp = interval
    tick.save()

    handleNewDay(tick)
  }
}

function handleNew15Minutes(tick: ClockTick): void {
  log.debug("handleNew15Minutes: new 15min range detected: {}", [tick.roundedTimestamp.toString()])

  const protocol = getBeefyCLProtocol()
  let protocolTotalValueLockedUSD = ZERO_BD
  let protocolActiveVaultCount = 0
  let protocolActiveInvestorCount = 0

  const vaults = protocol.vaults.load()
  const investorTVL = new Map<string, BigDecimal>()

  log.debug("handleNew15Minutes: fetching data for {} vaults", [vaults.length.toString()])

  for (let i = 0; i < vaults.length; i++) {
    const vault = vaults[i]
    if (!isVaultRunning(vault)) {
      log.debug("handleNew15Minutes: vault {} is not running", [vault.id.toHexString()])
      continue
    }

    const positions = vault.positions.load()
    const token0 = getToken(vault.underlyingToken0)
    const token1 = getToken(vault.underlyingToken1)

    ///////
    // fetch data on chain
    log.debug("handleNew15Minutes: fetching on chain data for vault {}", [vault.id.toHexString()])
    const vaultContract = BeefyCLVaultContract.bind(Address.fromBytes(vault.id))
    const vaultBalancesRes = vaultContract.try_balances()
    if (vaultBalancesRes.reverted) {
      log.error("updateUserPosition: balances() reverted for strategy {}", [vault.strategy.toHexString()])
      throw Error("updateUserPosition: balances() reverted")
    }
    const vaultBalanceUnderlying0 = tokenAmountToDecimal(vaultBalancesRes.value.value0, token0.decimals)
    const vaultBalanceUnderlying1 = tokenAmountToDecimal(vaultBalancesRes.value.value1, token1.decimals)
    const currentPriceInToken1 = fetchCurrentPriceInToken1(vault.strategy, false)
    const prices = fetchVaultPrices(vault, token0, token1)
    const token0PriceInNative = prices.token0ToNative
    const token1PriceInNative = prices.token1ToNative
    const nativePriceUSD = prices.nativeToUsd

    ///////
    // compute derived values
    log.debug("handleNew15Minutes: computing derived values for vault {}", [vault.id.toHexString()])
    const token0PriceInUSD = token0PriceInNative.times(nativePriceUSD)
    const token1PriceInUSD = token1PriceInNative.times(nativePriceUSD)

    //////
    // update latest vault usd values
    log.debug("handleNew15Minutes: updating vault usd values for vault {}", [vault.id.toHexString()])
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

    //////
    // keep track of protocol values
    protocolTotalValueLockedUSD = protocolTotalValueLockedUSD.plus(vault.totalValueLockedUSD)
    protocolActiveVaultCount = protocolActiveVaultCount + 1

    log.debug("handleNew15Minutes: updating {} positions for vault {}", [
      positions.length.toString(),
      vault.id.toHexString(),
    ])

    for (let j = 0; j < positions.length; j++) {
      const position = positions[j]
      if (position.sharesBalance.equals(ZERO_BD)) {
        log.debug("handleNew15Minutes: position {} has zero shares", [position.id.toHexString()])
        continue
      }

      const investor = Investor.load(position.investor)
      if (!investor) {
        log.error("handleNew15Minutes: investor {} not found", [position.investor.toHexString()])
        continue
      }

      //////
      // update position usd values
      log.debug("handleNew15Minutes: updating position usd values for position {}", [position.id.toHexString()])
      position.underlyingBalance0USD = position.underlyingBalance0.times(token0PriceInUSD)
      position.underlyingBalance1USD = position.underlyingBalance1.times(token1PriceInUSD)
      position.positionValueUSD = position.underlyingBalance0USD.plus(position.underlyingBalance1USD)
      position.save()

      // update investor tvl
      if (!investorTVL.has(investor.id.toHexString())) {
        investorTVL.set(investor.id.toHexString(), ZERO_BD)
      }
      let tvl = investorTVL.get(investor.id.toHexString())
      // @ts-ignore
      tvl = tvl.plus(position.positionValueUSD)
      investorTVL.set(investor.id.toHexString(), tvl)
    }
  }

  // update investor moving averages
  // @ts-ignore
  let investorIdStrings: Array<string> = investorTVL.keys()
  log.debug("handleNew15Minutes: updating investor moving averages for {} investors", [
    investorIdStrings.length.toString(),
  ])
  for (let i = 0; i < investorIdStrings.length; i++) {
    const investorIdStr = investorIdStrings[i]
    const id = Bytes.fromHexString(investorIdStr)
    const investor = Investor.load(id)
    if (!investor) {
      log.error("handleNew15Minutes: investor {} not found", [investorIdStr])
      continue
    }
    //////
    // keep track of protocol values
    protocolActiveInvestorCount = protocolActiveInvestorCount + 1

    // @ts-ignore
    const tvl: BigDecimal = investorTVL.get(investorIdStr)
    investor.totalPositionValueUSD = tvl
    investor.save()
  }

  ///////
  // update protocol values
  log.debug("handleNewDay: updating protocol values", [])
  protocol.totalValueLockedUSD = protocolTotalValueLockedUSD
  protocol.save()

  log.debug("handleNew15Minutes: done for {} vaults", [vaults.length.toString()])
}

function handleNewDay(tick: ClockTick): void {
  log.debug("handleNewDay: new day detected: {}", [tick.roundedTimestamp.toString()])

  const protocol = getBeefyCLProtocol()
  let protocolTotalValueLockedUSD = ZERO_BD
  let protocolActiveVaultCount = 0
  let protocolActiveInvestorCount = 0

  const vaults = protocol.vaults.load()
  const investorTVL = new Map<string, BigDecimal>()

  log.debug("handleNewDay: fetching data for {} vaults", [vaults.length.toString()])

  for (let i = 0; i < vaults.length; i++) {
    const vault = vaults[i]
    if (!isVaultRunning(vault)) {
      log.debug("handleNewDay: vault {} is not running", [vault.id.toHexString()])
      continue
    }

    const positions = vault.positions.load()
    const token0 = getToken(vault.underlyingToken0)
    const token1 = getToken(vault.underlyingToken1)

    ///////
    // fetch data on chain
    log.debug("handleNewDay: fetching on chain data for vault {}", [vault.id.toHexString()])
    const vaultContract = BeefyCLVaultContract.bind(Address.fromBytes(vault.id))
    const vaultBalancesRes = vaultContract.try_balances()
    if (vaultBalancesRes.reverted) {
      log.error("updateUserPosition: balances() reverted for strategy {}", [vault.strategy.toHexString()])
      throw Error("updateUserPosition: balances() reverted")
    }
    const vaultBalanceUnderlying0 = tokenAmountToDecimal(vaultBalancesRes.value.value0, token0.decimals)
    const vaultBalanceUnderlying1 = tokenAmountToDecimal(vaultBalancesRes.value.value1, token1.decimals)
    const currentPriceInToken1 = fetchCurrentPriceInToken1(vault.strategy, false)
    const prices = fetchVaultPrices(vault, token0, token1)
    const token0PriceInNative = prices.token0ToNative
    const token1PriceInNative = prices.token1ToNative
    const nativePriceUSD = prices.nativeToUsd

    ///////
    // compute derived values
    log.debug("handleNewDay: computing derived values for vault {}", [vault.id.toHexString()])
    const token0PriceInUSD = token0PriceInNative.times(nativePriceUSD)
    const token1PriceInUSD = token1PriceInNative.times(nativePriceUSD)

    //////
    // update vault usd values
    log.debug("handleNewDay: updating vault usd values for vault {}", [vault.id.toHexString()])
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
    // update vault snapshot
    const period = DAY
    log.debug("handleNewDay: updating vault snapshot for vault {} and period {}", [
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

    //////
    // keep track of protocol values
    protocolTotalValueLockedUSD = protocolTotalValueLockedUSD.plus(vault.totalValueLockedUSD)
    protocolActiveVaultCount = protocolActiveVaultCount + 1

    log.debug("handleNewDay: updating {} positions for vault {}", [positions.length.toString(), vault.id.toHexString()])

    for (let j = 0; j < positions.length; j++) {
      const position = positions[j]
      if (position.sharesBalance.equals(ZERO_BD)) {
        log.debug("handleNewDay: position {} has zero shares", [position.id.toHexString()])
        continue
      }

      const investor = Investor.load(position.investor)
      if (!investor) {
        log.error("handleNewDay: investor {} not found", [position.investor.toHexString()])
        continue
      }

      //////
      // update position usd values
      log.debug("handleNewDay: updating position usd values for position {}", [position.id.toHexString()])
      position.underlyingBalance0USD = position.underlyingBalance0.times(token0PriceInUSD)
      position.underlyingBalance1USD = position.underlyingBalance1.times(token1PriceInUSD)
      position.positionValueUSD = position.underlyingBalance0USD.plus(position.underlyingBalance1USD)
      let last30DailyPositionValuesUSD = position.last30DailyPositionValuesUSD // required by thegraph
      last30DailyPositionValuesUSD.push(position.positionValueUSD) // most recent value last
      while (last30DailyPositionValuesUSD.length > 30) {
        last30DailyPositionValuesUSD.shift() // remove oldest value
      }
      position.last30DailyPositionValuesUSD = last30DailyPositionValuesUSD
      position.averageDailyPositionValueUSD30D = last30DailyPositionValuesUSD
        .reduce<BigDecimal>((acc, val) => acc.plus(val), ZERO_BD)
        .div(BigDecimal.fromString(last30DailyPositionValuesUSD.length.toString()))
      position.save()
      // update position snapshot
      const period = DAY
      log.debug("handleNewDay: updating position snapshot for position {} and period {}", [
        position.id.toHexString(),
        period.toString(),
      ])
      const positionSnapshot = getInvestorPositionSnapshot(vault, investor, tick.timestamp, period)
      positionSnapshot.underlyingBalance0USD = position.underlyingBalance0USD
      positionSnapshot.underlyingBalance1USD = position.underlyingBalance1USD
      positionSnapshot.positionValueUSD = position.positionValueUSD
      positionSnapshot.save()

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
  log.debug("handleNewDay: updating investor moving averages for {} investors", [investorIdStrings.length.toString()])
  for (let i = 0; i < investorIdStrings.length; i++) {
    const investorIdStr = investorIdStrings[i]
    const id = Bytes.fromHexString(investorIdStr)
    const investor = Investor.load(id)
    if (!investor) {
      log.error("handleNewDay: investor {} not found", [investorIdStr])
      continue
    }
    //////
    // keep track of protocol values
    protocolActiveInvestorCount = protocolActiveInvestorCount + 1

    // @ts-ignore
    const tvl: BigDecimal = investorTVL.get(investorIdStr)
    investor.totalPositionValueUSD = tvl
    let last30DailyTotalPositionValuesUSD = investor.last30DailyTotalPositionValuesUSD
    last30DailyTotalPositionValuesUSD.push(tvl) // most recent value last
    while (last30DailyTotalPositionValuesUSD.length > 30) {
      last30DailyTotalPositionValuesUSD.shift() // remove oldest value
    }
    investor.last30DailyTotalPositionValuesUSD = last30DailyTotalPositionValuesUSD
    investor.averageDailyTotalPositionValueUSD30D = last30DailyTotalPositionValuesUSD
      .reduce<BigDecimal>((acc, val) => acc.plus(val), ZERO_BD)
      .div(BigDecimal.fromString(last30DailyTotalPositionValuesUSD.length.toString()))
    investor.save()
    const period = DAY
    log.debug("handleNewDay: updating investor snapshot for investor {} and period {}", [
      investor.id.toHexString(),
      period.toString(),
    ])
    const investorSnapshot = getInvestorSnapshot(investor, tick.timestamp, period)
    investorSnapshot.totalPositionValueUSD = tvl
    investorSnapshot.save()
  }

  ///////
  // update protocol values
  log.debug("handleNewDay: updating protocol values", [])
  protocol.totalValueLockedUSD = protocolTotalValueLockedUSD
  protocol.activeVaultCount = protocolActiveVaultCount
  protocol.activeInvestorCount = protocolActiveInvestorCount
  protocol.save()
  const period = DAY
  log.debug("handleNewDay: updating protocol snapshot for period {}", [period.toString()])
  const protocolSnapshot = getBeefyCLProtocolSnapshot(tick.timestamp, period)
  protocolSnapshot.totalValueLockedUSD = protocol.totalValueLockedUSD
  protocolSnapshot.activeVaultCount = protocol.activeVaultCount
  log.debug("handleNewDay: done for {} vaults", [vaults.length.toString()])
}
