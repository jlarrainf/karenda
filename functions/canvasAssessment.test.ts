import { describe, expect, it } from 'vitest'
import {
  classifyAssessment,
  extractAssessmentCode,
  extractCanvasAssessment,
} from './canvasAssessment.ts'

describe('Canvas assessment extraction', () => {
  it('maps Interrogación 1 and today duration to I1 and a two-hour interval', () => {
    const result = extractCanvasAssessment(
      'Interrogación 1',
      'Hola! Hoy nos vemos para la interrogación 1 a las 17:30 horas. La interrogación dura 2 horas.',
      '2026-09-04T18:00:00.000Z',
    )

    expect(result.activityType).toBe('test')
    expect(result.assessmentCode).toBe('I1')
    expect(result.startAt).toBe('2026-09-04T21:30:00.000Z')
    expect(result.endAt).toBe('2026-09-04T23:30:00.000Z')
    expect(result.durationMinutes).toBe(120)
  })

  it('recognizes zero-padded activity codes and canonical categories', () => {
    expect(extractAssessmentCode('Actividad nueva AC01')).toEqual({
      activityType: 'activity',
      code: 'AC01',
    })
    expect(classifyAssessment('Seminario de proyecto')).toBe('seminar')
    expect(classifyAssessment('Control 1')).toBe('control')
    expect(classifyAssessment('Prueba 1')).toBe('test')
  })

  it('uses the announcement day when the message gives a time but no date', () => {
    const result = extractCanvasAssessment(
      'Interrogación 2',
      'Nos vemos a las 09:15 en Sala 12.',
      '2026-09-04T18:00:00.000Z',
    )

    expect(result.startAt).toBe('2026-09-04T13:15:00.000Z')
    expect(result.location).toBe('Sala 12')
  })
})
