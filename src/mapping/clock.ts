import { log } from '@graphprotocol/graph-ts'
import { ClockTick } from '../../generated/schema'
import { NewRound as ClockTickEvent } from '../../generated/templates/BeefyCLStrategy/ChainLinkPriceFeed'
import { DAY, MINUTES_15, getIntervalFromTimestamp } from '../utils/time'
import { getClockTickId } from '../entity/clock'

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

export function handleNewDay(event: ClockTick): void {
  log.warning('Clock tick detected: DAY: {}', [event.roundedTimestamp.toString()])
}

export function handleNew15Minutes(event: ClockTick): void {
  log.warning('Clock tick detected: MINUTES_15: {}', [event.roundedTimestamp.toString()])
}
