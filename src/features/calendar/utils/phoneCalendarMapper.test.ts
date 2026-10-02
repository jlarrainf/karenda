import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../../../types/domain.ts'
import { mapEventsForPhoneCalendar } from './phoneCalendarMapper.ts'

const subjectId = '11111111-1111-4111-8111-111111111111'
const groupId = '22222222-2222-4222-8222-222222222222'
const timestamp = '2026-09-01T10:00:00.000Z'

const events: CalendarEvent[] = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    ownerId: '44444444-4444-4444-8444-444444444444',
    kind: 'academic',
    title: 'Control 1',
    subjectId,
    personalGroupId: null,
    startAt: '2026-10-02T12:00:00.000Z',
    endAt: '2026-10-02T13:00:00.000Z',
    isAllDay: false,
    status: 'pending',
    location: 'Sala 12',
    description: 'Repasar derivadas.',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    ownerId: '44444444-4444-4444-8444-444444444444',
    kind: 'personal',
    title: 'Cita médica',
    subjectId: null,
    personalGroupId: groupId,
    startAt: '2026-10-03',
    endAt: '2026-10-03',
    isAllDay: true,
    status: 'completed',
    location: null,
    description: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
]

describe('mapEventsForPhoneCalendar', () => {
  it('separates subjects and personal groups and preserves supported event fields', () => {
    const payload = mapEventsForPhoneCalendar(
      events,
      [
        {
          id: subjectId,
          name: 'Álgebra',
          abbreviation: 'ALG',
          code: 'MAT-101',
          color: '#2F625A',
        },
      ],
      [{ id: groupId, name: 'Salud', color: '#8A5A20' }],
    )

    expect(payload.calendars).toEqual(
      expect.arrayContaining([
        { key: `subject:${subjectId}`, name: 'Álgebra', color: '#2F625A' },
        { key: `personal:${groupId}`, name: 'Salud', color: '#8A5A20' },
      ]),
    )
    expect(payload.events).toEqual([
      {
        id: events[0].id,
        calendarKey: `subject:${subjectId}`,
        title: 'Control 1 · ALG',
        startAt: events[0].startAt,
        endAt: events[0].endAt,
        isAllDay: false,
        location: 'Sala 12',
        description: 'Repasar derivadas.',
      },
      {
        id: events[1].id,
        calendarKey: `personal:${groupId}`,
        title: 'Cita médica · Salud',
        startAt: '2026-10-03',
        endAt: '2026-10-04',
        isAllDay: true,
        location: null,
        description: null,
      },
    ])
  })

  it('converts an inclusive all-day end date to Android exclusive DTEND', () => {
    const payload = mapEventsForPhoneCalendar([{ ...events[1], endAt: null }], [], [])

    expect(payload.events[0]?.startAt).toBe('2026-10-03')
    expect(payload.events[0]?.endAt).toBe('2026-10-04')
  })

  it('uses separate fallback calendars for events without a valid category', () => {
    const payload = mapEventsForPhoneCalendar(
      events.map((event) => ({ ...event, subjectId: null, personalGroupId: null })),
      [],
      [],
    )

    expect(payload.events.map((event) => event.calendarKey)).toEqual([
      'academic:unassigned',
      'personal:unassigned',
    ])
    expect(payload.calendars.map((calendar) => calendar.key)).toContain(
      'academic:unassigned',
    )
    expect(payload.calendars.map((calendar) => calendar.key)).toContain(
      'personal:unassigned',
    )
  })
})
