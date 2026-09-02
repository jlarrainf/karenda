import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../../../types/domain.ts'
import {
  mapDomainEventToCalendarEvent,
  mapDomainEventsToCalendarEvents,
} from './calendarEventMapper.ts'

const baseEvent: CalendarEvent = {
  createdAt: '2026-08-30T10:00:00.000Z',
  description: 'Repasar capítulos uno y dos.',
  endAt: '2026-09-01T12:00:00-03:00',
  id: 'event-1',
  isAllDay: false,
  kind: 'academic',
  location: 'Sala 12',
  ownerId: 'owner-1',
  personalGroupId: null,
  startAt: '2026-09-01T10:00:00-03:00',
  status: 'pending',
  subjectId: 'subject-1',
  title: 'Control 1',
  updatedAt: '2026-08-30T10:00:00.000Z',
}

describe('calendar event mapper', () => {
  it('uses the subject color and exposes an accessible pending label', () => {
    const mappedEvent = mapDomainEventToCalendarEvent(baseEvent, {
      personalGroups: [],
      subjects: [{ color: '#E0EEEA', id: 'subject-1' }],
    })

    expect(mappedEvent).toMatchObject({
      allDay: false,
      backgroundColor: '#E0EEEA',
      borderColor: '#E0EEEA',
      end: '2026-09-01T12:00:00-03:00',
      id: 'event-1',
      start: '2026-09-01T10:00:00-03:00',
      textColor: '#000000',
      title: 'Control 1 (Pendiente)',
    })
    expect(mappedEvent.extendedProps).toMatchObject({
      description: 'Repasar capítulos uno y dos.',
      eventKind: 'academic',
      location: 'Sala 12',
      status: 'pending',
      statusLabel: 'Pendiente',
    })
  })

  it('preserves all-day ranges and uses a neutral color when no group exists', () => {
    const allDayEvent: CalendarEvent = {
      ...baseEvent,
      endAt: '2026-09-04',
      id: 'event-2',
      isAllDay: true,
      kind: 'personal',
      personalGroupId: 'group-1',
      startAt: '2026-09-02',
      status: 'completed',
      subjectId: null,
      title: 'Cumpleaños',
    }

    const mappedEvents = mapDomainEventsToCalendarEvents([allDayEvent], {
      personalGroups: [],
      subjects: [],
    })

    expect(mappedEvents[0]).toMatchObject({
      allDay: true,
      backgroundColor: '#5E6B65',
      end: '2026-09-05',
      start: '2026-09-02',
      title: 'Cumpleaños (Completado)',
    })
    expect(mappedEvents[0]?.classNames).toContain('calendar-event-completed')
  })
})
