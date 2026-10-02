import { shiftDateKey } from '../../../lib/dates/dateUtils.ts'
import type { CalendarEvent, PersonalGroup, Subject } from '../../../types/domain.ts'

export interface PhoneCalendarDefinition {
  key: string
  name: string
  color: string
}

export interface PhoneCalendarEvent {
  id: string
  calendarKey: string
  title: string
  startAt: string
  endAt: string | null
  isAllDay: boolean
  location: string | null
  description: string | null
}

export interface PhoneCalendarPayload {
  calendars: PhoneCalendarDefinition[]
  events: PhoneCalendarEvent[]
}

const DEFAULT_ACADEMIC_COLOR = '#2F625A'
const DEFAULT_PERSONAL_COLOR = '#7A8780'

function getSubjectLabel(
  subject: Pick<Subject, 'abbreviation' | 'code' | 'name'>,
): string {
  return subject.abbreviation.trim() || subject.code.trim() || subject.name
}

function getEventCategory(
  event: CalendarEvent,
  subjectsById: Map<
    string,
    Pick<Subject, 'abbreviation' | 'code' | 'color' | 'id' | 'name'>
  >,
  groupsById: Map<string, Pick<PersonalGroup, 'color' | 'id' | 'name'>>,
): { key: string; label: string } {
  if (event.kind === 'academic') {
    const subject = event.subjectId ? subjectsById.get(event.subjectId) : undefined
    return subject
      ? { key: `subject:${subject.id}`, label: getSubjectLabel(subject) }
      : { key: 'academic:unassigned', label: 'Académico' }
  }

  const group = event.personalGroupId
    ? groupsById.get(event.personalGroupId)
    : undefined
  return group
    ? { key: `personal:${group.id}`, label: group.name }
    : { key: 'personal:unassigned', label: 'Personal' }
}

export function mapEventsForPhoneCalendar(
  events: CalendarEvent[],
  subjects: Pick<Subject, 'abbreviation' | 'code' | 'color' | 'id' | 'name'>[],
  personalGroups: Pick<PersonalGroup, 'color' | 'id' | 'name'>[],
): PhoneCalendarPayload {
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]))
  const groupsById = new Map(personalGroups.map((group) => [group.id, group]))
  const calendars: PhoneCalendarDefinition[] = [
    ...subjects.map((subject) => ({
      key: `subject:${subject.id}`,
      name: subject.name,
      color: subject.color || DEFAULT_ACADEMIC_COLOR,
    })),
    ...personalGroups.map((group) => ({
      key: `personal:${group.id}`,
      name: group.name,
      color: group.color || DEFAULT_PERSONAL_COLOR,
    })),
    {
      key: 'academic:unassigned',
      name: 'Sin asignatura',
      color: DEFAULT_ACADEMIC_COLOR,
    },
    {
      key: 'personal:unassigned',
      name: 'Sin grupo personal',
      color: DEFAULT_PERSONAL_COLOR,
    },
  ]

  return {
    calendars,
    events: events.map((event) => {
      const category = getEventCategory(event, subjectsById, groupsById)

      return {
        id: event.id,
        calendarKey: category.key,
        title: `${event.title} · ${category.label}`,
        startAt: event.startAt,
        endAt: event.isAllDay
          ? shiftDateKey((event.endAt ?? event.startAt).slice(0, 10), 1)
          : event.endAt,
        isAllDay: event.isAllDay,
        location: event.location,
        description: event.description,
      }
    }),
  }
}
