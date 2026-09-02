import { describe, expect, it } from 'vitest'
import {
  getDateKeyInTimeZone,
  getLocalDateKey,
  localDateStartToIso,
  shiftDateKey,
  utcDateStartToIso,
} from './dateUtils.ts'

describe('calendar date utilities', () => {
  it('keeps all-day values as local calendar dates', () => {
    expect(getLocalDateKey('2026-08-30', true)).toBe('2026-08-30')
  })

  it('groups timed values using the requested user timezone', () => {
    const value = '2026-08-31T02:30:00.000Z'

    expect(getDateKeyInTimeZone(value, 'America/Santiago')).toBe('2026-08-30')
    expect(getDateKeyInTimeZone(value, 'Asia/Tokyo')).toBe('2026-08-31')
  })

  it('shifts dates without crossing month or year boundaries incorrectly', () => {
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDateKey('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('creates explicit local and UTC query boundaries', () => {
    expect(localDateStartToIso('2026-08-30')).toBe(new Date(2026, 7, 30).toISOString())
    expect(utcDateStartToIso('2026-08-30')).toBe('2026-08-30T00:00:00.000Z')
  })
})
