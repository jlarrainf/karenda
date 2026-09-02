import { describe, expect, it } from 'vitest'
import {
  habitInputSchema,
  habitLogInputSchema,
  habitScheduleSchema,
  recurringTaskInputSchema,
} from './habitValidation.ts'

const habitBase = {
  goalValue: 1,
  name: 'Leer',
  schedule: {
    anchorDate: null,
    dayOfMonth: null,
    interval: 1,
    unit: 'day',
    weekdays: [],
  },
  startDate: '2026-09-01',
  trackingType: 'boolean',
}

describe('habit validation', () => {
  it('accepts the supported habit modes and rejects incompatible values', () => {
    expect(habitInputSchema.safeParse(habitBase).success).toBe(true)
    expect(
      habitInputSchema.safeParse({
        ...habitBase,
        calendarEnabled: true,
        calendarSchedule: { dates: [], mode: 'custom', weekdays: [] },
      }).success,
    ).toBe(false)
    expect(
      habitInputSchema.safeParse({
        ...habitBase,
        endDate: '2026-08-31',
      }).success,
    ).toBe(false)
  })

  it('validates schedules, measurements, relations, and external log requirements', () => {
    expect(
      habitScheduleSchema.safeParse({
        interval: 1,
        unit: 'week',
        weekdays: [1, 1],
      }).success,
    ).toBe(false)
    expect(
      habitInputSchema.safeParse({
        ...habitBase,
        personalGroupId: '33333333-3333-4333-8333-333333333333',
        subjectId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(false)
    expect(
      habitInputSchema.safeParse({
        ...habitBase,
        goalValue: 20,
        trackingType: 'count',
        unit: 'páginas',
      }).success,
    ).toBe(true)
    expect(
      habitLogInputSchema.safeParse({
        habitId: '11111111-1111-4111-8111-111111111111',
        localDate: '2026-09-01',
        source: 'koreader',
        status: 'completed',
        value: 10,
      }).success,
    ).toBe(false)
  })

  it('validates recurring task dates and recurrence rules', () => {
    expect(
      recurringTaskInputSchema.safeParse({
        nextDueDate: '2026-08-31',
        schedule: {
          anchorDate: null,
          dayOfMonth: null,
          interval: 1,
          unit: 'day',
          weekdays: [],
        },
        startDate: '2026-09-01',
        title: 'Enviar informe',
      }).success,
    ).toBe(false)
  })
})
