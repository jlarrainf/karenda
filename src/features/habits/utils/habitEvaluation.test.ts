import type { Habit, HabitLog, HabitOccurrenceResult } from '../../../types/domain.ts'
import { calculateHabitStatistics, evaluateHabitOccurrence } from './habitEvaluation.ts'

const habit: Habit = {
  calendarEnabled: false,
  calendarSchedule: null,
  color: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  description: null,
  endDate: null,
  evaluationMode: 'scheduled_occurrence',
  goalValue: 30,
  id: '11111111-1111-4111-8111-111111111111',
  lifecycleStatus: 'active',
  missPolicy: 'mark_missed',
  name: 'Leer',
  notePolicy: 'none',
  ownerId: '22222222-2222-4222-8222-222222222222',
  personalGroupId: null,
  quotaPeriod: null,
  schedule: {
    anchorDate: null,
    dayOfMonth: null,
    interval: 1,
    unit: 'day',
    weekdays: [],
  },
  startDate: '2026-09-01',
  statsEnabled: true,
  subjectId: null,
  trackingType: 'duration',
  unit: 'minutos',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

function occurrence(localDate: string): HabitOccurrenceResult {
  return {
    evaluationMode: 'scheduled_occurrence',
    goalValue: 30,
    habitId: habit.id,
    id: `${habit.id}:${localDate}`,
    localDate,
    logId: null,
    missPolicy: 'mark_missed',
    quotaPeriod: null,
    schedule: habit.schedule,
    scheduleVersionId: 'version-1',
    status: 'pending',
    value: 0,
  }
}

function log(
  localDate: string,
  value: number,
  status: HabitLog['status'] = 'completed',
): HabitLog {
  return {
    createdAt: '2026-09-01T10:00:00.000Z',
    externalId: null,
    habitId: habit.id,
    id: `log-${localDate}`,
    localDate,
    ownerId: habit.ownerId,
    source: 'manual',
    status,
    updatedAt: '2026-09-01T10:00:00.000Z',
    value,
  }
}

describe('habit evaluation', () => {
  it('derives completed, partial, missed, pending and skipped states', () => {
    expect(
      evaluateHabitOccurrence(
        habit,
        occurrence('2026-09-01'),
        [log('2026-09-01', 30)],
        '2026-09-05',
      ).status,
    ).toBe('completed')
    expect(
      evaluateHabitOccurrence(
        habit,
        occurrence('2026-09-02'),
        [log('2026-09-02', 10)],
        '2026-09-05',
      ).status,
    ).toBe('partial')
    expect(
      evaluateHabitOccurrence(habit, occurrence('2026-09-03'), [], '2026-09-05').status,
    ).toBe('missed')
    expect(
      evaluateHabitOccurrence(habit, occurrence('2026-09-05'), [], '2026-09-05').status,
    ).toBe('pending')
    expect(
      evaluateHabitOccurrence(
        habit,
        occurrence('2026-09-04'),
        [log('2026-09-04', 0, 'skipped')],
        '2026-09-05',
      ).status,
    ).toBe('skipped')
  })

  it('excludes skipped occurrences from the denominator and keeps the streak', () => {
    const results = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'].map(
      occurrence,
    )
    results[0] = { ...results[0], status: 'completed', value: 30 }
    results[1] = { ...results[1], status: 'skipped' }
    results[2] = { ...results[2], status: 'completed', value: 30 }
    results[3] = { ...results[3], status: 'missed' }

    const statistics = calculateHabitStatistics(
      habit,
      results,
      [log('2026-09-01', 30), log('2026-09-03', 30)],
      '2026-09-01',
      '2026-09-04',
      '2026-09-05',
    )

    expect(statistics.completionPercentage).toBeCloseTo(66.67, 1)
    expect(statistics.skippedCount).toBe(1)
    expect(statistics.currentStreak).toBe(0)
    expect(statistics.bestStreak).toBe(2)
  })

  it('accumulates quota logs without requiring one log per day', () => {
    const quotaHabit: Habit = {
      ...habit,
      evaluationMode: 'period_quota',
      quotaPeriod: 'week',
      goalValue: 3,
      trackingType: 'count',
      unit: 'episodios',
    }
    const statistics = calculateHabitStatistics(
      quotaHabit,
      [],
      [log('2026-09-01', 1), log('2026-09-03', 2)],
      '2026-08-31',
      '2026-09-06',
      '2026-09-08',
    )

    expect(statistics.achievedPeriods).toBe(1)
    expect(statistics.totalPeriods).toBe(1)
    expect(statistics.completionPercentage).toBe(100)
  })
})
