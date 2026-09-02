import type {
  CalendarDisplayItem,
  PersonalGroup,
  CalendarEvent,
  Subject,
} from '../../../types/domain.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { EmptyState } from '../../../components/ui/EmptyState.tsx'
import { getLocalDateKey } from '../../../lib/dates/dateUtils.ts'

interface AgendaViewProps {
  events: CalendarEvent[]
  displayItems?: CalendarDisplayItem[]
  hasFilters: boolean
  onClearFilters: () => void
  onSelect: (event: CalendarEvent) => void
  onSelectDisplayItem?: (item: CalendarDisplayItem) => void
  personalGroups: Pick<PersonalGroup, 'color' | 'id' | 'name'>[]
  startDate?: string
  subjects: Pick<Subject, 'abbreviation' | 'color' | 'id' | 'name'>[]
}

const agendaDateFormatter = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
})
const agendaTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  hour: 'numeric',
  minute: '2-digit',
})
const fallbackColor = '#5E6B65'

function getTodayKey(): string {
  return getLocalDateKey(new Date().toISOString())
}

function getEventSortValue(event: CalendarEvent): number {
  if (event.isAllDay) {
    return Date.parse(`${getLocalDateKey(event.startAt, true)}T00:00:00`)
  }

  return Date.parse(event.startAt)
}

function formatDateHeading(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)

  if (!year || !month || !day) {
    return dateKey
  }

  return agendaDateFormatter.format(new Date(year, month - 1, day))
}

function formatTime(value: string): string {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : agendaTimeFormatter.format(date)
}

function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) {
    return event.endAt
      ? `Todo el día, hasta ${event.endAt.slice(0, 10)}`
      : 'Todo el día'
  }

  const start = formatTime(event.startAt)
  const end = event.endAt ? ` a ${formatTime(event.endAt)}` : ''

  return `${start}${end}`
}

function getEventRelation(
  event: CalendarEvent,
  subjects: Pick<Subject, 'abbreviation' | 'id' | 'name'>[],
  personalGroups: Pick<PersonalGroup, 'id' | 'name'>[],
): string {
  if (event.kind === 'academic') {
    const subject = subjects.find((item) => item.id === event.subjectId)

    return subject
      ? `${subject.name} (${subject.abbreviation})`
      : 'Asignatura no disponible'
  }

  const personalGroup = personalGroups.find((item) => item.id === event.personalGroupId)

  return personalGroup?.name ?? 'Sin grupo personal'
}

function getEventColor(
  event: CalendarEvent,
  subjects: Pick<Subject, 'color' | 'id'>[],
  personalGroups: Pick<PersonalGroup, 'color' | 'id'>[],
): string {
  if (event.kind === 'academic') {
    return subjects.find((item) => item.id === event.subjectId)?.color ?? fallbackColor
  }

  return (
    personalGroups.find((item) => item.id === event.personalGroupId)?.color ??
    fallbackColor
  )
}

function groupUpcomingEvents(
  events: CalendarEvent[],
  startDate = getTodayKey(),
): Map<string, CalendarEvent[]> {
  const groupedEvents = new Map<string, CalendarEvent[]>()

  for (const event of events) {
    const eventStartKey = getLocalDateKey(event.startAt, event.isAllDay)
    const eventEndKey = event.endAt
      ? getLocalDateKey(event.endAt, event.isAllDay)
      : eventStartKey

    if (eventEndKey < startDate) {
      continue
    }

    const dateKey = eventStartKey < startDate ? startDate : eventStartKey
    const currentEvents = groupedEvents.get(dateKey) ?? []
    currentEvents.push(event)
    groupedEvents.set(dateKey, currentEvents)
  }

  for (const currentEvents of groupedEvents.values()) {
    currentEvents.sort(
      (left, right) =>
        getEventSortValue(left) - getEventSortValue(right) ||
        left.id.localeCompare(right.id),
    )
  }

  return new Map(
    [...groupedEvents.entries()].sort(([left], [right]) => left.localeCompare(right)),
  )
}

function groupDisplayItems(
  items: CalendarDisplayItem[],
  startDate = getTodayKey(),
): Map<string, CalendarDisplayItem[]> {
  const groupedItems = new Map<string, CalendarDisplayItem[]>()

  for (const item of items) {
    if (item.startDate < startDate) continue
    const currentItems = groupedItems.get(item.startDate) ?? []
    currentItems.push(item)
    groupedItems.set(item.startDate, currentItems)
  }

  return new Map(
    [...groupedItems.entries()].sort(([left], [right]) => left.localeCompare(right)),
  )
}

export function AgendaView({
  events,
  displayItems = [],
  hasFilters,
  onClearFilters,
  onSelect,
  onSelectDisplayItem,
  personalGroups,
  startDate,
  subjects,
}: AgendaViewProps) {
  const groupedEvents = groupUpcomingEvents(events, startDate)
  const groupedDisplayItems = groupDisplayItems(displayItems, startDate)
  const visibleEventCount = [...groupedEvents.values()].reduce(
    (count, dateEvents) => count + dateEvents.length,
    0,
  )
  const visibleDisplayItemCount = [...groupedDisplayItems.values()].reduce(
    (count, dateItems) => count + dateItems.length,
    0,
  )
  const visibleItemCount = visibleEventCount + visibleDisplayItemCount

  if (groupedEvents.size === 0 && groupedDisplayItems.size === 0) {
    return (
      <section aria-labelledby="agenda-title">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink" id="agenda-title">
              Agenda
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Tus próximos compromisos.</p>
          </div>
          {hasFilters ? (
            <Button onClick={onClearFilters} variant="secondary">
              Limpiar filtros
            </Button>
          ) : null}
        </div>
        <EmptyState
          description={
            hasFilters
              ? 'Prueba con otra búsqueda o cambia los filtros activos.'
              : 'Crea un evento para verlo aquí desde hoy en adelante.'
          }
          title={hasFilters ? 'No hay coincidencias' : 'No tienes eventos próximos'}
        />
      </section>
    )
  }

  return (
    <section aria-labelledby="agenda-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink" id="agenda-title">
            Agenda
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {visibleItemCount}{' '}
            {visibleItemCount === 1 ? 'evento visible' : 'eventos visibles'} desde{' '}
            {formatDateHeading(startDate ?? getTodayKey())}.
          </p>
        </div>
        {hasFilters ? (
          <Button onClick={onClearFilters} variant="secondary">
            Limpiar filtros
          </Button>
        ) : null}
      </div>

      <div className="space-y-6">
        {[...groupedEvents.entries()].map(([dateKey, dateEvents]) => (
          <section aria-labelledby={`agenda-date-${dateKey}`} key={dateKey}>
            <h3
              className="mb-3 border-b border-border pb-2 text-sm font-bold capitalize text-ink"
              id={`agenda-date-${dateKey}`}
            >
              {formatDateHeading(dateKey)}
            </h3>
            <div className="overflow-hidden rounded-panel border border-border bg-surface">
              <ul className="divide-y divide-border">
                {dateEvents.map((event) => {
                  const eventColor = getEventColor(event, subjects, personalGroups)
                  const statusLabel =
                    event.status === 'completed' ? 'Completado' : 'Pendiente'

                  return (
                    <li key={event.id}>
                      <button
                        aria-label={`Abrir ${event.title}`}
                        className="flex min-h-16 w-full touch-manipulation items-start gap-3 px-4 py-4 text-left transition-colors duration-state focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft hover:bg-surface-subtle focus-visible:bg-surface-subtle sm:px-5"
                        onClick={() => onSelect(event)}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1.5 size-3 shrink-0 rounded-full ring-4 ring-surface-strong"
                          style={{ backgroundColor: eventColor }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="break-words font-semibold text-ink">
                              {event.title}
                            </span>
                            <span
                              className={
                                event.status === 'completed'
                                  ? 'rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success'
                                  : 'rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning'
                              }
                            >
                              {statusLabel}
                            </span>
                          </span>
                          <span className="mt-1 block text-sm text-ink-muted">
                            {formatEventTime(event)} ·{' '}
                            {getEventRelation(event, subjects, personalGroups)}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>
        ))}
        {[...groupedDisplayItems.entries()].map(([dateKey, dateItems]) => (
          <section aria-labelledby={`agenda-display-date-${dateKey}`} key={`display-${dateKey}`}>
            <h3
              className="mb-3 border-b border-border pb-2 text-sm font-bold capitalize text-ink"
              id={`agenda-display-date-${dateKey}`}
            >
              {formatDateHeading(dateKey)}
            </h3>
            <div className="overflow-hidden rounded-panel border border-brand/20 bg-brand-soft/20">
              <ul className="divide-y divide-brand/20">
                {dateItems.map((item) => (
                  <li key={item.id}>
                    <button
                      aria-label={`Abrir ${item.title}`}
                      className="flex min-h-16 w-full touch-manipulation items-start gap-3 px-4 py-4 text-left transition-colors duration-state focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft hover:bg-surface focus-visible:bg-surface sm:px-5"
                      onClick={() => onSelectDisplayItem?.(item)}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1.5 size-3 shrink-0 rounded-full ring-4 ring-surface-strong"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="break-words font-semibold text-ink">{item.title}</span>
                          <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-brand">{item.statusLabel}</span>
                        </span>
                        <span className="mt-1 block text-sm text-ink-muted">
                          Todo el día · {item.source === 'habit_occurrence' ? 'Hábito' : 'Tarea recurrente'} · Solo lectura
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
