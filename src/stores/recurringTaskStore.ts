import { create } from 'zustand'
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
  updateRecurringTaskScheduleVersion,
  updateRecurringTaskLifecycle,
} from '../services/habitService.ts'
import type {
  RecurringTaskInput,
  RecurringTaskPatch,
  RecurringTaskScheduleVersionInput,
} from '../services/habitValidation.ts'
import { toAppError } from '../services/errors.ts'

interface RecurringTaskState {
  tasks: RecurringTask[]
  occurrences: RecurringTaskOccurrence[]
  scheduleVersions: RecurringTaskScheduleVersion[]
  isLoaded: boolean
  isLoading: boolean
  isSaving: boolean
  error: string | null
  includeArchived: boolean
  load: (force?: boolean) => Promise<void>
  createTask: (input: RecurringTaskInput) => Promise<RecurringTask | null>
  updateTask: (id: string, input: RecurringTaskPatch) => Promise<RecurringTask | null>
  updateScheduleVersion: (
    input: RecurringTaskScheduleVersionInput,
  ) => Promise<RecurringTaskScheduleVersion | null>
  completeTask: (id: string, dueDate: string) => Promise<RecurringTask | null>
  rescheduleTask: (
    id: string,
    dueDate: string,
    rescheduledTo: string,
  ) => Promise<RecurringTask | null>
  updateLifecycle: (
    id: string,
    status: RecurringTask['status'],
  ) => Promise<RecurringTask | null>
  setIncludeArchived: (includeArchived: boolean) => void
  clearError: () => void
  reset: () => void
}

let taskLoadSequence = 0

function getErrorMessage(error: unknown, fallback: string): string {
  return toAppError(error, fallback).message
}

export const useRecurringTaskStore = create<RecurringTaskState>((set, get) => ({
  tasks: [],
  occurrences: [],
  scheduleVersions: [],
  isLoaded: false,
  isLoading: false,
  isSaving: false,
  error: null,
  includeArchived: false,

  load: async (force = false) => {
    if (!force && (get().isLoaded || get().isLoading)) return
    const requestSequence = ++taskLoadSequence
    set({ error: null, isLoading: true })
    try {
      const tasks = await listRecurringTasks(get().includeArchived)
      const occurrences = await listRecurringTaskOccurrences()
      const scheduleVersions = await listRecurringTaskScheduleVersions()
      if (requestSequence !== taskLoadSequence) return
      set({
        error: null,
        isLoaded: true,
        isLoading: false,
        occurrences,
        scheduleVersions,
        tasks,
      })
    } catch (error) {
      if (requestSequence === taskLoadSequence) {
        set({
          error: getErrorMessage(
            error,
            'No se pudieron cargar las tareas recurrentes.',
          ),
        })
      }
    } finally {
      if (requestSequence === taskLoadSequence) set({ isLoading: false })
    }
  },

  createTask: async (input) => {
    set({ error: null, isSaving: true })
    try {
      const task = await createRecurringTask(input)
      await get().load(true)
      return task
    } catch (error) {
      set({ error: getErrorMessage(error, 'No se pudo crear la tarea recurrente.') })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  updateTask: async (id, input) => {
    set({ error: null, isSaving: true })
    try {
      const task = await updateRecurringTask(id, input)
      await get().load(true)
      return task
    } catch (error) {
      set({
        error: getErrorMessage(error, 'No se pudo actualizar la tarea recurrente.'),
      })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  updateScheduleVersion: async (input) => {
    set({ error: null, isSaving: true })
    try {
      const version = await updateRecurringTaskScheduleVersion(input)
      await get().load(true)
      return version
    } catch (error) {
      set({
        error: getErrorMessage(
          error,
          'No se pudo guardar la regla futura de la tarea recurrente.',
        ),
      })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  completeTask: async (id, dueDate) => {
    set({ error: null, isSaving: true })
    try {
      const task = await completeRecurringTask(id, dueDate)
      await get().load(true)
      return task
    } catch (error) {
      set({
        error: getErrorMessage(error, 'No se pudo completar la tarea recurrente.'),
      })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  rescheduleTask: async (id, dueDate, rescheduledTo) => {
    set({ error: null, isSaving: true })
    try {
      const task = await rescheduleRecurringTask(id, dueDate, rescheduledTo)
      await get().load(true)
      return task
    } catch (error) {
      set({
        error: getErrorMessage(error, 'No se pudo reprogramar la tarea recurrente.'),
      })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  updateLifecycle: async (id, status) => {
    set({ error: null, isSaving: true })
    try {
      const task = await updateRecurringTaskLifecycle(id, status)
      await get().load(true)
      return task
    } catch (error) {
      set({
        error: getErrorMessage(error, 'No se pudo actualizar el estado de la tarea.'),
      })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  setIncludeArchived: (includeArchived) => set({ includeArchived, isLoaded: false }),
  clearError: () => set({ error: null }),
  reset: () => {
    taskLoadSequence += 1
    set({
      tasks: [],
      occurrences: [],
      scheduleVersions: [],
      isLoaded: false,
      isLoading: false,
      isSaving: false,
      error: null,
      includeArchived: false,
    })
  },
}))
