import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '../lib/insforge/database.types.ts'
import {
  createHabit,
  createRecurringTask,
  saveHabitLog,
  updateRecurringTaskScheduleVersion,
} from './habitService.ts'

const mocks = vi.hoisted(() => ({
  databaseFrom: vi.fn(),
  requireCurrentUserId: vi.fn(),
}))

vi.mock('../lib/insforge/client.ts', () => ({
  insforge: {
    database: {
      from: mocks.databaseFrom,
    },
  },
}))

vi.mock('./authService.ts', () => ({
  requireCurrentUserId: mocks.requireCurrentUserId,
}))

type TestQuery = {
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  then: (
    resolve: (value: { data: unknown; error: null }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>
}

function createQuery(data: unknown): TestQuery {
  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    insert: vi.fn(),
    limit: vi.fn(),
    lte: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
    then: (
      resolve: (value: { data: unknown; error: null }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data, error: null }).then(resolve, reject),
  }

  for (const method of [
    'delete',
    'eq',
    'gte',
    'insert',
    'limit',
    'lte',
    'maybeSingle',
    'order',
    'select',
    'single',
    'update',
  ] as const) {
    query[method].mockReturnValue(query)
  }

  return query
}

function setQueries(queries: Record<string, TestQuery>) {
  mocks.databaseFrom.mockImplementation((table: string) => queries[table])
}

const ownerId = '22222222-2222-4222-8222-222222222222'
const habitId = '11111111-1111-4111-8111-111111111111'
const taskId = '66666666-6666-4666-8666-666666666666'
const timestamp = '2026-09-01T10:00:00.000Z'
const schedule = {
  anchorDate: null,
  dayOfMonth: null,
  interval: 1,
  unit: 'day' as const,
  weekdays: [],
}

const habitRow: Database['public']['Tables']['habits']['Row'] = {
  calendar_enabled: false,
  calendar_schedule: null,
  color: '#2F625A',
  created_at: timestamp,
  description: null,
  end_date: null,
  evaluation_mode: 'scheduled_occurrence',
  goal_value: 1,
  id: habitId,
  lifecycle_status: 'active',
  miss_policy: 'mark_missed',
  name: 'Leer',
  note_policy: 'none',
  owner_id: ownerId,
  personal_group_id: null,
  quota_period: null,
  schedule,
  start_date: '2026-09-01',
  stats_enabled: true,
  subject_id: null,
  tracking_type: 'boolean',
  unit: null,
  updated_at: timestamp,
}

const taskRow: Database['public']['Tables']['recurring_tasks']['Row'] = {
  calendar_enabled: false,
  color: null,
  created_at: timestamp,
  description: null,
  due_time: null,
  duration_minutes: null,
  end_date: null,
  id: taskId,
  next_due_date: '2026-09-03',
  owner_id: ownerId,
  personal_group_id: null,
  schedule,
  start_date: '2026-09-01',
  status: 'active',
  subject_id: null,
  title: 'Revisar documentos',
  updated_at: timestamp,
}

const futureVersionRow: Database['public']['Tables']['recurring_task_schedule_versions']['Row'] =
  {
    created_at: timestamp,
    effective_from: '2099-01-01',
    effective_to: null,
    id: '77777777-7777-4777-8777-777777777777',
    owner_id: ownerId,
    recurring_task_id: taskId,
    schedule,
    updated_at: timestamp,
  }

describe('habitService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireCurrentUserId.mockResolvedValue(ownerId)
  })

  it('maps a created habit and persists its initial schedule version', async () => {
    const habitsQuery = createQuery(habitRow)
    const versionsQuery = createQuery(null)
    setQueries({ habits: habitsQuery, habit_schedule_versions: versionsQuery })

    const result = await createHabit({
      calendarEnabled: false,
      calendarSchedule: null,
      color: '#2F625A',
      description: null,
      endDate: null,
      evaluationMode: 'scheduled_occurrence',
      goalValue: 1,
      lifecycleStatus: 'active',
      missPolicy: 'mark_missed',
      name: 'Leer',
      notePolicy: 'none',
      personalGroupId: null,
      quotaPeriod: null,
      schedule,
      startDate: '2026-09-01',
      statsEnabled: true,
      subjectId: null,
      trackingType: 'boolean',
      unit: null,
    })

    expect(result).toMatchObject({ id: habitId, name: 'Leer', ownerId })
    expect(habitsQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Leer', owner_id: ownerId }),
    ])
    expect(versionsQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        effective_from: '2026-09-01',
        habit_id: habitId,
        owner_id: ownerId,
      }),
    ])
  })

  it('updates the existing log for the same habit, date and source', async () => {
    const habitsQuery = createQuery(habitRow)
    const logsQuery = createQuery({
      created_at: timestamp,
      external_id: null,
      habit_id: habitId,
      id: '33333333-3333-4333-8333-333333333333',
      local_date: '2026-09-01',
      owner_id: ownerId,
      source: 'manual',
      status: 'completed',
      updated_at: timestamp,
      value: 1,
    } satisfies Database['public']['Tables']['habit_logs']['Row'])
    setQueries({ habits: habitsQuery, habit_logs: logsQuery })

    const result = await saveHabitLog({
      externalId: null,
      habitId,
      localDate: '2026-09-01',
      source: 'manual',
      status: 'completed',
      value: 1,
    })

    expect(result).toMatchObject({ habitId, localDate: '2026-09-01' })
    expect(logsQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ habit_id: habitId, local_date: '2026-09-01' }),
    )
    expect(logsQuery.insert).not.toHaveBeenCalled()
  })

  it('creates a task with an initial rule and rejects duplicate future dates', async () => {
    const tasksQuery = createQuery(taskRow)
    const versionsQuery = createQuery(null)
    setQueries({
      recurring_tasks: tasksQuery,
      recurring_task_schedule_versions: versionsQuery,
    })

    const result = await createRecurringTask({
      calendarEnabled: false,
      color: null,
      description: null,
      dueTime: null,
      durationMinutes: null,
      endDate: null,
      nextDueDate: '2026-09-03',
      personalGroupId: null,
      schedule,
      startDate: '2026-09-01',
      status: 'active',
      subjectId: null,
      title: 'Revisar documentos',
    })

    expect(result).toMatchObject({ id: taskId, title: 'Revisar documentos' })
    expect(versionsQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({ recurring_task_id: taskId }),
    ])

    const existingTaskQuery = createQuery(taskRow)
    const existingVersionsQuery = createQuery([futureVersionRow])
    setQueries({
      recurring_tasks: existingTaskQuery,
      recurring_task_schedule_versions: existingVersionsQuery,
    })

    await expect(
      updateRecurringTaskScheduleVersion({
        effectiveFrom: '2099-01-01',
        recurringTaskId: taskId,
        schedule,
      }),
    ).rejects.toMatchObject({
      code: 'validation',
      message: 'Ya existe una regla para esa fecha efectiva.',
    })
    expect(existingVersionsQuery.insert).not.toHaveBeenCalled()
  })
})
