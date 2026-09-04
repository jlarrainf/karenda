import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestAiHabitDrafts, requestAiHabitPlan } from './aiHabitService.ts'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../lib/insforge/client.ts', () => ({ insforge: { functions: { invoke: mocks.invoke } } }))

const subjectId = '11111111-1111-4111-8111-111111111111'

describe('aiHabitService', () => {
  beforeEach(() => vi.resetAllMocks())

  it('maps a bounded habit draft and keeps local schedule semantics', async () => {
    mocks.invoke.mockResolvedValue({
      data: { habits: [{
        name: 'Leer', description: null, color: null, subject_id: subjectId,
        personal_group_id: null, tracking_type: 'count', unit: 'páginas', goal_value: 20,
        evaluation_mode: 'scheduled_occurrence', quota_period: null, miss_policy: 'mark_missed',
        schedule: { unit: 'week', interval: 1, weekdays: [1, 2, 3, 4, 5], dayOfMonth: null, anchorDate: null },
        start_date: '2026-09-01', end_date: null, lifecycle_status: 'active', stats_enabled: true,
        note_policy: 'none', calendar_enabled: false, calendar_schedule: null, review_flags: [],
      }] }, error: null,
    })

    const drafts = await requestAiHabitDrafts({ prompt: 'Leer 20 páginas de lunes a viernes.', subjectIds: [subjectId] })

    expect(mocks.invoke).toHaveBeenCalledWith('karenda-ai-habit-drafts', expect.objectContaining({ body: expect.objectContaining({ prompt: 'Leer 20 páginas de lunes a viernes.' }) }))
    expect(drafts[0]?.input).toMatchObject({ name: 'Leer', trackingType: 'count', goalValue: 20, unit: 'páginas', subjectId })
  })

  it('does not call the function with an empty prompt', async () => {
    await expect(requestAiHabitDrafts({ prompt: ' ' })).rejects.toMatchObject({ code: 'validation' })
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('normalizes a contradictory boolean duration response', async () => {
    mocks.invoke.mockResolvedValue({
      data: { habits: [{
        name: 'Estudiar', description: null, color: null, subject_id: null,
        personal_group_id: null, tracking_type: 'boolean', unit: 'horas', goal_value: 1,
        evaluation_mode: 'scheduled_occurrence', quota_period: null, miss_policy: 'mark_missed',
        schedule: { unit: 'day', interval: 1, weekdays: [], dayOfMonth: null, anchorDate: null },
        start_date: '2026-09-04', end_date: null, lifecycle_status: 'active', stats_enabled: true,
        note_policy: 'none', calendar_enabled: false, calendar_schedule: null, review_flags: [],
      }] }, error: null,
    })

    const drafts = await requestAiHabitDrafts({ prompt: 'Estudiar 1 hora al día.' })
    expect(drafts[0]?.input).toMatchObject({ trackingType: 'duration', unit: 'horas', goalValue: 1 })
  })

  it('returns structured guided questions without creating drafts', async () => {
    mocks.invoke.mockResolvedValue({
      data: { questions: [{ id: 'tracking', question: '¿Cómo quieres medirlo?', options: [{ id: 'duration', label: 'Por tiempo' }], allows_other: true, optional: false }] },
      error: null,
    })

    const plan = await requestAiHabitPlan({ mode: 'guided', prompt: 'Estudiar todos los días.' })
    expect(plan).toEqual({ kind: 'questions', questions: [{ id: 'tracking', question: '¿Cómo quieres medirlo?', options: [{ id: 'duration', label: 'Por tiempo' }], allowsOther: true, optional: false }] })
  })
})
