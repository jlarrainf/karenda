import { describe, expect, it } from 'vitest'
import { isLocalDate } from './karendaKoreaderHabitLinksValidation.ts'

describe('isLocalDate', () => {
  it.each(['2024-02-29', '2026-10-02'])('accepts valid civil dates: %s', (value) => {
    expect(isLocalDate(value)).toBe(true)
  })

  it.each(['2023-02-29', '2026-13-01', '2026-04-31', '2026-1-01', 'not-a-date'])(
    'rejects invalid civil dates: %s',
    (value) => {
      expect(isLocalDate(value)).toBe(false)
    },
  )
})
