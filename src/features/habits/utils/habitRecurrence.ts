import type {
  Habit,
  HabitOccurrence,
  HabitQuotaPeriod,
  HabitSchedule,
  HabitScheduleVersion,
  LocalDate,
  Weekday,
} from '../../../types/domain.ts'
import { shiftDateKey } from '../../../lib/dates/dateUtils.ts'

const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
  7: 'domingo',
}

function toUtcDate(value: LocalDate): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function daysBetween(startDate: LocalDate, endDate: LocalDate): number {
  return Math.round(
    (toUtcDate(endDate).getTime() - toUtcDate(startDate).getTime()) / 86400000,
  )
}

export function getWeekday(value: LocalDate): Weekday {
  const day = toUtcDate(value).getUTCDay()
  return (day === 0 ? 7 : day) as Weekday
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function getMonthIndex(value: LocalDate): number {
  const [year, month] = value.split('-').map(Number)
  return year * 12 + month - 1
}

function isMonthOccurrence(
  schedule: HabitSchedule,
  effectiveFrom: LocalDate,
  date: LocalDate,
): boolean {
  const monthDistance = getMonthIndex(date) - getMonthIndex(effectiveFrom)

  if (
    monthDistance < 0 ||
    monthDistance % schedule.interval !== 0 ||
    schedule.dayOfMonth === null
  ) {
    return false
  }

  const [year, month] = date.split('-').map(Number)
  const expectedDay = Math.min(schedule.dayOfMonth, getDaysInMonth(year, month))

  return Number(date.slice(8, 10)) === expectedDay
}

export function isDateScheduled(
  schedule: HabitSchedule,
  effectiveFrom: LocalDate,
  date: LocalDate,
): boolean {
  if (date < effectiveFrom) {
    return false
  }

  if (schedule.unit === 'day') {
    const anchorDate = schedule.anchorDate ?? effectiveFrom
    const distance = daysBetween(anchorDate, date)

    return distance >= 0 && distance % schedule.interval === 0
  }

  if (schedule.unit === 'week') {
    const distance = daysBetween(effectiveFrom, date)
    const weekDistance = Math.floor(distance / 7)

    return (
      weekDistance % schedule.interval === 0 &&
      schedule.weekdays.includes(getWeekday(date))
    )
  }

  return isMonthOccurrence(schedule, effectiveFrom, date)
}

function resolveVersion(
  habit: Habit,
  versions: HabitScheduleVersion[],
  date: LocalDate,
): HabitScheduleVersion {
  const matchingVersion = [...versions]
    .filter(
      (version) =>
        version.habitId === habit.id &&
        version.effectiveFrom <= date &&
        (version.effectiveTo === null || date <= version.effectiveTo),
    )
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]

  return (
    matchingVersion ?? {
      id: `${habit.id}:initial`,
      ownerId: habit.ownerId,
      habitId: habit.id,
      schedule: habit.schedule,
      evaluationMode: habit.evaluationMode,
      goalValue: habit.goalValue,
      quotaPeriod: habit.quotaPeriod,
      missPolicy: habit.missPolicy,
      effectiveFrom: habit.startDate,
      effectiveTo: habit.endDate,
      createdAt: habit.createdAt,
      updatedAt: habit.updatedAt,
    }
  )
}

export function getHabitOccurrences(
  habit: Habit,
  versions: HabitScheduleVersion[],
  startDate: LocalDate,
  endDate: LocalDate,
): HabitOccurrence[] {
  if (endDate < startDate || habit.lifecycleStatus !== 'active') {
    return []
  }

  const firstDate = startDate < habit.startDate ? habit.startDate : startDate
  const lastDate = habit.endDate && habit.endDate < endDate ? habit.endDate : endDate
  const occurrences: HabitOccurrence[] = []

  for (let date = firstDate; date <= lastDate; date = shiftDateKey(date, 1)) {
    const version = resolveVersion(habit, versions, date)

    if (!isDateScheduled(version.schedule, version.effectiveFrom, date)) {
      continue
    }

    occurrences.push({
      id: `${habit.id}:${date}`,
      habitId: habit.id,
      localDate: date,
      scheduleVersionId: version.id,
      schedule: version.schedule,
      evaluationMode: version.evaluationMode,
      goalValue: version.goalValue,
      quotaPeriod: version.quotaPeriod,
      missPolicy: version.missPolicy,
    })
  }

  return occurrences
}

export function getNextScheduledDate(
  schedule: HabitSchedule,
  effectiveFrom: LocalDate,
  afterDate: LocalDate,
  endDate: LocalDate | null = null,
): LocalDate | null {
  for (
    let date = shiftDateKey(afterDate, 1);
    date <= (endDate ?? '9999-12-31');
    date = shiftDateKey(date, 1)
  ) {
    if (isDateScheduled(schedule, effectiveFrom, date)) {
      return date
    }
  }

  return null
}

export function getPeriodKey(date: LocalDate, period: HabitQuotaPeriod): LocalDate {
  if (period === 'day') {
    return date
  }

  if (period === 'month') {
    return `${date.slice(0, 7)}-01`
  }

  const mondayOffset = getWeekday(date) - 1
  return shiftDateKey(date, -mondayOffset)
}

export function getPeriodEnd(
  periodStart: LocalDate,
  period: HabitQuotaPeriod,
): LocalDate {
  if (period === 'day') {
    return periodStart
  }

  if (period === 'month') {
    const [year, month] = periodStart.split('-').map(Number)
    return `${year}-${String(month).padStart(2, '0')}-${String(getDaysInMonth(year, month)).padStart(2, '0')}`
  }

  return shiftDateKey(periodStart, 6)
}

export function describeSchedule(schedule: HabitSchedule): string {
  if (schedule.unit === 'day') {
    return schedule.interval === 1 ? 'Cada día' : `Cada ${schedule.interval} días`
  }

  if (schedule.unit === 'week') {
    const days = schedule.weekdays.map((weekday) => WEEKDAY_LABELS[weekday]).join(' y ')
    const prefix =
      schedule.interval === 1 ? 'Cada' : `Cada ${schedule.interval} semanas,`
    return `${prefix} ${days}`
  }

  return `El día ${schedule.dayOfMonth} de cada ${schedule.interval === 1 ? '' : `${schedule.interval} `}mes${schedule.interval === 1 ? '' : 'es'}`
}

export function weekdayLabel(weekday: Weekday): string {
  return WEEKDAY_LABELS[weekday]
}

export function formatHabitGoal(
  trackingType: Habit['trackingType'],
  goalValue: number,
  unit: string | null,
): string {
  if (trackingType === 'boolean') {
    return 'Una vez'
  }

  return `${goalValue} ${unit ?? 'unidades'}`
}

export function formatHabitSummary(habit: Habit): string {
  const goal = formatHabitGoal(habit.trackingType, habit.goalValue, habit.unit)

  if (habit.evaluationMode === 'period_quota' && habit.quotaPeriod) {
    const periodLabel =
      habit.quotaPeriod === 'day'
        ? 'día'
        : habit.quotaPeriod === 'week'
          ? 'semana'
          : 'mes'
    return `${habit.name}: ${goal} por ${periodLabel}`
  }

  return `${habit.name}: ${goal} · ${describeSchedule(habit.schedule)}`
}
