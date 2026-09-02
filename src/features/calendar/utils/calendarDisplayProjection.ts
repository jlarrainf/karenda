import type {
  CalendarDisplayItem,
  Habit,
  HabitLog,
  HabitOccurrence,
  HabitOccurrenceResult,
  HabitScheduleVersion,
  LocalDate,
  RecurringTask,
} from '../../../types/domain.ts'
import { getHabitOccurrences, getWeekday } from '../../habits/utils/habitRecurrence.ts'
import { evaluateHabitOccurrence } from '../../habits/utils/habitEvaluation.ts'

export interface CalendarDisplayProjectionInput {
  habits: Habit[]
  habitLogs: HabitLog[]
  habitOccurrences: HabitOccurrenceResult[]
  habitScheduleVersions: HabitScheduleVersion[]
  recurringTasks: RecurringTask[]
  rangeStart: LocalDate
  rangeEnd: LocalDate
  today: LocalDate
}

const HABIT_COLOR = '#2F625A'
const TASK_COLOR = '#8A5A20'

const HABIT_STATUS_LABELS: Record<HabitOccurrenceResult['status'], string> = {
  completed: 'Completado',
  missed: 'Incumplido',
  partial: 'Parcial',
  pending: 'Pendiente',
  skipped: 'Omitido',
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

function isInRange(
  value: LocalDate,
  rangeStart: LocalDate,
  rangeEnd: LocalDate,
): boolean {
  return value >= rangeStart && value <= rangeEnd
}

function getEffectiveVersion(
  habit: Habit,
  versions: HabitScheduleVersion[],
  localDate: LocalDate,
): HabitScheduleVersion {
  const version = versions
    .filter(
      (candidate) =>
        candidate.habitId === habit.id &&
        candidate.effectiveFrom <= localDate &&
        (!candidate.effectiveTo || candidate.effectiveTo >= localDate),
    )
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]

  return (
    version ?? {
      createdAt: habit.createdAt,
      effectiveFrom: habit.startDate,
      effectiveTo: habit.endDate,
      evaluationMode: habit.evaluationMode,
      goalValue: habit.goalValue,
      habitId: habit.id,
      id: `${habit.id}:current`,
      missPolicy: habit.missPolicy,
      ownerId: habit.ownerId,
      quotaPeriod: habit.quotaPeriod,
      schedule: habit.schedule,
      updatedAt: habit.updatedAt,
    }
  )
}

function createCustomOccurrence(
  habit: Habit,
  versions: HabitScheduleVersion[],
  localDate: LocalDate,
): HabitOccurrence {
  const version = getEffectiveVersion(habit, versions, localDate)

  return {
    evaluationMode: version.evaluationMode,
    goalValue: version.goalValue,
    id: `${habit.id}:calendar:${localDate}`,
    localDate,
    missPolicy: version.missPolicy,
    quotaPeriod: version.quotaPeriod,
    schedule: version.schedule,
    scheduleVersionId: version.id,
    habitId: habit.id,
  }
}

function getProjectedHabitOccurrences(
  habit: Habit,
  versions: HabitScheduleVersion[],
  habitOccurrences: HabitOccurrenceResult[],
  habitLogs: HabitLog[],
  rangeStart: LocalDate,
  rangeEnd: LocalDate,
  today: LocalDate,
): HabitOccurrenceResult[] {
  if (habit.lifecycleStatus !== 'active' || !habit.calendarEnabled) return []

  const schedule = habit.calendarSchedule
  const logs = habitLogs.filter((log) => log.habitId === habit.id)

  if (schedule?.mode === 'custom') {
    return schedule.dates
      .filter((date) => isInRange(date, rangeStart, rangeEnd))
      .filter(
        (date) => date >= habit.startDate && (!habit.endDate || date <= habit.endDate),
      )
      .map((date) => {
        const existing = habitOccurrences.find(
          (occurrence) => occurrence.localDate === date,
        )
        return (
          existing ??
          evaluateHabitOccurrence(
            habit,
            createCustomOccurrence(habit, versions, date),
            logs,
            today,
          )
        )
      })
  }

  const occurrences =
    habitOccurrences.length > 0
      ? habitOccurrences.filter((occurrence) =>
          isInRange(occurrence.localDate, rangeStart, rangeEnd),
        )
      : getHabitOccurrences(habit, versions, rangeStart, rangeEnd).map((occurrence) =>
          evaluateHabitOccurrence(habit, occurrence, logs, today),
        )

  if (schedule?.mode !== 'active_days' || schedule.weekdays.length === 0) {
    return occurrences
  }

  const activeDays = new Set(schedule.weekdays)
  return occurrences.filter((occurrence) =>
    activeDays.has(getWeekday(occurrence.localDate)),
  )
}

function mapHabitOccurrence(
  habit: Habit,
  occurrence: HabitOccurrenceResult,
): CalendarDisplayItem {
  return {
    allDay: true,
    color: habit.color ?? HABIT_COLOR,
    description: habit.description,
    endDate: null,
    habitId: habit.id,
    id: `habit-occurrence:${habit.id}:${occurrence.localDate}`,
    recurringTaskId: null,
    source: 'habit_occurrence',
    startDate: occurrence.localDate,
    statusLabel: HABIT_STATUS_LABELS[occurrence.status],
    title: `Hábito: ${habit.name}`,
  }
}

function mapRecurringTask(task: RecurringTask, today: LocalDate): CalendarDisplayItem {
  const isOverdue = task.nextDueDate < today

  return {
    allDay: true,
    color: task.color ?? TASK_COLOR,
    description: task.description,
    endDate: null,
    habitId: null,
    id: `recurring-task-occurrence:${task.id}:${task.nextDueDate}`,
    recurringTaskId: task.id,
    source: 'recurring_task_occurrence',
    startDate: task.nextDueDate,
    statusLabel: isOverdue ? 'Vencida' : 'Pendiente',
    title: `Tarea: ${task.title}`,
  }
}

export function getCalendarDisplayItems({
  habits,
  habitLogs,
  habitOccurrences,
  habitScheduleVersions,
  recurringTasks,
  rangeStart,
  rangeEnd,
  today,
}: CalendarDisplayProjectionInput): CalendarDisplayItem[] {
  const habitItems = habits.flatMap((habit) =>
    getProjectedHabitOccurrences(
      habit,
      habitScheduleVersions,
      habitOccurrences.filter((occurrence) => occurrence.habitId === habit.id),
      habitLogs,
      rangeStart,
      rangeEnd,
      today,
    ).map((occurrence) => mapHabitOccurrence(habit, occurrence)),
  )

  const taskItems = recurringTasks
    .filter(
      (task) =>
        task.calendarEnabled &&
        task.status !== 'archived' &&
        isInRange(task.nextDueDate, rangeStart, rangeEnd),
    )
    .map((task) => mapRecurringTask(task, today))

  return [...habitItems, ...taskItems].sort(
    (left, right) =>
      left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id),
  )
}

export function getCalendarDisplayRange(
  startDate: LocalDate,
  endDate: LocalDate,
): LocalDate[] {
  const dates: LocalDate[] = []

  for (let date = startDate; date <= endDate; date = incrementDate(date)) {
    dates.push(date)
  }

  return dates
}
