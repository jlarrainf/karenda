export type EntityId = string
export type IsoDateTime = string
export type LocalDate = string

export type EventKind = 'academic' | 'personal'
export type EventStatus = 'pending' | 'completed'
export type NoteTargetType = 'subject' | 'personal_group'

export interface NoteTarget {
  targetType: NoteTargetType
  targetId: EntityId
}

export interface AllSubjectsNoteFilter {
  targetType: 'all_subjects'
}

export type NoteFilter = NoteTarget | AllSubjectsNoteFilter

export interface Subject {
  id: EntityId
  ownerId: EntityId
  name: string
  code: string
  abbreviation: string
  color: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface PersonalGroup {
  id: EntityId
  ownerId: EntityId
  name: string
  color: string | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface CalendarEvent {
  id: EntityId
  ownerId: EntityId
  kind: EventKind
  title: string
  subjectId: EntityId | null
  personalGroupId: EntityId | null
  startAt: IsoDateTime
  endAt: IsoDateTime | null
  isAllDay: boolean
  status: EventStatus
  location: string | null
  description: string | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface Note {
  id: EntityId
  ownerId: EntityId
  targetType: NoteTargetType
  targetId: EntityId
  title: string
  contentMarkdown: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export type HabitTrackingType = 'boolean' | 'count' | 'duration'
export type HabitEvaluationMode = 'scheduled_occurrence' | 'period_quota'
export type HabitMissPolicy = 'mark_missed' | 'keep_pending'
export type HabitLifecycleStatus = 'active' | 'paused' | 'archived'
export type HabitNotePolicy = 'none' | 'general' | 'daily' | 'both'
export type HabitLogStatus = 'completed' | 'partial' | 'skipped'
export type HabitLogSource = 'manual' | 'koreader'
export type HabitQuotaPeriod = 'day' | 'week' | 'month'
export type HabitOccurrenceStatus =
  'pending' | 'completed' | 'partial' | 'skipped' | 'missed'

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface HabitSchedule {
  unit: 'day' | 'week' | 'month'
  interval: number
  weekdays: Weekday[]
  dayOfMonth: number | null
  anchorDate: LocalDate | null
}

export type HabitCalendarScheduleMode = 'rule' | 'active_days' | 'custom'

export interface HabitCalendarSchedule {
  mode: HabitCalendarScheduleMode
  weekdays: Weekday[]
  dates: LocalDate[]
}

export interface Habit {
  id: EntityId
  ownerId: EntityId
  name: string
  description: string | null
  color: string | null
  subjectId: EntityId | null
  personalGroupId: EntityId | null
  trackingType: HabitTrackingType
  unit: string | null
  goalValue: number
  evaluationMode: HabitEvaluationMode
  quotaPeriod: HabitQuotaPeriod | null
  missPolicy: HabitMissPolicy
  schedule: HabitSchedule
  startDate: LocalDate
  endDate: LocalDate | null
  lifecycleStatus: HabitLifecycleStatus
  statsEnabled: boolean
  notePolicy: HabitNotePolicy
  calendarEnabled: boolean
  calendarSchedule: HabitCalendarSchedule | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface HabitScheduleVersion {
  id: EntityId
  ownerId: EntityId
  habitId: EntityId
  schedule: HabitSchedule
  evaluationMode: HabitEvaluationMode
  goalValue: number
  quotaPeriod: HabitQuotaPeriod | null
  missPolicy: HabitMissPolicy
  effectiveFrom: LocalDate
  effectiveTo: LocalDate | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface HabitLog {
  id: EntityId
  ownerId: EntityId
  habitId: EntityId
  localDate: LocalDate
  value: number
  status: HabitLogStatus
  source: HabitLogSource
  externalId: string | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface HabitOccurrence {
  id: string
  habitId: EntityId
  localDate: LocalDate
  scheduleVersionId: EntityId
  schedule: HabitSchedule
  evaluationMode: HabitEvaluationMode
  goalValue: number
  quotaPeriod: HabitQuotaPeriod | null
  missPolicy: HabitMissPolicy
}

export interface HabitOccurrenceResult extends HabitOccurrence {
  status: HabitOccurrenceStatus
  value: number
  logId: EntityId | null
}

export interface HabitStatistics {
  habitId: EntityId
  rangeStart: LocalDate
  rangeEnd: LocalDate
  currentStreak: number
  bestStreak: number
  completionPercentage: number | null
  completedCount: number
  partialCount: number
  skippedCount: number
  missedCount: number
  pendingCount: number
  totalValue: number
  averageValue: number | null
  achievedPeriods: number
  totalPeriods: number
  pendingPeriods: number
}

export interface HabitNote {
  id: EntityId
  ownerId: EntityId
  habitId: EntityId
  entryDate: LocalDate | null
  title: string
  contentMarkdown: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export type RecurringTaskStatus = 'active' | 'paused' | 'archived'
export type RecurringTaskOccurrenceStatus = 'completed' | 'rescheduled'

export interface RecurringTask {
  id: EntityId
  ownerId: EntityId
  title: string
  description: string | null
  color: string | null
  subjectId: EntityId | null
  personalGroupId: EntityId | null
  schedule: HabitSchedule
  startDate: LocalDate
  endDate: LocalDate | null
  nextDueDate: LocalDate
  dueTime: string | null
  durationMinutes: number | null
  status: RecurringTaskStatus
  calendarEnabled: boolean
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface RecurringTaskScheduleVersion {
  id: EntityId
  ownerId: EntityId
  recurringTaskId: EntityId
  schedule: HabitSchedule
  effectiveFrom: LocalDate
  effectiveTo: LocalDate | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface RecurringTaskOccurrence {
  id: EntityId
  ownerId: EntityId
  recurringTaskId: EntityId
  dueDate: LocalDate
  status: RecurringTaskOccurrenceStatus
  completedAt: IsoDateTime | null
  rescheduledTo: LocalDate | null
  createdAt: IsoDateTime
}

export type CalendarDisplaySource =
  'event' | 'habit_occurrence' | 'recurring_task_occurrence'

export interface CalendarDisplayItem {
  id: string
  source: CalendarDisplaySource
  title: string
  startDate: LocalDate
  endDate: LocalDate | null
  allDay: boolean
  color: string
  statusLabel: string
  description: string | null
  habitId: EntityId | null
  recurringTaskId: EntityId | null
}
