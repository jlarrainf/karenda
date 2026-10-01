import { describe, expect, it } from 'vitest'
import { getLateSubmissionDeadline } from './lateSubmission.ts'

describe('late submission deadline', () => {
  it('adds calendar days to the inclusive end date of an all-day event', () => {
    expect(
      getLateSubmissionDeadline({
        endAt: '2026-10-02',
        isAllDay: true,
        lateSubmissionDays: 2,
        startAt: '2026-09-30',
      }),
    ).toBe('2026-10-04')
  })

  it('uses the start date when the event has no end date', () => {
    expect(
      getLateSubmissionDeadline({
        endAt: null,
        isAllDay: true,
        lateSubmissionDays: 1,
        startAt: '2026-10-31',
      }),
    ).toBe('2026-11-01')
  })

  it('preserves the local clock time for timed events', () => {
    expect(
      getLateSubmissionDeadline({
        endAt: '2026-09-10T12:00:00-03:00',
        isAllDay: false,
        lateSubmissionDays: 2,
        startAt: '2026-09-10T10:00:00-03:00',
      }),
    ).toBe('2026-09-12T15:00:00.000Z')
  })

  it('returns no deadline when late submissions are disabled', () => {
    expect(
      getLateSubmissionDeadline({
        endAt: null,
        isAllDay: true,
        lateSubmissionDays: null,
        startAt: '2026-09-10',
      }),
    ).toBeNull()
  })
})
