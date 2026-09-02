import { create } from 'zustand'
import type { CalendarEvent, EventKind, EventStatus } from '../types/domain.ts'
import {
  createEvent,
  deleteEvent,
  listEvents,
  listUpcomingEvents,
  updateEvent,
  updateEventStatus,
} from '../services/eventService.ts'
import { toAppError } from '../services/errors.ts'
import type { EventInput, EventPatch, EventRange } from '../services/validation.ts'
import {
  emptyCalendarFilters,
  type CalendarFilterArrayKey,
  type CalendarFilters,
} from '../features/calendar/utils/eventFilters.ts'

export type CalendarView = 'agenda' | 'day' | 'month' | 'week'
type FilterValue = EventKind | EventStatus | string

interface CalendarState {
  events: CalendarEvent[]
  view: CalendarView
  filters: CalendarFilters
  visibleRange: EventRange | null
  agendaStartAt: string | null
  isLoaded: boolean
  isLoading: boolean
  isSaving: boolean
  error: string | null
  loadedRangeKey: string | null
  loadingRangeKey: string | null
  load: (range: EventRange, force?: boolean) => Promise<void>
  loadAgenda: (startAt: string, force?: boolean) => Promise<void>
  refresh: () => Promise<void>
  createEvent: (input: EventInput) => Promise<CalendarEvent | null>
  updateEvent: (id: string, input: EventPatch) => Promise<CalendarEvent | null>
  deleteEvent: (id: string) => Promise<boolean>
  updateEventStatus: (id: string, status: EventStatus) => Promise<CalendarEvent | null>
  setView: (view: CalendarView) => void
  setSearch: (search: string) => void
  setFilters: (filters: Partial<CalendarFilters>) => void
  toggleFilterValue: (key: CalendarFilterArrayKey, value: FilterValue) => void
  clearFilters: () => void
  clearError: () => void
  reset: () => void
}

let calendarLoadSequence = 0

function getRangeKey(range: EventRange): string {
  return `${range.startAt}|${range.endAt}`
}

function getErrorMessage(error: unknown, fallback: string): string {
  return toAppError(error, fallback).message
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: [],
  view: 'month',
  filters: { ...emptyCalendarFilters },
  visibleRange: null,
  agendaStartAt: null,
  isLoaded: false,
  isLoading: false,
  isSaving: false,
  error: null,
  loadedRangeKey: null,
  loadingRangeKey: null,

  load: async (range, force = false) => {
    const rangeKey = getRangeKey(range)
    const state = get()

    if (
      !force &&
      (state.loadedRangeKey === rangeKey ||
        (state.isLoading && state.loadingRangeKey === rangeKey))
    ) {
      return
    }

    const requestSequence = ++calendarLoadSequence
    set({
      agendaStartAt: null,
      error: null,
      isLoading: true,
      loadingRangeKey: rangeKey,
      visibleRange: range,
    })

    try {
      const events = await listEvents(range)

      if (requestSequence !== calendarLoadSequence) {
        return
      }

      set({
        error: null,
        events,
        isLoaded: true,
        loadedRangeKey: rangeKey,
      })
    } catch (error) {
      if (requestSequence === calendarLoadSequence) {
        set({ error: getErrorMessage(error, 'No se pudieron cargar los eventos.') })
      }
    } finally {
      if (requestSequence === calendarLoadSequence) {
        set({ isLoading: false, loadingRangeKey: null })
      }
    }
  },

  loadAgenda: async (startAt, force = false) => {
    const rangeKey = `agenda|${startAt}`
    const state = get()

    if (
      !force &&
      (state.loadedRangeKey === rangeKey ||
        (state.isLoading && state.loadingRangeKey === rangeKey))
    ) {
      return
    }

    const requestSequence = ++calendarLoadSequence
    set({
      agendaStartAt: startAt,
      error: null,
      isLoading: true,
      loadingRangeKey: rangeKey,
      visibleRange: null,
    })

    try {
      const events = await listUpcomingEvents(startAt)

      if (requestSequence !== calendarLoadSequence) {
        return
      }

      set({
        error: null,
        events,
        isLoaded: true,
        loadedRangeKey: rangeKey,
      })
    } catch (error) {
      if (requestSequence === calendarLoadSequence) {
        set({
          error: getErrorMessage(error, 'No se pudieron cargar los próximos eventos.'),
        })
      }
    } finally {
      if (requestSequence === calendarLoadSequence) {
        set({ isLoading: false, loadingRangeKey: null })
      }
    }
  },

  refresh: async () => {
    const agendaStartAt = get().agendaStartAt
    const range = get().visibleRange

    if (agendaStartAt) {
      await get().loadAgenda(agendaStartAt, true)
    } else if (range) {
      await get().load(range, true)
    }
  },

  createEvent: async (input) => {
    set({ error: null, isSaving: true })

    try {
      const event = await createEvent(input)
      await get().refresh()
      return event
    } catch (error) {
      set({ error: getErrorMessage(error, 'No se pudo crear el evento.') })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  updateEvent: async (id, input) => {
    set({ error: null, isSaving: true })

    try {
      const event = await updateEvent(id, input)
      await get().refresh()
      return event
    } catch (error) {
      set({ error: getErrorMessage(error, 'No se pudo actualizar el evento.') })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  deleteEvent: async (id) => {
    set({ error: null, isSaving: true })

    try {
      await deleteEvent(id)
      await get().refresh()
      return true
    } catch (error) {
      set({ error: getErrorMessage(error, 'No se pudo eliminar el evento.') })
      return false
    } finally {
      set({ isSaving: false })
    }
  },

  updateEventStatus: async (id, status) => {
    set({ error: null, isSaving: true })

    try {
      const event = await updateEventStatus(id, status)
      await get().refresh()
      return event
    } catch (error) {
      set({ error: getErrorMessage(error, 'No se pudo actualizar el estado.') })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  setView: (view) => set({ view }),

  setSearch: (search) => set((state) => ({ filters: { ...state.filters, search } })),

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  toggleFilterValue: (key, value) =>
    set((state) => {
      const currentValues = state.filters[key] as string[]
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value]

      return { filters: { ...state.filters, [key]: nextValues } }
    }),

  clearFilters: () => set({ filters: { ...emptyCalendarFilters } }),

  clearError: () => set({ error: null }),

  reset: () => {
    calendarLoadSequence += 1
    set({
      events: [],
      view: 'month',
      filters: { ...emptyCalendarFilters },
      visibleRange: null,
      agendaStartAt: null,
      isLoaded: false,
      isLoading: false,
      isSaving: false,
      error: null,
      loadedRangeKey: null,
      loadingRangeKey: null,
    })
  },
}))
