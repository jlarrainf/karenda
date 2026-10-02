import { describe, expect, it } from 'vitest'
import { cleanCanvasCourseName, formatCanvasResourceWarning, isCanvasResourceMissing } from './canvasWarnings.ts'

describe('Canvas resource warnings', () => {
  it('removes an unmatched opening delimiter from a course name', () => {
    expect(cleanCanvasCourseName('Diseno de Sistemas Roboticos (')).toBe('Diseno de Sistemas Roboticos')
  })

  it('explains permission failures without including remote details', () => {
    expect(formatCanvasResourceWarning('quizzes', 'Sistemas Distribuidos', {
      code: 'CANVAS_FORBIDDEN', remoteStatus: 403,
    })).toBe('Canvas bloqueó quizzes de Sistemas Distribuidos: tu cuenta no tiene permiso para esa colección.')
  })

  it('distinguishes a missing collection from a transient failure', () => {
    expect(isCanvasResourceMissing({ remoteStatus: 404 })).toBe(true)
    expect(isCanvasResourceMissing({ code: 'CANVAS_UNAVAILABLE' })).toBe(false)
    expect(formatCanvasResourceWarning('pages', 'Sistemas Distribuidos', { remoteStatus: 404 }))
      .toBe('Canvas no ofrece páginas de Sistemas Distribuidos en este curso.')
    expect(formatCanvasResourceWarning('pages', 'Sistemas Distribuidos', { code: 'CANVAS_UNAVAILABLE' }))
      .toBe('Canvas no permitió leer páginas de Sistemas Distribuidos; se continuará con el resto.')
  })
})
