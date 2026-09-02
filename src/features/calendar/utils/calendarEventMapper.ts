import type { EventInput } from '@fullcalendar/core'
import type { CalendarEvent, PersonalGroup, Subject } from '../../../types/domain.ts'

export interface CalendarEventCatalog {
  subjects: Pick<Subject, 'id' | 'color'>[]
  personalGroups: Pick<PersonalGroup, 'id' | 'color'>[]
}

const FALLBACK_EVENT_COLOR = '#5E6B65'
const EVENT_STATUS_LABELS: Record<CalendarEvent['status'], string> = {
  completed: 'Completado',
  pending: 'Pendiente',
}

function getEventColor(event: CalendarEvent, catalog: CalendarEventCatalog): string {
  if (event.kind === 'academic') {
    return (
      catalog.subjects.find((subject) => subject.id === event.subjectId)?.color ??
      FALLBACK_EVENT_COLOR
    )
  }

  return (
    catalog.personalGroups.find((group) => group.id === event.personalGroupId)?.color ??
    FALLBACK_EVENT_COLOR
  )
}

function getReadableTextColor(backgroundColor: string): string {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(backgroundColor)

  if (!match) {
    return '#FFFFFF'
  }

  const channels = [0, 2, 4].map(
    (offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255,
  )
  const luminance = channels.reduce(
    (total, channel, index) =>
      total +
      (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) *
        [0.2126, 0.7152, 0.0722][index],
    0,
  )
  const whiteContrast = (1 + 0.05) / (luminance + 0.05)
  const blackContrast = (luminance + 0.05) / 0.05

  return blackContrast >= whiteContrast ? '#000000' : '#FFFFFF'
}

function getNextCalendarDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  const nextDate = new Date(Date.UTC(year, month - 1, day + 1))

  return [
    nextDate.getUTCFullYear(),
    String(nextDate.getUTCMonth() + 1).padStart(2, '0'),
    String(nextDate.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export function mapDomainEventToCalendarEvent(
  event: CalendarEvent,
  catalog: CalendarEventCatalog,
): EventInput {
  const statusLabel = EVENT_STATUS_LABELS[event.status]
  const eventColor = getEventColor(event, catalog)

  return {
    allDay: event.isAllDay,
    backgroundColor: eventColor,
    borderColor: eventColor,
    classNames: ['calendar-event', `calendar-event-${event.status}`],
    end:
      event.isAllDay && event.endAt
        ? getNextCalendarDate(event.endAt)
        : (event.endAt ?? undefined),
    extendedProps: {
      description: event.description,
      eventKind: event.kind,
      location: event.location,
      personalGroupId: event.personalGroupId,
      status: event.status,
      statusLabel,
      subjectId: event.subjectId,
    },
    id: event.id,
    start: event.startAt,
    textColor: getReadableTextColor(eventColor),
    title: `${event.title} (${statusLabel})`,
  }
}

export function mapDomainEventsToCalendarEvents(
  events: CalendarEvent[],
  catalog: CalendarEventCatalog,
): EventInput[] {
  return events.map((event) => mapDomainEventToCalendarEvent(event, catalog))
}
