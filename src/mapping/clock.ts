import { Address, BigDecimal, Bytes, log } from '@graphprotocol/graph-ts'
import { ClockTick, Investor, Token } from '../../generated/schema'
import { NewRound as ClockTickEvent } from '../../generated/templates/BeefyCLStrategy/ChainLinkPriceFeed'
import { DAY, MINUTES_15, getIntervalFromTimestamp } from '../utils/time'
import { getClockTickId } from '../entity/clock'
import { getBeefyCLProtocol } from '../entity/protocol'
import { ZERO_BD } from '../utils/decimal'
import { getToken } from '../entity/token'
import { sqrtPriceX96ToPriceInToken1 } from '../utils/uniswap'
import { StrategyPassiveManagerUniswap as BeefyCLStrategyContract } from '../../generated/templates/BeefyCLStrategy/StrategyPassiveManagerUniswap'
import { getVaultPrices } from './price'
import { getBeefyCLVaultSnapshot } from '../entity/vault'
import { getInvestorPositionSnapshot } from '../entity/position'

export function handleClockTick(event: ClockTickEvent): void {
  const timestamp = event.block.timestamp

  let period = MINUTES_15
  let interval = getIntervalFromTimestamp(timestamp, period)
  let id = getClockTickId(timestamp, period)
  let tick = ClockTick.load(id)
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
  if (!tick) {
    tick = new ClockTick(id)
    tick.timestamp = timestamp
    tick.period = period
    tick.roundedTimestamp = interval
    tick.save()

    handleNewDay(tick)
  }
}
export function handleNew15Minutes(tick: ClockTick): void {
  log.debug('Clock tick detected: MINUTES_15: {}', [tick.roundedTimestamp.toString()])

  const protocol = getBeefyCLProtocol()
  const vaults = protocol.vaults.load()
  const investorTVL = new Map<string, BigDecimal>()

  for (let i = 0; i < vaults.length; i++) {
    const vault = vaults[i]
    const positions = vault.positions.load()

    const token0 = getToken(vault.underlyingToken0)
    const token1 = getToken(vault.underlyingToken1)

    ///////
    // fetch data on chain
    const currentPriceInToken1 = getCurrentPriceInToken1(vault.strategy, token0, token1)
    const prices = getVaultPrices(vault, token0, token1)
    const token0PriceInNative = prices.token0ToNative
    const token1PriceInNative = prices.token1ToNative
    const nativePriceUSD = prices.nativeToUsd

    ///////
    // compute derived values
    log.debug('handleNewDay: computing derived values for vault {}', [vault.id.toHexString()])
    const token0PriceInUSD = token0PriceInNative.times(nativePriceUSD)
    const token1PriceInUSD = token1PriceInNative.times(nativePriceUSD)

    //////
    // update latest vault usd values
    vault.currentPriceOfToken0InToken1 = currentPriceInToken1
    vault.priceRangeMin1USD = vault.priceRangeMin1.times(token1PriceInUSD)
    vault.priceRangeMax1USD = vault.priceRangeMax1.times(token1PriceInUSD)
    vault.underlyingAmount0USD = vault.underlyingAmount0.times(token0PriceInUSD)
    vault.underlyingAmount1USD = vault.underlyingAmount1.times(token1PriceInUSD)
    vault.totalValueLockedUSD = vault.underlyingAmount0USD.plus(vault.underlyingAmount1USD)
    vault.save()

    for (let j = 0; j < positions.length; j++) {
      const position = positions[j]
      if (position.sharesBalance.equals(ZERO_BD)) {
        continue
      }

      const investor = Investor.load(position.investor)
      if (!investor) {
        log.error('handleNewDay: investor {} not found', [position.investor.toHexString()])
        continue
      }

      //////
      // update position usd values
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
  for (let i = 0; i < investorIdStrings.length; i++) {
    const investorIdStr = investorIdStrings[i]
    const id = Bytes.fromHexString(investorIdStr)
    const investor = Investor.load(id)
    if (!investor) {
      log.error('handleNewDay: investor {} not found', [investorIdStr])
      continue
    }
    const tvl = investorTVL.get(investorIdStr)
    if (!tvl) {
      log.error('handleNewDay: tvl not found for investor {}', [investorIdStr])
      continue
    }
    investor.totalPositionValueUSD = tvl
    investor.save()
  }
}

export function handleNewDay(tick: ClockTick): void {
  log.debug('Clock tick detected: DAY: {}', [tick.roundedTimestamp.toString()])

  const protocol = getBeefyCLProtocol()
  const vaults = protocol.vaults.load()
  const investorTVL = new Map<string, BigDecimal>()

  for (let i = 0; i < vaults.length; i++) {
    const vault = vaults[i]
    const positions = vault.positions.load()

    const token0 = getToken(vault.underlyingToken0)
    const token1 = getToken(vault.underlyingToken1)

    ///////
    // fetch data on chain
    const currentPriceInToken1 = getCurrentPriceInToken1(vault.strategy, token0, token1)
    const prices = getVaultPrices(vault, token0, token1)
    const token0PriceInNative = prices.token0ToNative
    const token1PriceInNative = prices.token1ToNative
    const nativePriceUSD = prices.nativeToUsd

    ///////
    // compute derived values
    log.debug('handleNewDay: computing derived values for vault {}', [vault.id.toHexString()])
    const token0PriceInUSD = token0PriceInNative.times(nativePriceUSD)
    const token1PriceInUSD = token1PriceInNative.times(nativePriceUSD)

    //////
    // update vault usd values
    vault.currentPriceOfToken0InToken1 = currentPriceInToken1
    vault.priceRangeMin1USD = vault.priceRangeMin1.times(token1PriceInUSD)
    vault.priceRangeMax1USD = vault.priceRangeMax1.times(token1PriceInUSD)
    vault.underlyingAmount0USD = vault.underlyingAmount0.times(token0PriceInUSD)
    vault.underlyingAmount1USD = vault.underlyingAmount1.times(token1PriceInUSD)
    vault.totalValueLockedUSD = vault.underlyingAmount0USD.plus(vault.underlyingAmount1USD)
    vault.save()
    // update vault snapshot
    const period = DAY
    log.debug('handleNewDay: updating vault snapshot for vault {} and period {}', [
      vault.id.toHexString(),
      period.toString(),
    ])
    const vaultSnapshot = getBeefyCLVaultSnapshot(vault, tick.timestamp, period)
    vaultSnapshot.currentPriceOfToken0InToken1 = vault.currentPriceOfToken0InToken1
    vaultSnapshot.priceRangeMin1USD = vault.priceRangeMax1USD
    vaultSnapshot.priceRangeMax1USD = vault.priceRangeMax1USD
    vaultSnapshot.underlyingAmount0USD = vault.underlyingAmount0USD
    vaultSnapshot.underlyingAmount1USD = vault.underlyingAmount1USD
    vaultSnapshot.totalValueLockedUSD = vault.totalValueLockedUSD
    vaultSnapshot.save()

    for (let j = 0; j < positions.length; j++) {
      const position = positions[j]
      if (position.sharesBalance.equals(ZERO_BD)) {
        continue
      }

      const investor = Investor.load(position.investor)
      if (!investor) {
        log.error('handleNewDay: investor {} not found', [position.investor.toHexString()])
        continue
      }

      //////
      // update position usd values
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
      log.debug('handleNewDay: updating position snapshot for position {} and period {}', [
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

  // update investor moving averages
  // @ts-ignore
  let investorIdStrings: Array<string> = investorTVL.keys()
  for (let i = 0; i < investorIdStrings.length; i++) {
    const investorIdStr = investorIdStrings[i]
    const id = Bytes.fromHexString(investorIdStr)
    const investor = Investor.load(id)
    if (!investor) {
      log.error('handleNewDay: investor {} not found', [investorIdStr])
      continue
    }
    const tvl = investorTVL.get(investorIdStr)
    if (!tvl) {
      log.error('handleNewDay: tvl not found for investor {}', [investorIdStr])
      continue
    }
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
  }
}

function getCurrentPriceInToken1(strategyAddress: Bytes, token0: Token, token1: Token): BigDecimal {
  log.debug('handleNewDay: fetching data for strategy {}', [strategyAddress.toHexString()])
  const strategyContract = BeefyCLStrategyContract.bind(Address.fromBytes(strategyAddress))
  const sqrtPriceRes = strategyContract.try_price() // TODO: replace with "try_sqrtPrice()" when new strats are deployed
  if (sqrtPriceRes.reverted) {
    log.error('handleNewDay: price() reverted for strategy {}', [strategyAddress.toHexString()])
    throw Error('handleNewDay: price() reverted')
  }
  return sqrtPriceX96ToPriceInToken1(sqrtPriceRes.value, token0, token1)
}
