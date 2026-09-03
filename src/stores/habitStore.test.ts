import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Habit, HabitLog, HabitScheduleVersion } from '../types/domain.ts'
import {
  createHabit,
  deleteHabitLog,
  listHabitLogs,
  listHabits,
  listHabitNotes,
  listHabitScheduleVersions,
  saveHabitLog,
  updateHabitLifecycle,
  updateHabitNote,
  updateHabitScheduleVersion,
  createHabitNote,
  deleteHabitNote,
} from '../services/habitService.ts'
import { useHabitStore } from './habitStore.ts'

vi.mock('../services/habitService.ts', () => ({
  createHabit: vi.fn(),
  createHabitNote: vi.fn(),
  deleteHabitLog: vi.fn(),
  deleteHabitNote: vi.fn(),
  listHabitLogs: vi.fn(),
  listHabitNotes: vi.fn(),
  listHabits: vi.fn(),
  listHabitScheduleVersions: vi.fn(),
  saveHabitLog: vi.fn(),
  updateHabit: vi.fn(),
  updateHabitLifecycle: vi.fn(),
  updateHabitNote: vi.fn(),
  updateHabitScheduleVersion: vi.fn(),
}))

const ownerId = '22222222-2222-4222-8222-222222222222'
const habitId = '11111111-1111-4111-8111-111111111111'
const timestamp = '2026-09-01T10:00:00.000Z'

const habit: Habit = {
  calendarEnabled: false,
  calendarSchedule: null,
  color: '#2F625A',
  createdAt: timestamp,
  description: null,
  endDate: null,
  evaluationMode: 'scheduled_occurrence',
  goalValue: 1,
  id: habitId,
  lifecycleStatus: 'active',
  missPolicy: 'mark_missed',
  name: 'Leer',
  notePolicy: 'both',
  ownerId,
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
  updatedAt: timestamp,
}

const version: HabitScheduleVersion = {
  createdAt: timestamp,
  effectiveFrom: habit.startDate,
  effectiveTo: null,
  evaluationMode: habit.evaluationMode,
  goalValue: habit.goalValue,
  habitId,
  id: '33333333-3333-4333-8333-333333333333',
  missPolicy: habit.missPolicy,
  ownerId,
  quotaPeriod: null,
  schedule: habit.schedule,
  updatedAt: timestamp,
}

const log: HabitLog = {
  createdAt: timestamp,
  externalId: null,
  habitId,
  id: '44444444-4444-4444-8444-444444444444',
  localDate: '2026-09-01',
  ownerId,
  source: 'manual',
  status: 'completed',
  updatedAt: timestamp,
  value: 1,
}

const mockedListHabits = vi.mocked(listHabits)
const mockedListHabitLogs = vi.mocked(listHabitLogs)
const mockedListHabitScheduleVersions = vi.mocked(listHabitScheduleVersions)
const mockedSaveHabitLog = vi.mocked(saveHabitLog)
const mockedCreateHabit = vi.mocked(createHabit)
const mockedUpdateHabitLifecycle = vi.mocked(updateHabitLifecycle)
const mockedUpdateHabitScheduleVersion = vi.mocked(updateHabitScheduleVersion)
const mockedDeleteHabitLog = vi.mocked(deleteHabitLog)
const mockedListHabitNotes = vi.mocked(listHabitNotes)
const mockedCreateHabitNote = vi.mocked(createHabitNote)
const mockedUpdateHabitNote = vi.mocked(updateHabitNote)
const mockedDeleteHabitNote = vi.mocked(deleteHabitNote)

describe('habitStore', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    useHabitStore.getState().reset()
    mockedListHabits.mockResolvedValue([habit])
    mockedListHabitScheduleVersions.mockResolvedValue([version])
    mockedListHabitLogs.mockResolvedValue([log])
  })

  it('loads a bounded log range and derives occurrences and statistics', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 12, 0, 0))

    await useHabitStore.getState().loadRange({
      endDate: '2026-09-02',
      startDate: '2026-09-01',
    })

    expect(mockedListHabitLogs).toHaveBeenCalledWith(habitId, {
      endDate: '2026-09-02',
      startDate: '2026-08-01',
    })
    expect(useHabitStore.getState().occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ localDate: '2026-09-01', status: 'completed' }),
        expect.objectContaining({ localDate: '2026-09-02', status: 'pending' }),
      ]),
    )
    expect(useHabitStore.getState().statistics[0]).toMatchObject({
      completedCount: 1,
      habitId,
    })
  })

  it('does not start a second request for the same range while loading', async () => {
    let resolveHabits: ((value: Habit[]) => void) | undefined
    mockedListHabits.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHabits = resolve
        }),
    )

    const range = { endDate: '2026-09-02', startDate: '2026-09-01' }
    const firstLoad = useHabitStore.getState().loadRange(range)
    const forcedLoad = useHabitStore.getState().loadRange(range, true)

    expect(mockedListHabits).toHaveBeenCalledOnce()

    resolveHabits?.([habit])
    await Promise.all([firstLoad, forcedLoad])
  })

  it('refreshes only after successful mutations and keeps errors translated', async () => {
    mockedSaveHabitLog.mockResolvedValue(log)
    await expect(
      useHabitStore.getState().saveLog({
        externalId: null,
        habitId,
        localDate: log.localDate,
        source: 'manual',
        status: 'completed',
        value: 1,
      }),
    ).resolves.toEqual(log)
    expect(mockedListHabits).toHaveBeenCalled()
    expect(useHabitStore.getState().isSaving).toBe(false)

    mockedCreateHabit.mockRejectedValue(new Error('network failure'))
    await expect(useHabitStore.getState().createHabit({} as never)).resolves.toBeNull()
    expect(useHabitStore.getState().error).toBe(
      'No se pudo conectar con Karenda. Revisa tu conexión e inténtalo nuevamente.',
    )
  })

  it('coordinates notes and lifecycle mutations through confirmed services', async () => {
    mockedListHabitNotes.mockResolvedValue([])
    await useHabitStore.getState().loadNotes(habitId)
    expect(mockedListHabitNotes).toHaveBeenCalledWith(habitId)
    const note = {
      contentMarkdown: '**Bien**',
      createdAt: timestamp,
      entryDate: null,
      habitId,
      id: '55555555-5555-4555-8555-555555555555',
      ownerId,
      title: 'Lectura',
      updatedAt: timestamp,
    }
    mockedCreateHabitNote.mockResolvedValue(note)
    mockedUpdateHabitLifecycle.mockResolvedValue({
      ...habit,
      lifecycleStatus: 'paused',
    })
    mockedUpdateHabitScheduleVersion.mockResolvedValue(version)
    mockedDeleteHabitLog.mockResolvedValue(undefined)
    mockedUpdateHabitNote.mockResolvedValue({
      ...note,
      contentMarkdown: '**Actualizada**',
    })
    mockedDeleteHabitNote.mockResolvedValue(undefined)

    await useHabitStore.getState().createNote({
      contentMarkdown: note.contentMarkdown,
      entryDate: null,
      habitId,
      title: note.title,
    })
    await useHabitStore.getState().updateNote(note.id, {
      contentMarkdown: '**Actualizada**',
    })
    await useHabitStore.getState().deleteNote(note.id)
    await useHabitStore.getState().updateLifecycle(habitId, 'paused')
    await useHabitStore.getState().updateScheduleVersion({} as never)
    await useHabitStore.getState().deleteLog(log.id)
    expect(mockedCreateHabitNote).toHaveBeenCalledWith({
      contentMarkdown: note.contentMarkdown,
      entryDate: null,
      habitId,
      title: note.title,
    })
    expect(mockedUpdateHabitNote).toHaveBeenCalledWith(note.id, {
      contentMarkdown: '**Actualizada**',
    })
    expect(mockedDeleteHabitNote).toHaveBeenCalledWith(note.id)
    expect(mockedUpdateHabitLifecycle).toHaveBeenCalledWith(habitId, 'paused')
    expect(mockedUpdateHabitScheduleVersion).toHaveBeenCalledWith({})
    expect(mockedDeleteHabitLog).toHaveBeenCalledWith(log.id)
  })
})
