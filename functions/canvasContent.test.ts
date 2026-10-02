import { describe, expect, it } from 'vitest'
import { filterAcademicDetails, normalizeAcademicLocation } from './canvasContent.ts'

describe('Canvas content filtering', () => {
  it('keeps academic instructions and removes unrelated announcement text', () => {
    const result = filterAcademicDetails(
      'Esperando que estén bien. La prueba cubre definiciones y teoremas. Dato freak: hoy es el día del tiburón ballena. PS: tomen agua y respondan la ECA.',
    )

    expect(result).toContain('La prueba cubre definiciones y teoremas')
    expect(result).not.toMatch(/tiburón|agua|ECA/i)
  })

  it('reduces verbose room instructions to the actual room codes', () => {
    expect(normalizeAcademicLocation('Salas: la prueba será en la A1. Para PIANE será en la A2.')).toBe('A1, A2')
    expect(normalizeAcademicLocation('Sala 12')).toBe('Sala 12')
  })
})
