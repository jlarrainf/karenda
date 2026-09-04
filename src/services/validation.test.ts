import { describe, expect, it } from 'vitest'
import {
  aiEventDraftResponseSchema,
  entityIdSchema,
  eventInputSchema,
  eventRangeSchema,
  noteInputSchema,
  parseInput,
  personalGroupInputSchema,
  subjectInputSchema,
} from './validation.ts'

const subjectId = '11111111-1111-4111-8111-111111111111'
const groupId = '33333333-3333-4333-8333-333333333333'

describe('domain validation', () => {
  it('RF-04 accepts complete subjects and rejects invalid colors', () => {
    expect(
      subjectInputSchema.safeParse({
        abbreviation: 'ALG',
        code: 'MAT-101',
        color: '#2F625A',
        name: 'Álgebra',
      }).success,
    ).toBe(true)
    expect(
      subjectInputSchema.safeParse({
        abbreviation: 'ALG',
        code: 'MAT-101',
        color: 'green',
        name: 'Álgebra',
      }).success,
    ).toBe(false)
  })

  it('RF-07 accepts an optional personal group color', () => {
    expect(personalGroupInputSchema.safeParse({ name: 'Salud' }).success).toBe(true)
    expect(
      personalGroupInputSchema.safeParse({ color: '#8A5A20', name: 'Salud' }).success,
    ).toBe(true)
    expect(
      personalGroupInputSchema.safeParse({ color: 'orange', name: 'Salud' }).success,
    ).toBe(false)
  })

  it('RF-10 and RF-11 enforce event relationships and time requirements', () => {
    const academicWithoutSubject = eventInputSchema.safeParse({
      kind: 'academic',
      startAt: '2026-09-01T10:00',
      title: 'Control',
    })
    const personalWithSubject = eventInputSchema.safeParse({
      kind: 'personal',
      startAt: '2026-09-01T10:00',
      subjectId,
      title: 'Cita',
    })
    const timedWithoutTime = eventInputSchema.safeParse({
      kind: 'academic',
      startAt: '2026-09-01',
      subjectId,
      title: 'Control',
    })

    expect(academicWithoutSubject.success).toBe(false)
    expect(personalWithSubject.success).toBe(false)
    expect(timedWithoutTime.success).toBe(false)

    expect(
      eventInputSchema.safeParse({
        kind: 'academic',
        startAt: '2026-09-01T10:00',
        status: 'cancelled',
        subjectId,
        title: 'Estado inválido',
      }).success,
    ).toBe(false)
  })

  it('RF-13 accepts inclusive all-day dates and rejects invalid ranges', () => {
    expect(
      eventInputSchema.safeParse({
        endAt: '2026-09-03',
        isAllDay: true,
        kind: 'academic',
        startAt: '2026-09-01',
        subjectId,
        title: 'Semana de estudio',
      }).success,
    ).toBe(true)
    expect(
      eventInputSchema.safeParse({
        endAt: '2026-09-01',
        isAllDay: true,
        kind: 'academic',
        startAt: '2026-09-01',
        subjectId,
        title: 'Rango inválido',
      }).success,
    ).toBe(false)
  })

  it('RF-IA-12 accepts a personal draft that proposes a new group', () => {
    const result = aiEventDraftResponseSchema.safeParse({
      events: [
        {
          description: null,
          end_at: null,
          is_all_day: true,
          kind: 'personal',
          location: null,
          new_subject_name: null,
          new_personal_group_name: 'Salud',
          personal_group_id: null,
          review_flags: ['new_personal_group'],
          start_at: '2026-09-01',
          status: 'pending',
          subject_id: null,
          title: 'Cita médica',
        },
      ],
    })

    expect(result.success).toBe(true)
    expect(
      aiEventDraftResponseSchema.safeParse({
        events: [
          {
            description: null,
            end_at: null,
          is_all_day: true,
          kind: 'personal',
          location: null,
          new_subject_name: null,
          new_personal_group_name: 'Salud',
            personal_group_id: groupId,
            review_flags: ['new_personal_group'],
            start_at: '2026-09-01',
            status: 'pending',
            subject_id: null,
            title: 'Cita médica',
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('RF-IA-13 accepts an academic draft that proposes a new subject', () => {
    const result = aiEventDraftResponseSchema.safeParse({
      events: [
        {
          description: null,
          end_at: null,
          is_all_day: true,
          kind: 'academic',
          location: null,
          new_subject_name: 'Cálculo',
          new_personal_group_name: null,
          personal_group_id: null,
          review_flags: ['new_subject'],
          start_at: '2026-09-01',
          status: 'pending',
          subject_id: null,
          title: 'Control de cálculo',
        },
      ],
    })

    expect(result.success).toBe(true)
    expect(
      aiEventDraftResponseSchema.safeParse({
        events: [
          {
            description: null,
            end_at: null,
            is_all_day: true,
            kind: 'academic',
            location: null,
            new_subject_name: 'Cálculo',
            new_personal_group_name: null,
            personal_group_id: null,
            review_flags: ['new_subject'],
            start_at: '2026-09-01',
            status: 'pending',
            subject_id: subjectId,
            title: 'Control de cálculo',
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('RF-25 requires a valid note destination and non-empty content', () => {
    expect(
      noteInputSchema.safeParse({
        contentMarkdown: '**Resumen**',
        targetId: subjectId,
        targetType: 'subject',
        title: 'Resumen',
      }).success,
    ).toBe(true)
    expect(
      noteInputSchema.safeParse({
        contentMarkdown: '   ',
        targetId: groupId,
        targetType: 'personal_group',
        title: 'Resumen',
      }).success,
    ).toBe(false)
  })

  it('rejects invalid entity IDs and query ranges with Spanish errors', () => {
    expect(() => parseInput(entityIdSchema, 'not-an-id')).toThrow(
      'El identificador no es válido.',
    )
    expect(
      eventRangeSchema.safeParse({
        endAt: '2026-09-01T00:00:00.000Z',
        startAt: '2026-09-02T00:00:00.000Z',
      }).success,
    ).toBe(false)
  })
})
