import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestAiEventDrafts, requestAiEventPlan } from './aiEventService.ts'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}))

vi.mock('../lib/insforge/client.ts', () => ({
  insforge: {
    functions: {
      invoke: mocks.invoke,
    },
  },
}))

const subjectId = '11111111-1111-4111-8111-111111111111'
const groupId = '33333333-3333-4333-8333-333333333333'

describe('aiEventService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('sends a bounded prompt with the browser date context and maps drafts', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        events: [
          {
            description: 'Repasar derivadas',
            end_at: null,
            is_all_day: false,
            kind: 'academic',
            location: 'Sala 12',
            new_subject_name: null,
            new_personal_group_name: null,
            personal_group_id: null,
            review_flags: [],
            start_at: '2026-09-04T10:00',
            status: 'pending',
            subject_id: subjectId,
            title: 'Control de Cálculo',
          },
        ],
      },
      error: null,
    })

    const drafts = await requestAiEventDrafts({
      personalGroupIds: [groupId],
      prompt: 'El viernes tengo un control de cálculo a las 10:00.',
      referenceDate: '2026-09-01',
      subjectIds: [subjectId],
      timeZone: 'America/Santiago',
    })

    expect(mocks.invoke).toHaveBeenCalledWith('karenda-ai-event-drafts', {
      body: {
        mode: 'quick',
        prompt: 'El viernes tengo un control de cálculo a las 10:00.',
        reference_date: '2026-09-01',
        time_zone: 'America/Santiago',
      },
    })
    expect(drafts[0]).toEqual({
      draftId: 'ai-draft-1',
      input: {
        description: 'Repasar derivadas',
        endAt: null,
        isAllDay: false,
        kind: 'academic',
        location: 'Sala 12',
        personalGroupId: null,
        startAt: '2026-09-04T10:00',
        status: 'pending',
        subjectId,
        title: 'Control de Cálculo',
      },
      newSubjectName: null,
      newPersonalGroupName: null,
      reviewFlags: [],
    })
  })

  it('keeps an academic draft for review when the subject is unresolved', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        events: [
          {
            description: null,
            end_at: null,
            is_all_day: true,
            kind: 'academic',
            location: null,
            new_subject_name: null,
            new_personal_group_name: null,
            personal_group_id: null,
            review_flags: ['unknown_subject'],
            start_at: '2026-09-04',
            status: 'pending',
            subject_id: null,
            title: 'Control de Cálculo',
          },
        ],
      },
      error: null,
    })

    const drafts = await requestAiEventDrafts({
      prompt: 'Control de cálculo el viernes.',
      referenceDate: '2026-09-01',
      subjectIds: [],
    })

    expect(drafts[0]?.reviewFlags).toEqual(['unknown_subject', 'missing_subject'])
    expect(drafts[0]?.input.subjectId).toBeNull()
  })

  it('rejects a relation that is not in the local catalog', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        events: [
          {
            description: null,
            end_at: null,
            is_all_day: false,
            kind: 'academic',
            location: null,
            new_subject_name: null,
            new_personal_group_name: null,
            personal_group_id: null,
            review_flags: [],
            start_at: '2026-09-04T10:00',
            status: 'pending',
            subject_id: subjectId,
            title: 'Control',
          },
        ],
      },
      error: null,
    })

    await expect(
      requestAiEventDrafts({
        prompt: 'Control el viernes.',
        referenceDate: '2026-09-01',
        subjectIds: [],
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'validation',
        message: 'La IA devolvió una asignatura no disponible.',
      }),
    )
  })

  it('does not call the function with an empty prompt', async () => {
    await expect(requestAiEventDrafts({ prompt: '   ' })).rejects.toEqual(
      expect.objectContaining({
        code: 'validation',
        message: 'Describe al menos un evento.',
      }),
    )
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('returns guided relation questions with a serializable answer contract', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        questions: [
          {
            allows_other: true,
            id: 'academic_subject',
            optional: false,
            options: [
              { id: `subject:${subjectId}`, label: 'Álgebra' },
              { id: 'create_subject:calculo', label: 'Crear asignatura «Cálculo»' },
            ],
            question: '¿A qué asignatura pertenece?',
          },
        ],
      },
      error: null,
    })

    const plan = await requestAiEventPlan({
      mode: 'guided',
      prompt: 'Control de cálculo el viernes.',
    })

    expect(plan).toEqual({
      kind: 'questions',
      questions: [
        {
          allowsOther: true,
          id: 'academic_subject',
          optional: false,
          options: [
            { id: `subject:${subjectId}`, label: 'Álgebra' },
            { id: 'create_subject:calculo', label: 'Crear asignatura «Cálculo»' },
          ],
          question: '¿A qué asignatura pertenece?',
        },
      ],
    })
    expect(mocks.invoke).toHaveBeenCalledWith('karenda-ai-event-drafts', {
      body: expect.objectContaining({ mode: 'guided' }),
    })
  })

  it('maps an unknown subject name to a proposed subject draft', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        events: [
          {
            description: null,
            end_at: null,
            is_all_day: true,
            kind: 'academic',
            location: null,
            new_personal_group_name: null,
            new_subject_name: 'Cálculo',
            personal_group_id: null,
            review_flags: ['unknown_subject'],
            start_at: '2026-09-04',
            status: 'pending',
            subject_id: null,
            title: 'Control de Cálculo',
          },
        ],
      },
      error: null,
    })

    const drafts = await requestAiEventDrafts({
      prompt: 'Control de cálculo el viernes.',
      subjectIds: [],
    })

    expect(drafts[0]).toMatchObject({
      newSubjectName: 'Cálculo',
      reviewFlags: ['unknown_subject', 'new_subject', 'missing_subject'],
    })
  })
})
