import type { Habit, HabitSchedule } from '../../../types/domain.ts'
import {
  describeSchedule,
  getHabitOccurrences,
  getPeriodEnd,
  getPeriodKey,
  isDateScheduled,
} from './habitRecurrence.ts'

const dailySchedule: HabitSchedule = {
  anchorDate: null,
  dayOfMonth: null,
  interval: 1,
  unit: 'day',
  weekdays: [],
}

const habit: Habit = {
  calendarEnabled: false,
  calendarSchedule: null,
  color: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  description: null,
  endDate: null,
  evaluationMode: 'scheduled_occurrence',
  goalValue: 1,
  id: '11111111-1111-4111-8111-111111111111',
  lifecycleStatus: 'active',
  missPolicy: 'mark_missed',
  name: 'Leer',
  notePolicy: 'none',
  ownerId: '22222222-2222-4222-8222-222222222222',
  personalGroupId: null,
  quotaPeriod: null,
  schedule: dailySchedule,
  startDate: '2026-09-01',
  statsEnabled: true,
  subjectId: null,
  trackingType: 'boolean',
  unit: null,
  updatedAt: '2026-09-01T00:00:00.000Z',
}

describe('habit recurrence', () => {
  it('calculates every N days from an explicit anchor', () => {
    const schedule: HabitSchedule = {
      ...dailySchedule,
      anchorDate: '2026-09-01',
      interval: 3,
    }

    expect(isDateScheduled(schedule, '2026-09-01', '2026-09-07')).toBe(true)
    expect(isDateScheduled(schedule, '2026-09-01', '2026-09-08')).toBe(false)
  })

  it('uses the last available day for monthly day 31', () => {
    const schedule: HabitSchedule = {
      ...dailySchedule,
      dayOfMonth: 31,
      interval: 1,
      unit: 'month',
    }

    expect(isDateScheduled(schedule, '2026-01-31', '2026-02-28')).toBe(true)
    expect(describeSchedule(schedule)).toBe('El día 31 de cada mes')
  })

  it('generates selected weekdays and respects future schedule versions', () => {
    const weeklySchedule: HabitSchedule = {
      ...dailySchedule,
      interval: 1,
      unit: 'week',
      weekdays: [1, 3],
    }
    const occurrences = getHabitOccurrences(
      { ...habit, schedule: weeklySchedule },
      [
        {
          createdAt: habit.createdAt,
          effectiveFrom: '2026-09-01',
          effectiveTo: '2026-09-09',
          evaluationMode: 'scheduled_occurrence',
          goalValue: 1,
          habitId: habit.id,
          id: 'version-1',
          missPolicy: 'mark_missed',
          ownerId: habit.ownerId,
          quotaPeriod: null,
          schedule: weeklySchedule,
          updatedAt: habit.updatedAt,
        },
        {
          createdAt: habit.createdAt,
          effectiveFrom: '2026-09-10',
          effectiveTo: null,
          evaluationMode: 'scheduled_occurrence',
          goalValue: 1,
          habitId: habit.id,
          id: 'version-2',
          missPolicy: 'mark_missed',
          ownerId: habit.ownerId,
          quotaPeriod: null,
          schedule: { ...weeklySchedule, weekdays: [5] },
          updatedAt: habit.updatedAt,
        },
      ],
      '2026-09-01',
      '2026-09-15',
    )

    expect(occurrences.map((item) => item.localDate)).toEqual([
      '2026-09-02',
      '2026-09-07',
      '2026-09-09',
      '2026-09-11',
    ])
    expect(
      occurrences.find((item) => item.localDate === '2026-09-11')?.scheduleVersionId,
    ).toBe('version-2')
  })

  it('uses Monday as the civil start of a weekly quota period', () => {
    expect(getPeriodKey('2026-09-02', 'week')).toBe('2026-08-31')
    expect(getPeriodEnd('2026-08-31', 'week')).toBe('2026-09-06')
  })
})
