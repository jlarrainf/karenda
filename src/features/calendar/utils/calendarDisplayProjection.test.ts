import { describe, expect, it } from 'vitest'
import type { Habit, RecurringTask } from '../../../types/domain.ts'
import { getCalendarDisplayItems } from './calendarDisplayProjection.ts'

const habit: Habit = {
  calendarEnabled: true,
  calendarSchedule: { dates: [], mode: 'rule', weekdays: [] },
  color: '#2F625A',
  createdAt: '2026-09-01T10:00:00.000Z',
  description: 'Leer antes de dormir.',
  endDate: null,
  evaluationMode: 'scheduled_occurrence',
  goalValue: 1,
  id: 'habit-1',
  lifecycleStatus: 'active',
  missPolicy: 'mark_missed',
  name: 'Leer',
  notePolicy: 'none',
  ownerId: 'owner-1',
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
  trackingType: 'boolean',
  unit: null,
  updatedAt: '2026-09-01T10:00:00.000Z',
}

const task: RecurringTask = {
  calendarEnabled: true,
  color: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  description: null,
  dueTime: null,
  durationMinutes: null,
  endDate: null,
  id: 'task-1',
  nextDueDate: '2026-09-05',
  ownerId: 'owner-1',
  personalGroupId: null,
  schedule: {
    anchorDate: null,
    dayOfMonth: null,
    interval: 1,
    unit: 'day',
    weekdays: [],
  },
  startDate: '2026-09-01',
  status: 'active',
  subjectId: null,
  title: 'Enviar informe',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

describe('calendar display projection', () => {
  it('projects enabled habits and recurring tasks in the requested range', () => {
    const items = getCalendarDisplayItems({
      habitLogs: [],
      habitOccurrences: [],
      habitScheduleVersions: [],
      habits: [habit],
      rangeEnd: '2026-09-05',
      rangeStart: '2026-09-02',
      recurringTasks: [task],
      today: '2026-09-02',
    })

    expect(items.map((item) => [item.source, item.startDate])).toEqual([
      ['habit_occurrence', '2026-09-02'],
      ['habit_occurrence', '2026-09-03'],
      ['habit_occurrence', '2026-09-04'],
      ['habit_occurrence', '2026-09-05'],
      ['recurring_task_occurrence', '2026-09-05'],
    ])
  })

  it('does not project paused or disabled habits and supports custom dates', () => {
    const customHabit = {
      ...habit,
      calendarSchedule: {
        dates: ['2026-09-04'],
        mode: 'custom' as const,
        weekdays: [],
      },
    }
    const pausedHabit = { ...habit, id: 'habit-2', lifecycleStatus: 'paused' as const }
    const disabledHabit = { ...habit, id: 'habit-3', calendarEnabled: false }

    const items = getCalendarDisplayItems({
      habitLogs: [],
      habitOccurrences: [],
      habitScheduleVersions: [],
      habits: [customHabit, pausedHabit, disabledHabit],
      rangeEnd: '2026-09-05',
      rangeStart: '2026-09-02',
      recurringTasks: [],
      today: '2026-09-02',
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      source: 'habit_occurrence',
      startDate: '2026-09-04',
      statusLabel: 'Pendiente',
    })
  })
})
