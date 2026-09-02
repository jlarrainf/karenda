import { useEffect, useRef, useState } from 'react'
import dayGridPlugin from '@fullcalendar/daygrid'
import spanishLocale from '@fullcalendar/core/locales/es'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import type {
  CalendarDisplayItem,
  CalendarEvent,
  EventKind,
  EventStatus,
  PersonalGroup,
  Subject,
} from '../../../types/domain.ts'
import type { AiEventDraft } from '../../../types/aiEvents.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { TextField } from '../../../components/ui/FormField.tsx'
import { useCalendarStore, type CalendarView } from '../../../stores/calendarStore.ts'
import { useCatalogStore } from '../../../stores/catalogStore.ts'
import { useHabitStore } from '../../../stores/habitStore.ts'
import { useRecurringTaskStore } from '../../../stores/recurringTaskStore.ts'
import { eventInputSchema, type EventInput } from '../../../services/validation.ts'
import {
  countActiveCalendarFilters,
  filterCalendarEvents,
  hasActiveCalendarFilters,
  type CalendarFilters,
} from '../utils/eventFilters.ts'
import { AgendaView } from './AgendaView.tsx'
import { CalendarFiltersPanel } from './CalendarFiltersPanel.tsx'
import { CalendarViewSelector } from './CalendarViewSelector.tsx'
import { EventDetail } from './EventDetail.tsx'
import { EventForm } from './EventForm.tsx'
import {
  AiEventPromptPanel,
  type AiEventSaveResult,
} from './AiEventPromptPanel.tsx'
import {
  mapDomainEventsToCalendarEvents,
  mapDisplayItemsToCalendarEvents,
  type CalendarEventCatalog,
} from '../utils/calendarEventMapper.ts'
import { getCalendarDisplayItems } from '../utils/calendarDisplayProjection.ts'
import { CalendarDisplayDetail } from './CalendarDisplayDetail.tsx'
import { getLocalDateKey, shiftDateKey } from '../../../lib/dates/dateUtils.ts'

interface CalendarPageProps {
  events?: CalendarEvent[]
  isEventSaving?: boolean
  onDeleteEvent?: (event: CalendarEvent) => Promise<void>
  onEditEvent?: (event: CalendarEvent) => void
  onToggleEventStatus?: (event: CalendarEvent) => Promise<void>
  personalGroups?: Pick<PersonalGroup, 'id' | 'color' | 'name'>[]
  subjects?: Pick<Subject, 'abbreviation' | 'code' | 'id' | 'color' | 'name'>[]
}

function getTodayDateValue(): string {
  return getLocalDateKey(new Date().toISOString())
}

function getFullCalendarView(view: CalendarView): string | null {
  if (view === 'month') {
    return 'dayGridMonth'
  }

  if (view === 'week') {
    return 'timeGridWeek'
  }

  if (view === 'day') {
    return 'timeGridDay'
  }

  return null
}

function getCalendarView(viewType: string): CalendarView | null {
  if (viewType === 'dayGridMonth') {
    return 'month'
  }

  if (viewType === 'timeGridWeek') {
    return 'week'
  }

  if (viewType === 'timeGridDay') {
    return 'day'
  }

  return null
}

export function CalendarPage({
  events,
  isEventSaving = false,
  onDeleteEvent,
  onEditEvent,
  onToggleEventStatus,
  personalGroups,
  subjects,
}: CalendarPageProps) {
  const storeEvents = useCalendarStore((state) => state.events)
  const calendarView = useCalendarStore((state) => state.view)
  const filters = useCalendarStore((state) => state.filters)
  const calendarIsLoaded = useCalendarStore((state) => state.isLoaded)
  const calendarIsLoading = useCalendarStore((state) => state.isLoading)
  const calendarIsSaving = useCalendarStore((state) => state.isSaving)
  const calendarError = useCalendarStore((state) => state.error)
  const agendaStartAt = useCalendarStore((state) => state.agendaStartAt)
  const loadEvents = useCalendarStore((state) => state.load)
  const loadAgenda = useCalendarStore((state) => state.loadAgenda)
  const refreshEvents = useCalendarStore((state) => state.refresh)
  const createEvent = useCalendarStore((state) => state.createEvent)
  const updateEvent = useCalendarStore((state) => state.updateEvent)
  const deleteEvent = useCalendarStore((state) => state.deleteEvent)
  const updateEventStatus = useCalendarStore((state) => state.updateEventStatus)
  const setCalendarView = useCalendarStore((state) => state.setView)
  const setSearch = useCalendarStore((state) => state.setSearch)
  const setFilters = useCalendarStore((state) => state.setFilters)
  const toggleFilterValue = useCalendarStore((state) => state.toggleFilterValue)
  const clearFilters = useCalendarStore((state) => state.clearFilters)
  const clearCalendarError = useCalendarStore((state) => state.clearError)
  const habitOccurrences = useHabitStore((state) => state.occurrences)
  const habitLogs = useHabitStore((state) => state.logs)
  const habitScheduleVersions = useHabitStore((state) => state.versions)
  const habits = useHabitStore((state) => state.habits)
  const habitError = useHabitStore((state) => state.error)
  const habitIsLoading = useHabitStore((state) => state.isLoading)
  const habitRange = useHabitStore((state) => state.range)
  const loadHabitRange = useHabitStore((state) => state.loadRange)
  const clearHabitError = useHabitStore((state) => state.clearError)
  const recurringTasks = useRecurringTaskStore((state) => state.tasks)
  const recurringTaskError = useRecurringTaskStore((state) => state.error)
  const recurringTaskIsLoading = useRecurringTaskStore((state) => state.isLoading)
  const loadRecurringTasks = useRecurringTaskStore((state) => state.load)
  const clearRecurringTaskError = useRecurringTaskStore((state) => state.clearError)
  const storeSubjects = useCatalogStore((state) => state.subjects)
  const storePersonalGroups = useCatalogStore((state) => state.personalGroups)
  const createPersonalGroup = useCatalogStore((state) => state.createPersonalGroup)
  const catalogError = useCatalogStore((state) => state.error)
  const loadCatalog = useCatalogStore((state) => state.load)
  const resolvedEvents = events ?? storeEvents
  const resolvedSubjects = subjects ?? storeSubjects
  const resolvedPersonalGroups = personalGroups ?? storePersonalGroups
  const filteredEvents = filterCalendarEvents(
    resolvedEvents,
    filters,
    resolvedSubjects,
    resolvedPersonalGroups,
  )
  const catalog: CalendarEventCatalog = {
    personalGroups: resolvedPersonalGroups,
    subjects: resolvedSubjects,
  }
  const calendarDisplayItems: CalendarDisplayItem[] =
    events === undefined
      ? getCalendarDisplayItems({
          habits,
          habitLogs,
          habitOccurrences,
          habitScheduleVersions,
          rangeEnd: habitRange.endDate,
          rangeStart: habitRange.startDate,
          recurringTasks,
          today: getTodayDateValue(),
        })
      : []
  const calendarEvents = [
    ...mapDomainEventsToCalendarEvents(filteredEvents, catalog),
    ...mapDisplayItemsToCalendarEvents(calendarDisplayItems),
  ]
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedDisplayItemId, setSelectedDisplayItemId] = useState<string | null>(null)
  const [formKind, setFormKind] = useState<EventKind | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [isAiPromptOpen, setIsAiPromptOpen] = useState(false)
  const [areFiltersOpen, setAreFiltersOpen] = useState(false)
  const [localAgendaStartDate, setLocalAgendaStartDate] = useState(getTodayDateValue)
  const calendarRef = useRef<FullCalendar | null>(null)
  const selectedEvent =
    filteredEvents.find((event) => event.id === selectedEventId) ?? null
  const selectedDisplayItem =
    calendarDisplayItems.find((item) => item.id === selectedDisplayItemId) ?? null
  const selectedCalendarEvent = calendarEvents.find(
    (event) => event.id === selectedEventId,
  )
  const selectedEventColor =
    typeof selectedCalendarEvent?.backgroundColor === 'string'
      ? selectedCalendarEvent.backgroundColor
      : '#5E6B65'
  const isFormOpen = formKind !== null
  const isSaving = isEventSaving || calendarIsSaving
  const projectionIsLoading =
    events === undefined && (habitIsLoading || recurringTaskIsLoading)
  const projectionError = events === undefined ? habitError ?? recurringTaskError : null
  const visibleCalendarItemCount = filteredEvents.length + calendarDisplayItems.length
  const activeFilterCount = countActiveCalendarFilters(filters)
  const hasFilters = hasActiveCalendarFilters(filters)
  const resolvedAgendaStartDate = agendaStartAt ?? localAgendaStartDate

  const normalizeGroupName = (value: string): string =>
    value
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()

  useEffect(() => {
    if (events === undefined) {
      void loadCatalog()
    }
  }, [events, loadCatalog])

  useEffect(() => {
    if (events !== undefined) return

    const startDate = getTodayDateValue()
    void loadHabitRange({ startDate, endDate: shiftDateKey(startDate, 90) })
    void loadRecurringTasks()
  }, [events, loadHabitRange, loadRecurringTasks])

  useEffect(() => {
    if (events === undefined && calendarView === 'agenda') {
      void loadAgenda(resolvedAgendaStartDate)
    }
  }, [calendarView, events, loadAgenda, resolvedAgendaStartDate])

  const handleViewChange = (view: CalendarView) => {
    clearCalendarError()
    setSelectedEventId(null)
    setSelectedDisplayItemId(null)
    setCalendarView(view)

    const fullCalendarView = getFullCalendarView(view)

    if (fullCalendarView) {
      calendarRef.current?.getApi().changeView(fullCalendarView)
      return
    }

    if (events === undefined) {
      void loadAgenda(getTodayDateValue())
    }
  }

  const handleAgendaNavigation = (days: number) => {
    const nextDate = shiftDateKey(resolvedAgendaStartDate, days)
    setLocalAgendaStartDate(nextDate)

    if (events === undefined) {
      void loadAgenda(nextDate, true)
    }
  }

  const handleAgendaToday = () => {
    const today = getTodayDateValue()
    setLocalAgendaStartDate(today)

    if (events === undefined) {
      void loadAgenda(today, true)
    }
  }

  const handleDateFilterChange = (field: 'endDate' | 'startDate', value: string) => {
    const nextFilters: Partial<CalendarFilters> = { [field]: value }
    setFilters(nextFilters)
  }

  const openCreateForm = (kind: EventKind) => {
    clearCalendarError()
    setIsAiPromptOpen(false)
    setSelectedEventId(null)
    setSelectedDisplayItemId(null)
    setEditingEvent(null)
    setFormKind(kind)
  }

  const closeForm = () => {
    clearCalendarError()
    setEditingEvent(null)
    setFormKind(null)
  }

  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEventId(null)

    if (onEditEvent) {
      onEditEvent(event)
      return
    }

    clearCalendarError()
    setEditingEvent(event)
    setFormKind(event.kind)
  }

  const handleSaveEvent = async (input: EventInput) => {
    const savedEvent = editingEvent
      ? await updateEvent(editingEvent.id, input)
      : await createEvent(input)

    if (savedEvent) {
      closeForm()
    }
  }

  const handleDeleteEvent = async (event: CalendarEvent) => {
    if (onDeleteEvent) {
      await onDeleteEvent(event)
      return
    }

    const deleted = await deleteEvent(event.id)

    if (!deleted) {
      throw new Error(
        useCalendarStore.getState().error ?? 'No se pudo eliminar el evento.',
      )
    }
  }

  const handleToggleEventStatus = async (event: CalendarEvent) => {
    if (onToggleEventStatus) {
      await onToggleEventStatus(event)
      return
    }

    const nextStatus: EventStatus =
      event.status === 'completed' ? 'pending' : 'completed'
    const updatedEvent = await updateEventStatus(event.id, nextStatus)

    if (!updatedEvent) {
      throw new Error(
        useCalendarStore.getState().error ?? 'No se pudo actualizar el estado.',
      )
    }
  }

  const handleSelectEvent = (event: CalendarEvent) => {
    setIsAiPromptOpen(false)
    setFormKind(null)
    setEditingEvent(null)
    setSelectedDisplayItemId(null)
    setSelectedEventId(event.id)
  }

  const handleSelectDisplayItem = (item: CalendarDisplayItem) => {
    setIsAiPromptOpen(false)
    setFormKind(null)
    setEditingEvent(null)
    setSelectedEventId(null)
    setSelectedDisplayItemId(item.id)
  }

  const openAiPrompt = () => {
    clearCalendarError()
    setSelectedEventId(null)
    setSelectedDisplayItemId(null)
    setEditingEvent(null)
    setFormKind(null)
    setIsAiPromptOpen(true)
  }

  const handleSaveAiEvents = async (drafts: AiEventDraft[]): Promise<AiEventSaveResult> => {
    const invalidDraft = drafts.find((draft) => {
      const parsed = eventInputSchema.safeParse(draft.input)
      const proposedName = draft.newPersonalGroupName?.trim() ?? ''

      return (
        !parsed.success ||
        (proposedName !== '' &&
          (draft.input.kind !== 'personal' || draft.input.personalGroupId !== null))
      )
    })

    if (invalidDraft) {
      return {
        created: 0,
        failedIndexes: drafts.map((_, index) => index),
        errorMessage: 'Revisa los borradores antes de guardarlos.',
      }
    }

    const groupIdsByName = new Map<string, string>()
    let createdGroups = 0

    for (const draft of drafts) {
      const proposedName = draft.newPersonalGroupName?.trim() ?? ''

      if (!proposedName) {
        continue
      }

      const normalizedName = normalizeGroupName(proposedName)

      if (groupIdsByName.has(normalizedName)) {
        continue
      }

      const existingGroup = resolvedPersonalGroups.find(
        (group) => normalizeGroupName(group.name) === normalizedName,
      )

      if (existingGroup) {
        groupIdsByName.set(normalizedName, existingGroup.id)
        continue
      }

      const createdGroup = await createPersonalGroup({ name: proposedName, color: null })

      if (!createdGroup) {
        const catalogErrorMessage = useCatalogStore.getState().error
        const createdGroupMessage = createdGroups
          ? ` Se crearon ${createdGroups} grupos; ningún evento de esta operación se guardó todavía.`
          : ''

        return {
          created: 0,
          createdGroups,
          failedIndexes: drafts.map((_, index) => index),
          errorMessage:
            (catalogErrorMessage ?? 'No se pudieron crear los grupos personales.') +
            createdGroupMessage,
        }
      }

      groupIdsByName.set(normalizedName, createdGroup.id)
      createdGroups += 1
    }

    const inputs = drafts.map((draft) => {
      const proposedName = draft.newPersonalGroupName?.trim() ?? ''
      const groupId = proposedName
        ? groupIdsByName.get(normalizeGroupName(proposedName))
        : undefined

      return groupId
        ? { ...draft.input, personalGroupId: groupId }
        : draft.input
    })

    const invalidInput = inputs.find((input) => !eventInputSchema.safeParse(input).success)

    if (invalidInput) {
      return {
        created: 0,
        createdGroups,
        failedIndexes: drafts.map((_, index) => index),
        errorMessage: 'Revisa los borradores antes de guardarlos.',
      }
    }

    let created = 0
    let failedIndexes: number[] = []
    let errorMessage: string | undefined

    for (let index = 0; index < inputs.length; index += 1) {
      const savedEvent = await createEvent(inputs[index]!)

      if (!savedEvent) {
        const eventError = useCalendarStore.getState().error ?? 'No se pudo guardar el evento.'
        errorMessage = createdGroups
          ? `${eventError} También se crearon ${createdGroups} grupos personales; los eventos pendientes conservan esa asociación.`
          : eventError
        failedIndexes = Array.from(
          { length: inputs.length - index },
          (_, offset) => index + offset,
        )
        break
      }

      created += 1
    }

    return { created, createdGroups, errorMessage, failedIndexes }
  }

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Tu calendario
          </h1>
          <p className="mt-3 text-base leading-7 text-ink-muted">
            Reúne tus compromisos académicos y personales en una sola vista.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => openCreateForm('academic')}>
            Nuevo evento académico
          </Button>
          <Button onClick={() => openCreateForm('personal')} variant="secondary">
            Nuevo evento personal
          </Button>
          <Button onClick={openAiPrompt} variant="secondary">
            Agregar con IA
          </Button>
        </div>
      </header>

      {calendarError || catalogError || projectionError ? (
        <div
          aria-live="assertive"
          className="rounded-control border border-danger/30 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger"
          role="alert"
        >
          {calendarError ?? catalogError ?? projectionError}
          <Button
            className="mt-3 border-danger/40 text-danger hover:bg-danger/10"
            onClick={() => {
              clearCalendarError()
              clearHabitError()
              clearRecurringTaskError()
              void refreshEvents()
              void loadCatalog(true)
              void loadHabitRange(habitRange, true)
              void loadRecurringTasks(true)
            }}
            variant="secondary"
          >
            Intentar nuevamente
          </Button>
        </div>
      ) : null}

      {!calendarIsLoaded && calendarIsLoading ? (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Cargando eventos…
        </p>
      ) : null}

      {projectionIsLoading ? (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Cargando proyecciones de hábitos…
        </p>
      ) : null}

      <div
        className={
          selectedEvent || selectedDisplayItem || isFormOpen || isAiPromptOpen
            ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]'
            : ''
        }
      >
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <TextField
                autoComplete="off"
                id="calendar-search"
                label="Buscar eventos"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Título, descripción, lugar o relación"
                type="search"
                value={filters.search}
              />
            </div>
            <Button
              aria-controls="calendar-filters"
              aria-expanded={areFiltersOpen}
              onClick={() => setAreFiltersOpen((isOpen) => !isOpen)}
              variant="secondary"
            >
              Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
            {hasFilters ? (
              <Button onClick={clearFilters} variant="ghost">
                Limpiar filtros
              </Button>
            ) : null}
          </div>

          {areFiltersOpen ? (
            <CalendarFiltersPanel
              filters={filters}
              onClear={clearFilters}
              onClose={() => setAreFiltersOpen(false)}
              onDateChange={handleDateFilterChange}
              onToggle={toggleFilterValue}
              personalGroups={resolvedPersonalGroups}
              subjects={resolvedSubjects}
            />
          ) : null}

          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              {calendarView === 'agenda' ? (
                <div
                  aria-label="Navegación de agenda"
                  className="flex flex-wrap gap-2"
                  role="group"
                >
                  <Button
                    aria-label="Ir a la agenda anterior"
                    onClick={() => handleAgendaNavigation(-7)}
                    variant="secondary"
                  >
                    Anterior
                  </Button>
                  <Button onClick={handleAgendaToday} variant="secondary">
                    Hoy
                  </Button>
                  <Button
                    aria-label="Ir a la agenda siguiente"
                    onClick={() => handleAgendaNavigation(7)}
                    variant="secondary"
                  >
                    Siguiente
                  </Button>
                </div>
              ) : null}
              <CalendarViewSelector onChange={handleViewChange} value={calendarView} />
            </div>
            <p aria-live="polite" className="text-sm text-ink-muted">
              {visibleCalendarItemCount}{' '}
              {visibleCalendarItemCount === 1 ? 'evento visible' : 'eventos visibles'}
            </p>
          </div>

          {calendarView !== 'agenda' &&
          calendarIsLoaded &&
          !calendarIsLoading &&
          visibleCalendarItemCount === 0 ? (
            <p aria-live="polite" className="text-sm text-ink-muted">
              {hasFilters
                ? 'No hay eventos que coincidan. Cambia o limpia los filtros.'
                : 'No hay eventos en este periodo. Usa una de las acciones anteriores para crear el primero.'}
            </p>
          ) : null}

          {calendarView === 'agenda' ? (
            <div className="rounded-panel border border-border bg-surface p-4 sm:p-6">
              <AgendaView
                displayItems={calendarDisplayItems}
                events={filteredEvents}
                hasFilters={hasFilters}
                onClearFilters={clearFilters}
                onSelect={handleSelectEvent}
                onSelectDisplayItem={handleSelectDisplayItem}
                personalGroups={resolvedPersonalGroups}
                startDate={resolvedAgendaStartDate}
                subjects={resolvedSubjects}
              />
            </div>
          ) : (
            <div className="calendar-panel overflow-hidden rounded-panel border border-border bg-surface p-3 sm:p-5">
              <FullCalendar
                buttonText={{ today: 'Hoy' }}
                dayMaxEvents
                datesSet={
                  events === undefined
                    ? (info) => {
                        const nextView = getCalendarView(info.view.type)

                        if (nextView) {
                          setCalendarView(nextView)
                        }

                        void loadEvents({ startAt: info.startStr, endAt: info.endStr })
                        void loadHabitRange({
                          endDate: shiftDateKey(info.endStr.slice(0, 10), -1),
                          startDate: info.startStr.slice(0, 10),
                        })
                        void loadRecurringTasks()
                      }
                    : undefined
                }
                eventClick={(info) => {
                  const displayItem = calendarDisplayItems.find((item) => item.id === info.event.id)

                  if (displayItem) {
                    handleSelectDisplayItem(displayItem)
                    return
                  }

                  const event = filteredEvents.find((item) => item.id === info.event.id)

                  if (event) {
                    handleSelectEvent(event)
                  }
                }}
                expandRows
                firstDay={1}
                headerToolbar={{
                  center: 'title',
                  left: 'prev,next today',
                  right: '',
                }}
                height="auto"
                initialDate={new Date()}
                initialView={getFullCalendarView(calendarView) ?? 'dayGridMonth'}
                locale={spanishLocale}
                locales={[spanishLocale]}
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
                ref={calendarRef}
                events={calendarEvents}
              />
            </div>
          )}
        </div>

        {isAiPromptOpen ? (
          <AiEventPromptPanel
            onCancel={() => {
              clearCalendarError()
              setIsAiPromptOpen(false)
            }}
            onSave={handleSaveAiEvents}
            personalGroups={resolvedPersonalGroups}
            subjects={resolvedSubjects}
          />
        ) : isFormOpen ? (
          <aside
            aria-label="Formulario de evento"
            className="rounded-panel border border-border bg-surface p-5 sm:p-6"
          >
            <EventForm
              event={editingEvent}
              isLoading={isSaving}
              kind={formKind}
              key={editingEvent?.id ?? `new-${formKind}`}
              onCancel={closeForm}
              onSubmit={handleSaveEvent}
              personalGroups={resolvedPersonalGroups}
              subjects={resolvedSubjects}
            />
          </aside>
        ) : selectedDisplayItem ? (
          <CalendarDisplayDetail
            item={selectedDisplayItem}
            onClose={() => setSelectedDisplayItemId(null)}
          />
        ) : selectedEvent ? (
          <EventDetail
            accentColor={selectedEventColor}
            event={selectedEvent}
            isLoading={isSaving}
            onClose={() => setSelectedEventId(null)}
            onDelete={handleDeleteEvent}
            onEdit={handleEditEvent}
            onToggleStatus={handleToggleEventStatus}
            personalGroups={resolvedPersonalGroups}
            subjects={resolvedSubjects}
          />
        ) : null}
      </div>
    </section>
  )
}
