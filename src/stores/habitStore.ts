import { create } from 'zustand'
import { getLocalDateKey, shiftDateKey } from '../lib/dates/dateUtils.ts'
import type {
  Habit,
  HabitLog,
  HabitNote,
  HabitOccurrenceResult,
  HabitScheduleVersion,
  HabitStatistics,
} from '../types/domain.ts'
import {
  createHabit,
  createHabitNote,
  deleteHabitLog,
  deleteHabitNote,
  listHabitLogs,
  listHabitNotes,
  listHabits,
  listHabitScheduleVersions,
  saveHabitLog,
  updateHabit,
  updateHabitLifecycle,
  updateHabitNote,
  updateHabitScheduleVersion,
} from '../services/habitService.ts'
import type {
  HabitInput,
  HabitLogInput,
  HabitNoteInput,
  HabitNotePatch,
  HabitPatch,
  HabitRange,
  HabitScheduleVersionInput,
} from '../services/habitValidation.ts'
import { toAppError } from '../services/errors.ts'
import {
  calculateHabitStatistics,
  evaluateHabitRange,
} from '../features/habits/utils/habitEvaluation.ts'

export type HabitView = 'today' | 'history' | 'statistics' | 'tasks'

interface HabitState {
  habits: Habit[]
  versions: HabitScheduleVersion[]
  logs: HabitLog[]
  occurrences: HabitOccurrenceResult[]
  statistics: HabitStatistics[]
  notes: HabitNote[]
  view: HabitView
  selectedDate: string
  range: HabitRange
  isLoaded: boolean
  isLoading: boolean
  isSaving: boolean
  error: string | null
  notesLoaded: boolean
  includeArchived: boolean
  search: string
  load: (date?: string, force?: boolean) => Promise<void>
  loadRange: (range: HabitRange, force?: boolean) => Promise<void>
  loadNotes: (habitId?: string, force?: boolean) => Promise<void>
  createHabit: (input: HabitInput) => Promise<Habit | null>
  updateHabit: (id: string, input: HabitPatch) => Promise<Habit | null>
  updateLifecycle: (
    id: string,
    status: Habit['lifecycleStatus'],
  ) => Promise<Habit | null>
  updateScheduleVersion: (
    input: HabitScheduleVersionInput,
  ) => Promise<HabitScheduleVersion | null>
  saveLog: (input: HabitLogInput) => Promise<HabitLog | null>
  deleteLog: (id: string) => Promise<boolean>
  createNote: (input: HabitNoteInput) => Promise<HabitNote | null>
  updateNote: (id: string, input: HabitNotePatch) => Promise<HabitNote | null>
  deleteNote: (id: string) => Promise<boolean>
  setView: (view: HabitView) => void
  setSelectedDate: (date: string) => void
  setRange: (range: HabitRange) => void
  setIncludeArchived: (includeArchived: boolean) => void
  setSearch: (search: string) => void
  clearError: () => void
  reset: () => void
}

let habitLoadSequence = 0

function getErrorMessage(error: unknown, fallback: string): string {
  return toAppError(error, fallback).message
}

function getTodayDate(): string {
  return getLocalDateKey(new Date().toISOString())
}

function getLogsForHabits(habits: Habit[], range: HabitRange): Promise<HabitLog[]> {
  const queryRange = {
    endDate: range.endDate,
    startDate: shiftDateKey(range.startDate, -31),
  }

  return Promise.all(habits.map((habit) => listHabitLogs(habit.id, queryRange))).then(
    (logs) => logs.flat(),
  )
}

function calculateDerivedData(
  habits: Habit[],
  versions: HabitScheduleVersion[],
  logs: HabitLog[],
  range: HabitRange,
  today: string,
): { occurrences: HabitOccurrenceResult[]; statistics: HabitStatistics[] } {
  const occurrences = habits.flatMap((habit) =>
    evaluateHabitRange(
      habit,
      versions,
      logs.filter((log) => log.habitId === habit.id),
      range.startDate,
      range.endDate,
      today,
    ),
  )
  const statistics = habits
    .filter((habit) => habit.statsEnabled)
    .map((habit) =>
      calculateHabitStatistics(
        habit,
        occurrences.filter((occurrence) => occurrence.habitId === habit.id),
        logs.filter((log) => log.habitId === habit.id),
        range.startDate,
        range.endDate,
        today,
      ),
    )

  return { occurrences, statistics }
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  versions: [],
  logs: [],
  occurrences: [],
  statistics: [],
  notes: [],
  view: 'today',
  selectedDate: getTodayDate(),
  range: { startDate: getTodayDate(), endDate: getTodayDate() },
  isLoaded: false,
  isLoading: false,
  isSaving: false,
  error: null,
  notesLoaded: false,
  includeArchived: false,
  search: '',

  load: async (date = get().selectedDate, force = false) => {
    await get().loadRange({ startDate: date, endDate: date }, force)
  },

  loadRange: async (range, force = false) => {
    const state = get()
    const rangeKey = `${range.startDate}|${range.endDate}|${state.includeArchived}`
    const currentRangeKey = `${state.range.startDate}|${state.range.endDate}|${state.includeArchived}`

    if (
      (state.isLoading && currentRangeKey === rangeKey) ||
      (!force && state.isLoaded && currentRangeKey === rangeKey)
    ) {
      return
    }

    const requestSequence = ++habitLoadSequence
    set({ error: null, isLoading: true, range, selectedDate: range.startDate })

    try {
      const habits = await listHabits(state.includeArchived)
      const [versions, logs] = await Promise.all([
        listHabitScheduleVersions(),
        getLogsForHabits(habits, range),
      ])
      const derived = calculateDerivedData(
        habits,
        versions,
        logs,
        range,
        getTodayDate(),
      )

      if (requestSequence !== habitLoadSequence) return
      set({
        error: null,
        habits,
        isLoaded: true,
        logs,
        occurrences: derived.occurrences,
        statistics: derived.statistics,
        versions,
      })
    } catch (error) {
      if (requestSequence === habitLoadSequence) {
        set({ error: getErrorMessage(error, 'No se pudieron cargar los hábitos.') })
      }
    } finally {
      if (requestSequence === habitLoadSequence) set({ isLoading: false })
    }
  },

  loadNotes: async (habitId, force = false) => {
    if (get().notesLoaded && !force) return
    set({ error: null, isLoading: true })
    try {
      const notes = await listHabitNotes(habitId)
      set({ error: null, isLoading: false, notes, notesLoaded: true })
    } catch (error) {
      set({
        error: getErrorMessage(error, 'No se pudieron cargar las notas de hábitos.'),
        isLoading: false,
      })
    }
  },

  createHabit: async (input) => {
    set({ error: null, isSaving: true })
    try {
      const habit = await createHabit(input)
      await get().loadRange(get().range, true)
      return habit
    } catch (error) {
      set({ error: getErrorMessage(error, 'No se pudo crear el hábito.') })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  updateHabit: async (id, input) => {
    set({ error: null, isSaving: true })
    try {
      const habit = await updateHabit(id, input)
      await get().loadRange(get().range, true)
      return habit
    } catch (error) {
      set({ error: getErrorMessage(error, 'No se pudo actualizar el hábito.') })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  updateLifecycle: async (id, status) => {
    set({ error: null, isSaving: true })
    try {
      const habit = await updateHabitLifecycle(id, status)
      await get().loadRange(get().range, true)
      return habit
    } catch (error) {
      set({
        error: getErrorMessage(error, 'No se pudo actualizar el estado del hábito.'),
      })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  updateScheduleVersion: async (input) => {
    set({ error: null, isSaving: true })
    try {
      const version = await updateHabitScheduleVersion(input)
      await get().loadRange(get().range, true)
      return version
    } catch (error) {
      set({ error: getErrorMessage(error, 'No se pudo guardar la regla futura.') })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  saveLog: async (input) => {
    set({ error: null, isSaving: true })
    try {
      const log = await saveHabitLog(input)
      await get().loadRange(get().range, true)
      return log
    } catch (error) {
      set({
        error: getErrorMessage(error, 'No se pudo guardar el registro del hábito.'),
      })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  deleteLog: async (id) => {
    set({ error: null, isSaving: true })
    try {
      await deleteHabitLog(id)
      await get().loadRange(get().range, true)
      return true
    } catch (error) {
      set({
        error: getErrorMessage(error, 'No se pudo quitar el registro del hábito.'),
      })
      return false
    } finally {
      set({ isSaving: false })
    }
  },

  createNote: async (input) => {
    set({ error: null, isSaving: true })
    try {
      const note = await createHabitNote(input)
      await get().loadNotes(input.habitId, true)
      return note
    } catch (error) {
      set({ error: getErrorMessage(error, 'No se pudo crear la nota del hábito.') })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  updateNote: async (id, input) => {
    set({ error: null, isSaving: true })
    try {
      const note = await updateHabitNote(id, input)
      await get().loadNotes(undefined, true)
      return note
    } catch (error) {
      set({
        error: getErrorMessage(error, 'No se pudo actualizar la nota del hábito.'),
      })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  deleteNote: async (id) => {
    set({ error: null, isSaving: true })
    try {
      await deleteHabitNote(id)
      await get().loadNotes(undefined, true)
      return true
    } catch (error) {
      set({ error: getErrorMessage(error, 'No se pudo eliminar la nota del hábito.') })
      return false
    } finally {
      set({ isSaving: false })
    }
  },

  setView: (view) => set({ view }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setRange: (range) => set({ range, selectedDate: range.startDate }),
  setIncludeArchived: (includeArchived) => {
    habitLoadSequence += 1
    set({ includeArchived, isLoaded: false })
  },
  setSearch: (search) => set({ search }),
  clearError: () => set({ error: null }),
  reset: () => {
    habitLoadSequence += 1
    const today = getTodayDate()
    set({
      habits: [],
      versions: [],
      logs: [],
      occurrences: [],
      statistics: [],
      notes: [],
      view: 'today',
      selectedDate: today,
      range: { startDate: today, endDate: today },
      isLoaded: false,
      isLoading: false,
      isSaving: false,
      error: null,
      notesLoaded: false,
      includeArchived: false,
      search: '',
    })
  },
}))

export function getPreviousDate(value: string): string {
  return shiftDateKey(value, -1)
}

export function getNextDate(value: string): string {
  return shiftDateKey(value, 1)
}
