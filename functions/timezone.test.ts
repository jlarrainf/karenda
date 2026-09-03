import { formatInstantInTimeZone } from './timezone.ts'

describe('timezone projection', () => {
  it('converts an instant to the requested civil offset', () => {
    expect(
      formatInstantInTimeZone('2026-09-02T21:30:00.000Z', 'America/Santiago'),
    ).toBe('2026-09-02T17:30:00.000-04:00')
  })

  it('keeps equivalent input offsets at the same local time', () => {
    expect(
      formatInstantInTimeZone('2026-09-02T18:30:00-03:00', 'America/Santiago'),
    ).toBe('2026-09-02T17:30:00.000-04:00')
  })

  it('updates the offset at the daylight-saving transition', () => {
    expect(
      formatInstantInTimeZone('2026-09-07T21:30:00.000Z', 'America/Santiago'),
    ).toBe('2026-09-07T18:30:00.000-03:00')
  })

  it('handles a local date boundary', () => {
    expect(
      formatInstantInTimeZone('2026-09-02T02:30:00.000Z', 'America/Santiago'),
    ).toBe('2026-09-01T22:30:00.000-04:00')
  })
})
