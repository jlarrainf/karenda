import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  RecurringTask,
  RecurringTaskOccurrence,
  RecurringTaskScheduleVersion,
} from '../types/domain.ts'
import {
  completeRecurringTask,
  createRecurringTask,
  listRecurringTaskOccurrences,
  listRecurringTaskScheduleVersions,
  listRecurringTasks,
  rescheduleRecurringTask,
  updateRecurringTask,
  updateRecurringTaskLifecycle,
  updateRecurringTaskScheduleVersion,
} from '../services/habitService.ts'
import { useRecurringTaskStore } from './recurringTaskStore.ts'

vi.mock('../services/habitService.ts', () => ({
  completeRecurringTask: vi.fn(),
  createRecurringTask: vi.fn(),
  listRecurringTaskOccurrences: vi.fn(),
  listRecurringTaskScheduleVersions: vi.fn(),
  listRecurringTasks: vi.fn(),
  rescheduleRecurringTask: vi.fn(),
  updateRecurringTask: vi.fn(),
  updateRecurringTaskLifecycle: vi.fn(),
  updateRecurringTaskScheduleVersion: vi.fn(),
}))

const taskId = '11111111-1111-4111-8111-111111111111'
const ownerId = '22222222-2222-4222-8222-222222222222'
const timestamp = '2026-09-01T10:00:00.000Z'

const task: RecurringTask = {
  calendarEnabled: true,
  color: '#8A5A20',
  createdAt: timestamp,
  description: 'Revisar documentos',
  dueTime: '09:00',
  durationMinutes: 30,
  endDate: null,
  id: taskId,
  nextDueDate: '2026-09-03',
  ownerId,
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
  title: 'Revisar documentos',
  updatedAt: timestamp,
}

const occurrence: RecurringTaskOccurrence = {
  completedAt: timestamp,
  createdAt: timestamp,
  dueDate: task.nextDueDate,
  id: '33333333-3333-4333-8333-333333333333',
  ownerId,
  recurringTaskId: taskId,
  rescheduledTo: null,
  status: 'completed',
}

const version: RecurringTaskScheduleVersion = {
  createdAt: timestamp,
  effectiveFrom: task.startDate,
  effectiveTo: null,
  id: '44444444-4444-4444-8444-444444444444',
  ownerId,
  recurringTaskId: taskId,
  schedule: task.schedule,
  updatedAt: timestamp,
}

const mockedComplete = vi.mocked(completeRecurringTask)
const mockedCreate = vi.mocked(createRecurringTask)
const mockedListOccurrences = vi.mocked(listRecurringTaskOccurrences)
const mockedListVersions = vi.mocked(listRecurringTaskScheduleVersions)
const mockedListTasks = vi.mocked(listRecurringTasks)
const mockedReschedule = vi.mocked(rescheduleRecurringTask)
const mockedUpdate = vi.mocked(updateRecurringTask)
const mockedUpdateLifecycle = vi.mocked(updateRecurringTaskLifecycle)
const mockedUpdateVersion = vi.mocked(updateRecurringTaskScheduleVersion)

describe('recurringTaskStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRecurringTaskStore.getState().reset()
    mockedListTasks.mockResolvedValue([task])
    mockedListOccurrences.mockResolvedValue([occurrence])
    mockedListVersions.mockResolvedValue([version])
  })

  it('loads tasks, occurrences and schedule versions together', async () => {
    await useRecurringTaskStore.getState().load()

    expect(mockedListTasks).toHaveBeenCalledWith(false)
    expect(mockedListOccurrences).toHaveBeenCalledOnce()
    expect(mockedListVersions).toHaveBeenCalledOnce()
    expect(useRecurringTaskStore.getState()).toMatchObject({
      isLoaded: true,
      occurrences: [occurrence],
      scheduleVersions: [version],
      tasks: [task],
    })
  })

  it('does not start a second request while the task data is loading', async () => {
    let resolveTasks: ((value: RecurringTask[]) => void) | undefined
    mockedListTasks.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTasks = resolve
        }),
    )

    const firstLoad = useRecurringTaskStore.getState().load()
    const forcedLoad = useRecurringTaskStore.getState().load(true)

    expect(mockedListTasks).toHaveBeenCalledOnce()

    resolveTasks?.([task])
    await Promise.all([firstLoad, forcedLoad])
  })

  it('refreshes after confirmed task mutations', async () => {
    mockedComplete.mockResolvedValue({ ...task, nextDueDate: '2026-09-04' })
    mockedReschedule.mockResolvedValue({ ...task, nextDueDate: '2026-09-05' })
    mockedCreate.mockResolvedValue(task)
    mockedUpdate.mockResolvedValue(task)
    mockedUpdateLifecycle.mockResolvedValue({ ...task, status: 'paused' })
    mockedUpdateVersion.mockResolvedValue(version)

    await useRecurringTaskStore.getState().completeTask(taskId, task.nextDueDate)
    await useRecurringTaskStore
      .getState()
      .rescheduleTask(taskId, task.nextDueDate, '2026-09-05')
    await useRecurringTaskStore.getState().createTask({} as never)
    await useRecurringTaskStore.getState().updateTask(taskId, {})
    await useRecurringTaskStore.getState().updateLifecycle(taskId, 'paused')
    await useRecurringTaskStore.getState().updateScheduleVersion({} as never)

    expect(mockedComplete).toHaveBeenCalledWith(taskId, task.nextDueDate)
    expect(mockedReschedule).toHaveBeenCalledWith(
      taskId,
      task.nextDueDate,
      '2026-09-05',
    )
    expect(mockedCreate).toHaveBeenCalledWith({})
    expect(mockedUpdate).toHaveBeenCalledWith(taskId, {})
    expect(mockedUpdateLifecycle).toHaveBeenCalledWith(taskId, 'paused')
    expect(mockedUpdateVersion).toHaveBeenCalledWith({})
    expect(useRecurringTaskStore.getState().isSaving).toBe(false)
  })

  it('keeps the task state and exposes a translated error when loading fails', async () => {
    mockedListTasks.mockRejectedValue(new Error('network failure'))

    await useRecurringTaskStore.getState().load()

    expect(useRecurringTaskStore.getState().tasks).toEqual([])
    expect(useRecurringTaskStore.getState().error).toBe(
      'No se pudo conectar con Karenda. Revisa tu conexión e inténtalo nuevamente.',
    )
    expect(useRecurringTaskStore.getState().isLoading).toBe(false)
  })
})
