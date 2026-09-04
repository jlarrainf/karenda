import { describe, expect, it } from 'vitest'
import {
  appendUniqueCanvasText,
  canvasResponseAction,
  classifyAcademicActivity,
  monotonicCompletion,
  normalizeCanvasInterval,
  nextSantiagoSix,
  parseCanvasNextLink,
  rankCanvasCandidates,
  reconcileCanvasSnapshots,
  sanitizeCanvasHtml,
  validateCanvasAiProposal,
} from './reconciliation.ts'

describe('Canvas reconciliation rules', () => {
  it('classifies Spanish evaluation titles without inventing a category', () => {
    expect(classifyAcademicActivity('Examen final')).toBe('exam')
    expect(classifyAcademicActivity('Control 2')).toBe('test')
    expect(classifyAcademicActivity('Interrogación oral')).toBe('oral_assessment')
    expect(classifyAcademicActivity('Actividad libre')).toBe('other')
  })

  it('uses availability for assignments and never invents a quiz duration', () => {
    expect(normalizeCanvasInterval({
      type: 'assignment',
      unlockAt: '2026-09-01T12:00:00.000Z',
      dueAt: '2026-09-05T12:00:00.000Z',
    })).toEqual({
      startAt: '2026-09-01T12:00:00.000Z',
      endAt: '2026-09-05T12:00:00.000Z',
    })
    expect(normalizeCanvasInterval({
      type: 'quiz',
      dueAt: '2026-09-05T12:00:00.000Z',
    })).toEqual({ startAt: '2026-09-05T12:00:00.000Z', endAt: null })
  })

  it('prioritizes duplicate candidates by number, category, title and date', () => {
    const ranked = rankCanvasCandidates('Control 2', '2026-09-10T12:00:00.000Z', 'test', [
      { id: 'far', title: 'Control 2', startAt: '2026-09-25T12:00:00.000Z', academicActivityType: 'test' },
      { id: 'other', title: 'Control 1', startAt: '2026-09-10T12:00:00.000Z', academicActivityType: 'test' },
      { id: 'match', title: 'Control 2', startAt: '2026-09-11T12:00:00.000Z', academicActivityType: 'test' },
    ])
    expect(ranked).toEqual(['match', 'other'])
  })

  it('updates untouched fields and reports simultaneous changes as conflicts', () => {
    expect(reconcileCanvasSnapshots(
      { title: 'Control', location: 'Sala 1' },
      { title: 'Control personal', location: 'Sala 1' },
      { title: 'Control Canvas', location: 'Sala 2' },
    )).toEqual({ changes: { location: 'Sala 2' }, conflicts: ['title'] })
  })

  it('never returns a completed event to pending', () => {
    expect(monotonicCompletion('completed', 'pending')).toBe('completed')
    expect(monotonicCompletion('pending', 'completed')).toBe('completed')
  })

  it('adds announcement information once', () => {
    expect(appendUniqueCanvasText('Leer capítulos 1 y 2', 'Temario: capítulos 3 y 4'))
      .toBe('Leer capítulos 1 y 2\n\nTemario: capítulos 3 y 4')
    expect(appendUniqueCanvasText('Temario: capítulos 3 y 4', 'Temario: capítulos 3 y 4'))
      .toBe('Temario: capítulos 3 y 4')
  })

  it('accepts only opaque pagination links that stay on Canvas UC', () => {
    const header = '<https://cursos.canvas.uc.cl/api/v1/courses?page=2&opaque=abc>; rel="next", <https://cursos.canvas.uc.cl/api/v1/courses?page=1>; rel="current"'
    expect(parseCanvasNextLink(header)).toContain('opaque=abc')
    expect(parseCanvasNextLink('<https://evil.example/api/v1/courses?page=2>; rel="next"')).toBeNull()
  })

  it('maps Canvas authorization and throttling responses to safe actions', () => {
    expect(canvasResponseAction(401)).toBe('reconnect')
    expect(canvasResponseAction(403)).toBe('skip')
    expect(canvasResponseAction(429)).toBe('retry')
    expect(canvasResponseAction(500)).toBe('fail')
  })

  it('removes malicious HTML before sending content to the model', () => {
    expect(sanitizeCanvasHtml('<p>Sala 12</p><script>stealToken()</script>'))
      .toBe('Sala 12')
  })

  it('rejects malformed AI responses', () => {
    expect(validateCanvasAiProposal({ has_activity: true, location: ['Sala 12'] })).toBe(false)
    expect(validateCanvasAiProposal({
      has_activity: true,
      event_title: 'Control 2',
      start_at: null,
      end_at: null,
      location: 'Sala 12',
      topic_summary: null,
      academic_activity_type: 'test',
    })).toBe(true)
  })

  it('keeps 06:00 in Santiago across seasonal UTC offsets', () => {
    expect(nextSantiagoSix(new Date('2026-07-10T08:00:00.000Z')))
      .toBe('2026-07-10T10:00:00.000Z')
    expect(nextSantiagoSix(new Date('2026-01-10T11:00:00.000Z')))
      .toBe('2026-01-11T09:00:00.000Z')
  })
})
