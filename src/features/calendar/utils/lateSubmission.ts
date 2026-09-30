import type { CalendarEvent } from '../../../types/domain.ts'

type LateSubmissionEvent = Pick<
  CalendarEvent,
  'endAt' | 'isAllDay' | 'lateSubmissionDays' | 'startAt'
>

function formatLocalDate(value: Date): string {
  const year = String(value.getFullYear()).padStart(4, '0')
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getAllDayDeadline(value: string, days: number): string | null {
  const dateKey = value.slice(0, 10)
  const parts = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateKey)

  if (!parts) {
    return null
  }

  const year = Number(parts[1])
  const month = Number(parts[2])
  const day = Number(parts[3])
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(12, 0, 0, 0)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  date.setDate(date.getDate() + days)
  return Number.isNaN(date.getTime()) ? null : formatLocalDate(date)
}

export function getLateSubmissionDeadline(
  event: LateSubmissionEvent,
): string | null {
  const days = event.lateSubmissionDays

  if (!Number.isSafeInteger(days) || days === null || days < 1) {
    return null
  }

  const dueAt = event.endAt ?? event.startAt

  if (event.isAllDay) {
    return getAllDayDeadline(dueAt, days)
  }

  const deadline = new Date(dueAt)

  if (Number.isNaN(deadline.getTime())) {
    return null
  }

  deadline.setDate(deadline.getDate() + days)
  return Number.isNaN(deadline.getTime()) ? null : deadline.toISOString()
}
