import { describe, expect, it } from 'vitest'
import type { HabitLog } from '../../../types/domain.ts'
import {
  formatReadingDuration,
  selectCanonicalHabitLogs,
  sumHabitLogs,
} from './koreaderStats.ts'

function makeLog(overrides: Partial<HabitLog>): HabitLog {
  return {
    createdAt: '2026-09-01T10:00:00.000Z',
    externalId: null,
    habitId: '11111111-1111-4111-8111-111111111111',
    id: crypto.randomUUID(),
    koreaderLinkId: null,
    localDate: '2026-09-01',
    ownerId: '22222222-2222-4222-8222-222222222222',
    source: 'manual',
    status: 'completed',
    updatedAt: '2026-09-01T10:00:00.000Z',
    value: 1,
    ...overrides,
  }
}

describe('koreader habit statistics', () => {
  it('uses the imported row instead of a manual row on the same date', () => {
    const logs = selectCanonicalHabitLogs([
      makeLog({ id: 'manual', value: 10 }),
      makeLog({
        externalId: 'link:2026-09-01',
        id: 'imported',
        koreaderLinkId: 'link',
        source: 'koreader',
        updatedAt: '2026-09-01T09:00:00.000Z',
        value: 20,
      }),
    ])

    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ id: 'imported', value: 20 })
  })

  it('keeps the latest manual value when no import exists', () => {
    const logs = selectCanonicalHabitLogs([
      makeLog({ id: 'old', updatedAt: '2026-09-01T09:00:00.000Z', value: 2 }),
      makeLog({ id: 'new', updatedAt: '2026-09-01T11:00:00.000Z', value: 5 }),
    ])

    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ id: 'new', value: 5 })
  })

  it('sums daily canonical values and formats reading time', () => {
    const logs = [
      makeLog({ localDate: '2026-09-01', value: 30 }),
      makeLog({ localDate: '2026-09-02', value: 90 }),
    ]

    expect(sumHabitLogs(logs, '2026-09-01', '2026-09-02')).toBe(120)
    expect(formatReadingDuration(120)).toBe('2 h')
    expect(formatReadingDuration(95)).toBe('1 h 35 min')
  })
})
