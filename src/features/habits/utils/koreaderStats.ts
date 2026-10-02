import type { HabitLog, LocalDate } from '../../../types/domain.ts'

export function selectCanonicalHabitLogs(logs: HabitLog[]): HabitLog[] {
  const byDate = new Map<LocalDate, HabitLog[]>()

  for (const log of logs) {
    const values = byDate.get(log.localDate) ?? []
    values.push(log)
    byDate.set(log.localDate, values)
  }

  return [...byDate.values()]
    .map((dateLogs) => {
      const imported = dateLogs
        .filter((log) => log.source === 'koreader')
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
      if (imported) return imported

      return dateLogs
        .filter((log) => log.source === 'manual')
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
    })
    .filter((log): log is HabitLog => Boolean(log))
    .sort((left, right) => left.localDate.localeCompare(right.localDate))
}

export function sumHabitLogs(
  logs: HabitLog[],
  rangeStart: LocalDate,
  rangeEnd: LocalDate,
): number {
  return selectCanonicalHabitLogs(logs)
    .filter((log) => log.localDate >= rangeStart && log.localDate <= rangeEnd)
    .reduce((total, log) => total + log.value, 0)
}

export function formatReadingDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 min'

  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const remainingMinutes = rounded % 60

  if (hours === 0) return `${remainingMinutes} min`
  if (remainingMinutes === 0) return `${hours} h`
  return `${hours} h ${remainingMinutes} min`
}
