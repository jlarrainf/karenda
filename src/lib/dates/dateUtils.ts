function parseDateKey(value: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10))

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return [year, month, day]
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function getLocalDateKey(value: string, isAllDay = false): string {
  if (isAllDay) {
    return value.slice(0, 10)
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }

  return formatDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export function getDateKeyInTimeZone(
  value: string,
  timeZone: string,
  isAllDay = false,
): string {
  if (isAllDay) {
    return value.slice(0, 10)
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return formatDateKey(Number(values.year), Number(values.month), Number(values.day))
}

export function shiftDateKey(value: string, days: number): string {
  const parsed = parseDateKey(value)

  if (!parsed) {
    return value
  }

  const date = new Date(Date.UTC(parsed[0], parsed[1] - 1, parsed[2] + days))

  return formatDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

export function localDateStartToIso(value: string): string {
  const parsed = parseDateKey(value)

  if (!parsed) {
    return new Date(value).toISOString()
  }

  return new Date(parsed[0], parsed[1] - 1, parsed[2]).toISOString()
}

export function utcDateStartToIso(value: string): string {
  const parsed = parseDateKey(value)

  if (!parsed) {
    return new Date(value).toISOString()
  }

  return new Date(Date.UTC(parsed[0], parsed[1] - 1, parsed[2])).toISOString()
}
