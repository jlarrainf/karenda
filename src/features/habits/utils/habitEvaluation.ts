import type {
  Habit,
  HabitLog,
  HabitOccurrence,
  HabitOccurrenceResult,
  HabitStatistics,
  LocalDate,
} from '../../../types/domain.ts'
import { getHabitOccurrences, getPeriodEnd, getPeriodKey } from './habitRecurrence.ts'

function getLatestLog(logs: HabitLog[], localDate: LocalDate): HabitLog | null {
  return (
    logs
      .filter((log) => log.localDate === localDate)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  )
}

export function evaluateHabitOccurrence(
  habit: Habit,
  occurrence: HabitOccurrence,
  logs: HabitLog[],
  today: LocalDate,
): HabitOccurrenceResult {
  const log = getLatestLog(logs, occurrence.localDate)

  if (log?.status === 'skipped') {
    return { ...occurrence, logId: log.id, status: 'skipped', value: log.value }
  }

  if (log) {
    const isCompleted =
      habit.trackingType === 'boolean'
        ? log.value >= 1
        : log.value >= occurrence.goalValue

    return {
      ...occurrence,
      logId: log.id,
      status: isCompleted ? 'completed' : 'partial',
      value: log.value,
    }
  }

  const isClosed = occurrence.localDate < today

  return {
    ...occurrence,
    logId: null,
    status: isClosed && occurrence.missPolicy === 'mark_missed' ? 'missed' : 'pending',
    value: 0,
  }
}

function getEmptyStatistics(
  habitId: string,
  rangeStart: LocalDate,
  rangeEnd: LocalDate,
): HabitStatistics {
  return {
    habitId,
    rangeStart,
    rangeEnd,
    currentStreak: 0,
    bestStreak: 0,
    completionPercentage: null,
    completedCount: 0,
    partialCount: 0,
    skippedCount: 0,
    missedCount: 0,
    pendingCount: 0,
    totalValue: 0,
    averageValue: null,
    achievedPeriods: 0,
    totalPeriods: 0,
    pendingPeriods: 0,
  }
}

function calculateOccurrenceStreaks(results: HabitOccurrenceResult[]): {
  currentStreak: number
  bestStreak: number
} {
  let bestStreak = 0
  let runningStreak = 0

  for (const result of results) {
    if (result.status === 'skipped') {
      continue
    }

    if (result.status === 'completed') {
      runningStreak += 1
      bestStreak = Math.max(bestStreak, runningStreak)
    } else {
      runningStreak = 0
    }
  }

  let currentStreak = 0

  for (const result of [...results].reverse()) {
    if (result.status === 'pending') {
      continue
    }

    if (result.status === 'skipped') {
      continue
    }

    if (result.status !== 'completed') {
      break
    }

    currentStreak += 1
  }

  return { bestStreak, currentStreak }
}

export function calculateHabitStatistics(
  habit: Habit,
  results: HabitOccurrenceResult[],
  logs: HabitLog[],
  rangeStart: LocalDate,
  rangeEnd: LocalDate,
  today: LocalDate,
): HabitStatistics {
  const statistics = getEmptyStatistics(habit.id, rangeStart, rangeEnd)
  const relevantLogs = logs.filter(
    (log) => log.localDate >= rangeStart && log.localDate <= rangeEnd,
  )

  statistics.totalValue = relevantLogs.reduce((total, log) => total + log.value, 0)
  statistics.averageValue =
    relevantLogs.length > 0 ? statistics.totalValue / relevantLogs.length : null

  if (habit.evaluationMode === 'period_quota' && habit.quotaPeriod) {
    const periodKeys = new Set<LocalDate>()

    for (let date = rangeStart; date <= rangeEnd; date = incrementDate(date)) {
      periodKeys.add(getPeriodKey(date, habit.quotaPeriod))
    }

    const periods = [...periodKeys].sort()
    statistics.totalPeriods = periods.length

    for (const periodStart of periods) {
      const periodEnd = getPeriodEnd(periodStart, habit.quotaPeriod)
      const periodValue = relevantLogs
        .filter((log) => log.localDate >= periodStart && log.localDate <= periodEnd)
        .reduce((total, log) => total + log.value, 0)
      const isPending = periodEnd >= today && periodValue < habit.goalValue

      if (periodValue >= habit.goalValue) {
        statistics.achievedPeriods += 1
      } else if (isPending) {
        statistics.pendingPeriods += 1
      } else {
        statistics.missedCount += 1
      }
    }

    const closedPeriods = statistics.totalPeriods - statistics.pendingPeriods
    statistics.completionPercentage =
      closedPeriods > 0 ? (statistics.achievedPeriods / closedPeriods) * 100 : null
    statistics.currentStreak = calculatePeriodStreaks(
      periods,
      relevantLogs,
      habit,
      today,
    ).currentStreak
    statistics.bestStreak = calculatePeriodStreaks(
      periods,
      relevantLogs,
      habit,
      today,
    ).bestStreak
    return statistics
  }

  for (const result of results) {
    if (result.status === 'completed') statistics.completedCount += 1
    if (result.status === 'partial') statistics.partialCount += 1
    if (result.status === 'skipped') statistics.skippedCount += 1
    if (result.status === 'missed') statistics.missedCount += 1
    if (result.status === 'pending') statistics.pendingCount += 1
  }

  const denominator = results.filter(
    (result) => result.status !== 'pending' && result.status !== 'skipped',
  ).length
  statistics.completionPercentage =
    denominator > 0 ? (statistics.completedCount / denominator) * 100 : null
  const streaks = calculateOccurrenceStreaks(results)
  statistics.currentStreak = streaks.currentStreak
  statistics.bestStreak = streaks.bestStreak
  return statistics
}

function calculatePeriodStreaks(
  periods: LocalDate[],
  logs: HabitLog[],
  habit: Habit,
  today: LocalDate,
): { currentStreak: number; bestStreak: number } {
  if (!habit.quotaPeriod) {
    return { currentStreak: 0, bestStreak: 0 }
  }

  const statuses = periods.map((periodStart) => {
    const periodEnd = getPeriodEnd(periodStart, habit.quotaPeriod!)
    const value = logs
      .filter((log) => log.localDate >= periodStart && log.localDate <= periodEnd)
      .reduce((total, log) => total + log.value, 0)

    return {
      isPending: periodEnd >= today && value < habit.goalValue,
      achieved: value >= habit.goalValue,
    }
  })
  let bestStreak = 0
  let current = 0

  for (const status of statuses) {
    if (status.achieved) {
      current += 1
      bestStreak = Math.max(bestStreak, current)
    } else if (!status.isPending) {
      current = 0
    }
  }

  current = 0
  for (const status of [...statuses].reverse()) {
    if (status.isPending) continue
    if (!status.achieved) break
    current += 1
  }

  return { bestStreak, currentStreak: current }
}

function incrementDate(value: LocalDate): LocalDate {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + 1))
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export function evaluateHabitRange(
  habit: Habit,
  versions: Parameters<typeof getHabitOccurrences>[1],
  logs: HabitLog[],
  startDate: LocalDate,
  endDate: LocalDate,
  today: LocalDate,
): HabitOccurrenceResult[] {
  return getHabitOccurrences(habit, versions, startDate, endDate).map((occurrence) =>
    evaluateHabitOccurrence(habit, occurrence, logs, today),
  )
}
