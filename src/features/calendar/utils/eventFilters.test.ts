import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../../../types/domain.ts'
import {
  emptyCalendarFilters,
  filterCalendarEvents,
  normalizeSearchText,
} from './eventFilters.ts'

const events: CalendarEvent[] = [
  {
    createdAt: '2026-08-30T10:00:00.000Z',
    description: 'Repasar derivadas.',
    endAt: null,
    id: '55555555-5555-4555-8555-555555555555',
    isAllDay: false,
    kind: 'academic',
    location: 'Sala 12',
    ownerId: '22222222-2222-4222-8222-222222222222',
    personalGroupId: null,
    startAt: '2026-09-10T10:00:00-03:00',
    status: 'pending',
    subjectId: '11111111-1111-4111-8111-111111111111',
    title: 'Control de Álgebra',
    updatedAt: '2026-08-30T10:00:00.000Z',
  },
  {
    createdAt: '2026-08-30T10:00:00.000Z',
    description: null,
    endAt: '2026-09-13',
    id: '66666666-6666-4666-8666-666666666666',
    isAllDay: true,
    kind: 'personal',
    location: 'Centro médico',
    ownerId: '22222222-2222-4222-8222-222222222222',
    personalGroupId: '33333333-3333-4333-8333-333333333333',
    startAt: '2026-09-12',
    status: 'completed',
    subjectId: null,
    title: 'Cita médica',
    updatedAt: '2026-08-30T10:00:00.000Z',
  },
]

const subjects = [
  {
    abbreviation: 'ALG',
    code: 'MAT-101',
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Álgebra',
  },
]

const personalGroups = [{ id: '33333333-3333-4333-8333-333333333333', name: 'Salud' }]

describe('event filters', () => {
  it('normalizes case and accents for search', () => {
    expect(normalizeSearchText('  ÁLGEBRA  ')).toBe('algebra')
    expect(
      filterCalendarEvents(
        events,
        { ...emptyCalendarFilters, search: 'ALGEBRA' },
        subjects,
        personalGroups,
      ),
    ).toHaveLength(1)
  })

  it('combines categories with AND and values in a category with OR', () => {
    expect(
      filterCalendarEvents(
        events,
        {
          ...emptyCalendarFilters,
          kinds: ['academic', 'personal'],
          statuses: ['pending'],
        },
        subjects,
        personalGroups,
      ).map((event) => event.id),
    ).toEqual(['55555555-5555-4555-8555-555555555555'])

    expect(
      filterCalendarEvents(
        events,
        { ...emptyCalendarFilters, subjectIds: [subjects[0].id] },
        subjects,
        personalGroups,
      ),
    ).toHaveLength(1)
  })

  it('includes an event when its date range overlaps the selected range', () => {
    expect(
      filterCalendarEvents(
        events,
        { ...emptyCalendarFilters, startDate: '2026-09-13', endDate: '2026-09-13' },
        subjects,
        personalGroups,
      ).map((event) => event.id),
    ).toEqual(['66666666-6666-4666-8666-666666666666'])
  })
})
