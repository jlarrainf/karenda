import type {
  CalendarEvent,
  EventKind,
  EventStatus,
  PersonalGroup,
  Subject,
} from '../../../types/domain.ts'
import { getLocalDateKey } from '../../../lib/dates/dateUtils.ts'

export interface CalendarFilters {
  search: string
  kinds: EventKind[]
  subjectIds: string[]
  personalGroupIds: string[]
  statuses: EventStatus[]
  startDate: string
  endDate: string
}

export type CalendarFilterArrayKey =
  'kinds' | 'personalGroupIds' | 'subjectIds' | 'statuses'

export const emptyCalendarFilters: CalendarFilters = {
  search: '',
  kinds: [],
  subjectIds: [],
  personalGroupIds: [],
  statuses: [],
  startDate: '',
  endDate: '',
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim()
}

function getEventDateRange(event: CalendarEvent): { end: string; start: string } {
  return {
    end: event.endAt
      ? getLocalDateKey(event.endAt, event.isAllDay)
      : getLocalDateKey(event.startAt, event.isAllDay),
    start: getLocalDateKey(event.startAt, event.isAllDay),
  }
}

function getEventSortValue(event: CalendarEvent): number {
  if (event.isAllDay) {
    return Date.parse(`${getLocalDateKey(event.startAt, true)}T00:00:00`)
  }

  return Date.parse(event.startAt)
}

function getSearchableEventText(
  event: CalendarEvent,
  subjects: Pick<Subject, 'id' | 'name' | 'code' | 'abbreviation'>[],
  personalGroups: Pick<PersonalGroup, 'id' | 'name'>[],
): string {
  const subject = subjects.find((item) => item.id === event.subjectId)
  const personalGroup = personalGroups.find((item) => item.id === event.personalGroupId)

  return normalizeSearchText(
    [
      event.title,
      event.description ?? '',
      event.location ?? '',
      subject?.name ?? '',
      subject?.code ?? '',
      subject?.abbreviation ?? '',
      personalGroup?.name ?? '',
    ].join(' '),
  )
}

function matchesFilters(
  event: CalendarEvent,
  filters: CalendarFilters,
  subjects: Pick<Subject, 'id' | 'name' | 'code' | 'abbreviation'>[],
  personalGroups: Pick<PersonalGroup, 'id' | 'name'>[],
): boolean {
  if (filters.kinds.length > 0 && !filters.kinds.includes(event.kind)) {
    return false
  }

  if (
    filters.subjectIds.length > 0 &&
    (!event.subjectId || !filters.subjectIds.includes(event.subjectId))
  ) {
    return false
  }

  if (
    filters.personalGroupIds.length > 0 &&
    (!event.personalGroupId ||
      !filters.personalGroupIds.includes(event.personalGroupId))
  ) {
    return false
  }

  if (filters.statuses.length > 0 && !filters.statuses.includes(event.status)) {
    return false
  }

  const eventDateRange = getEventDateRange(event)

  if (filters.startDate && eventDateRange.end < filters.startDate) {
    return false
  }

  if (filters.endDate && eventDateRange.start > filters.endDate) {
    return false
  }

  const normalizedSearch = normalizeSearchText(filters.search)

  return (
    !normalizedSearch ||
    getSearchableEventText(event, subjects, personalGroups).includes(normalizedSearch)
  )
}

export function filterCalendarEvents(
  events: CalendarEvent[],
  filters: CalendarFilters,
  subjects: Pick<Subject, 'id' | 'name' | 'code' | 'abbreviation'>[],
  personalGroups: Pick<PersonalGroup, 'id' | 'name'>[],
): CalendarEvent[] {
  return events
    .filter((event) => matchesFilters(event, filters, subjects, personalGroups))
    .sort(
      (left, right) =>
        getEventSortValue(left) - getEventSortValue(right) ||
        left.id.localeCompare(right.id),
    )
}

export function countActiveCalendarFilters(filters: CalendarFilters): number {
  return [
    filters.search,
    filters.kinds.length,
    filters.subjectIds.length,
    filters.personalGroupIds.length,
    filters.statuses.length,
    filters.startDate,
    filters.endDate,
  ].filter((value) => Boolean(value)).length
}

export function hasActiveCalendarFilters(filters: CalendarFilters): boolean {
  return countActiveCalendarFilters(filters) > 0
}
