import { z } from 'zod'
import type { Database, Json } from '../lib/insforge/database.types.ts'
import { insforge } from '../lib/insforge/client.ts'
import type {
  Habit,
  HabitLog,
  HabitNote,
  HabitSchedule,
  HabitScheduleVersion,
  RecurringTask,
  RecurringTaskOccurrence,
  RecurringTaskScheduleVersion,
} from '../types/domain.ts'
import { getLocalDateKey, shiftDateKey } from '../lib/dates/dateUtils.ts'
import { getNextScheduledDate } from '../features/habits/utils/habitRecurrence.ts'
import { requireCurrentUserId } from './authService.ts'
import {
  AppError,
  runInsForge,
  runInsForgeAction,
  runInsForgeOptional,
} from './errors.ts'
import { entityIdSchema, parseInput } from './validation.ts'
import {
  habitCalendarScheduleSchema,
  habitInputSchema,
  habitLogInputSchema,
  habitLocalDateSchema,
  habitNoteInputSchema,
  habitNotePatchSchema,
  habitPatchSchema,
  habitRangeSchema,
  habitScheduleSchema,
  habitScheduleVersionInputSchema,
  recurringTaskInputSchema,
  recurringTaskPatchSchema,
  recurringTaskScheduleVersionInputSchema,
  type HabitInput,
  type HabitLogInput,
  type HabitNoteInput,
  type HabitNotePatch,
  type HabitPatch,
  type HabitRange,
  type HabitScheduleVersionInput,
  type RecurringTaskInput,
  type RecurringTaskPatch,
  type RecurringTaskScheduleVersionInput,
} from './habitValidation.ts'

export {
  habitCalendarScheduleSchema,
  habitInputSchema,
  habitLogInputSchema,
  habitLocalDateSchema,
  habitNoteInputSchema,
  habitNotePatchSchema,
  habitPatchSchema,
  habitRangeSchema,
  habitScheduleSchema,
  habitScheduleVersionInputSchema,
  recurringTaskInputSchema,
  recurringTaskPatchSchema,
  recurringTaskScheduleVersionInputSchema,
}

type HabitRow = Database['public']['Tables']['habits']['Row']
type HabitPayload = Database['public']['Tables']['habits']['Insert']
type HabitVersionRow = Database['public']['Tables']['habit_schedule_versions']['Row']
type HabitVersionPayload =
  Database['public']['Tables']['habit_schedule_versions']['Insert']
type HabitLogRow = Database['public']['Tables']['habit_logs']['Row']
type HabitLogPayload = Database['public']['Tables']['habit_logs']['Insert']
type HabitNoteRow = Database['public']['Tables']['habit_notes']['Row']
type HabitNotePayload = Database['public']['Tables']['habit_notes']['Insert']
type RecurringTaskRow = Database['public']['Tables']['recurring_tasks']['Row']
type RecurringTaskPayload = Database['public']['Tables']['recurring_tasks']['Insert']
type RecurringTaskVersionRow =
  Database['public']['Tables']['recurring_task_schedule_versions']['Row']
type RecurringTaskVersionPayload =
  Database['public']['Tables']['recurring_task_schedule_versions']['Insert']
type RecurringTaskOccurrenceRow =
  Database['public']['Tables']['recurring_task_occurrences']['Row']
type RecurringTaskOccurrencePayload =
  Database['public']['Tables']['recurring_task_occurrences']['Insert']

const HABIT_COLUMNS =
  'id, owner_id, name, description, color, subject_id, personal_group_id, tracking_type, unit, goal_value, evaluation_mode, quota_period, miss_policy, schedule, start_date, end_date, lifecycle_status, stats_enabled, note_policy, calendar_enabled, calendar_schedule, created_at, updated_at'
const HABIT_VERSION_COLUMNS =
  'id, owner_id, habit_id, schedule, evaluation_mode, goal_value, quota_period, miss_policy, effective_from, effective_to, created_at, updated_at'
const HABIT_LOG_COLUMNS =
  'id, owner_id, habit_id, local_date, value, status, source, external_id, created_at, updated_at'
const HABIT_NOTE_COLUMNS =
  'id, owner_id, habit_id, entry_date, title, content_markdown, created_at, updated_at'
const RECURRING_TASK_COLUMNS =
  'id, owner_id, title, description, color, subject_id, personal_group_id, schedule, start_date, end_date, next_due_date, due_time, duration_minutes, status, calendar_enabled, created_at, updated_at'
const RECURRING_TASK_VERSION_COLUMNS =
  'id, owner_id, recurring_task_id, schedule, effective_from, effective_to, created_at, updated_at'
const RECURRING_TASK_OCCURRENCE_COLUMNS =
  'id, owner_id, recurring_task_id, due_date, status, completed_at, rescheduled_to, created_at'

function mapSchedule(value: Json): HabitSchedule {
  return parseInput(habitScheduleSchema, value) as HabitSchedule
}

function mapHabit(row: HabitRow): Habit {
  return {
    calendarEnabled: row.calendar_enabled,
    calendarSchedule: row.calendar_schedule
      ? (parseInput(
          habitCalendarScheduleSchema,
          row.calendar_schedule,
        ) as Habit['calendarSchedule'])
      : null,
    color: row.color,
    createdAt: row.created_at,
    description: row.description,
    endDate: row.end_date,
    evaluationMode: row.evaluation_mode,
    goalValue: row.goal_value,
    id: row.id,
    lifecycleStatus: row.lifecycle_status,
    missPolicy: row.miss_policy,
    name: row.name,
    notePolicy: row.note_policy,
    ownerId: row.owner_id,
    personalGroupId: row.personal_group_id,
    quotaPeriod: row.quota_period,
    schedule: mapSchedule(row.schedule),
    startDate: row.start_date,
    statsEnabled: row.stats_enabled,
    subjectId: row.subject_id,
    trackingType: row.tracking_type,
    unit: row.unit,
    updatedAt: row.updated_at,
  }
}

function mapHabitVersion(row: HabitVersionRow): HabitScheduleVersion {
  return {
    createdAt: row.created_at,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    evaluationMode: row.evaluation_mode,
    goalValue: row.goal_value,
    habitId: row.habit_id,
    id: row.id,
    missPolicy: row.miss_policy,
    ownerId: row.owner_id,
    quotaPeriod: row.quota_period,
    schedule: mapSchedule(row.schedule),
    updatedAt: row.updated_at,
  }
}

function mapHabitLog(row: HabitLogRow): HabitLog {
  return {
    createdAt: row.created_at,
    externalId: row.external_id,
    habitId: row.habit_id,
    id: row.id,
    localDate: row.local_date,
    ownerId: row.owner_id,
    source: row.source,
    status: row.status,
    updatedAt: row.updated_at,
    value: row.value,
  }
}

function mapHabitNote(row: HabitNoteRow): HabitNote {
  return {
    contentMarkdown: row.content_markdown,
    createdAt: row.created_at,
    entryDate: row.entry_date,
    habitId: row.habit_id,
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    updatedAt: row.updated_at,
  }
}

function mapRecurringTask(row: RecurringTaskRow): RecurringTask {
  return {
    calendarEnabled: row.calendar_enabled,
    color: row.color,
    createdAt: row.created_at,
    description: row.description,
    dueTime: row.due_time,
    durationMinutes: row.duration_minutes,
    endDate: row.end_date,
    id: row.id,
    nextDueDate: row.next_due_date,
    ownerId: row.owner_id,
    personalGroupId: row.personal_group_id,
    schedule: mapSchedule(row.schedule),
    startDate: row.start_date,
    status: row.status,
    subjectId: row.subject_id,
    title: row.title,
    updatedAt: row.updated_at,
  }
}

function mapRecurringTaskVersion(
  row: RecurringTaskVersionRow,
): RecurringTaskScheduleVersion {
  return {
    createdAt: row.created_at,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    id: row.id,
    ownerId: row.owner_id,
    recurringTaskId: row.recurring_task_id,
    schedule: mapSchedule(row.schedule),
    updatedAt: row.updated_at,
  }
}

function mapRecurringTaskOccurrence(
  row: RecurringTaskOccurrenceRow,
): RecurringTaskOccurrence {
  return {
    completedAt: row.completed_at,
    createdAt: row.created_at,
    dueDate: row.due_date,
    id: row.id,
    ownerId: row.owner_id,
    recurringTaskId: row.recurring_task_id,
    rescheduledTo: row.rescheduled_to,
    status: row.status,
  }
}

function toHabitPayload(
  ownerId: string,
  input: z.output<typeof habitInputSchema>,
): HabitPayload {
  return {
    calendar_enabled: input.calendarEnabled,
    calendar_schedule: input.calendarSchedule,
    color: input.color,
    description: input.description,
    end_date: input.endDate,
    evaluation_mode: input.evaluationMode,
    goal_value: input.goalValue,
    lifecycle_status: input.lifecycleStatus,
    miss_policy: input.missPolicy,
    name: input.name,
    note_policy: input.notePolicy,
    owner_id: ownerId,
    personal_group_id: input.personalGroupId,
    quota_period: input.quotaPeriod,
    schedule: input.schedule,
    start_date: input.startDate,
    stats_enabled: input.statsEnabled,
    subject_id: input.subjectId,
    tracking_type: input.trackingType,
    unit: input.unit,
  }
}

function toHabitVersionPayload(
  ownerId: string,
  input: z.output<typeof habitScheduleVersionInputSchema>,
): HabitVersionPayload {
  return {
    effective_from: input.effectiveFrom,
    evaluation_mode: input.evaluationMode,
    goal_value: input.goalValue,
    habit_id: input.habitId,
    miss_policy: input.missPolicy,
    owner_id: ownerId,
    quota_period: input.quotaPeriod,
    schedule: input.schedule,
  }
}

async function getHabitOrNull(id: string, ownerId: string): Promise<Habit | null> {
  const data = await runInsForgeOptional<HabitRow>(
    () =>
      insforge.database
        .from('habits')
        .select(HABIT_COLUMNS)
        .eq('id', id)
        .eq('owner_id', ownerId)
        .maybeSingle(),
    'No se pudo cargar el hábito.',
  )

  return data ? mapHabit(data) : null
}

async function getHabitOrThrow(id: string): Promise<Habit> {
  const ownerId = await requireCurrentUserId()
  const habit = await getHabitOrNull(id, ownerId)

  if (!habit) {
    throw new AppError('not_found', 'No se encontró el hábito.')
  }

  return habit
}

export async function listHabits(includeArchived = false): Promise<Habit[]> {
  const ownerId = await requireCurrentUserId()
  let query = insforge.database
    .from('habits')
    .select(HABIT_COLUMNS)
    .eq('owner_id', ownerId)

  if (!includeArchived) {
    query = query.in('lifecycle_status', ['active', 'paused'])
  }

  const data = await runInsForge<HabitRow[]>(
    () =>
      query
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .limit(500),
    'No se pudieron cargar los hábitos.',
  )

  return data.map(mapHabit)
}

export async function getHabit(id: string): Promise<Habit | null> {
  const ownerId = await requireCurrentUserId()
  return getHabitOrNull(id, ownerId)
}

export async function listHabitScheduleVersions(
  habitId?: string,
): Promise<HabitScheduleVersion[]> {
  const ownerId = await requireCurrentUserId()
  let query = insforge.database
    .from('habit_schedule_versions')
    .select(HABIT_VERSION_COLUMNS)
    .eq('owner_id', ownerId)

  if (habitId) {
    query = query.eq('habit_id', habitId)
  }

  const data = await runInsForge<HabitVersionRow[]>(
    () => query.order('effective_from', { ascending: true }).limit(2000),
    'No se pudieron cargar las reglas de hábitos.',
  )

  return data.map(mapHabitVersion)
}

export async function listHabitLogs(
  habitId: string,
  range: HabitRange,
): Promise<HabitLog[]> {
  const ownerId = await requireCurrentUserId()
  const parsedHabitId = parseInput(entityIdSchema, habitId)
  const parsedRange = parseInput(habitRangeSchema, range)
  const data = await runInsForge<HabitLogRow[]>(
    () =>
      insforge.database
        .from('habit_logs')
        .select(HABIT_LOG_COLUMNS)
        .eq('owner_id', ownerId)
        .eq('habit_id', parsedHabitId)
        .gte('local_date', parsedRange.startDate)
        .lte('local_date', parsedRange.endDate)
        .order('local_date', { ascending: true })
        .order('updated_at', { ascending: true })
        .limit(2000),
    'No se pudieron cargar los registros del hábito.',
  )

  return data.map(mapHabitLog)
}

export async function createHabit(input: HabitInput): Promise<Habit> {
  const ownerId = await requireCurrentUserId()
  const parsed = parseInput(habitInputSchema, input)
  const data = await runInsForge<HabitRow>(
    () =>
      insforge.database
        .from('habits')
        .insert([toHabitPayload(ownerId, parsed)])
        .select(HABIT_COLUMNS)
        .single(),
    'No se pudo crear el hábito.',
  )
  const habit = mapHabit(data)
  const versionInput = parseInput(habitScheduleVersionInputSchema, {
    effectiveFrom: parsed.startDate,
    evaluationMode: parsed.evaluationMode,
    goalValue: parsed.goalValue,
    habitId: habit.id,
    missPolicy: parsed.missPolicy,
    quotaPeriod: parsed.quotaPeriod,
    schedule: parsed.schedule,
  })

  await runInsForgeAction(
    () =>
      insforge.database
        .from('habit_schedule_versions')
        .insert([toHabitVersionPayload(ownerId, versionInput)]),
    'No se pudo guardar la regla inicial del hábito.',
  )

  return habit
}

function habitToInput(habit: Habit): z.input<typeof habitInputSchema> {
  return {
    calendarEnabled: habit.calendarEnabled,
    calendarSchedule: habit.calendarSchedule,
    color: habit.color,
    description: habit.description,
    endDate: habit.endDate,
    evaluationMode: habit.evaluationMode,
    goalValue: habit.goalValue,
    lifecycleStatus: habit.lifecycleStatus,
    missPolicy: habit.missPolicy,
    name: habit.name,
    notePolicy: habit.notePolicy,
    personalGroupId: habit.personalGroupId,
    quotaPeriod: habit.quotaPeriod,
    schedule: habit.schedule,
    startDate: habit.startDate,
    statsEnabled: habit.statsEnabled,
    subjectId: habit.subjectId,
    trackingType: habit.trackingType,
    unit: habit.unit,
  }
}

export async function updateHabit(id: string, input: HabitPatch): Promise<Habit> {
  const ownerId = await requireCurrentUserId()
  const existing = await getHabitOrThrow(id)
  const parsedPatch = parseInput(habitPatchSchema, input)
  const parsed = parseInput(habitInputSchema, {
    ...habitToInput(existing),
    ...parsedPatch,
  })
  const data = await runInsForge<HabitRow>(
    () =>
      insforge.database
        .from('habits')
        .update(toHabitPayload(ownerId, parsed))
        .eq('id', existing.id)
        .eq('owner_id', ownerId)
        .select(HABIT_COLUMNS)
        .single(),
    'No se pudo actualizar el hábito.',
  )

  return mapHabit(data)
}

export async function updateHabitLifecycle(
  id: string,
  lifecycleStatus: Habit['lifecycleStatus'],
): Promise<Habit> {
  return updateHabit(id, { lifecycleStatus })
}

export async function updateHabitScheduleVersion(
  input: HabitScheduleVersionInput,
): Promise<HabitScheduleVersion> {
  const ownerId = await requireCurrentUserId()
  const parsed = parseInput(habitScheduleVersionInputSchema, input)
  const habit = await getHabitOrThrow(parsed.habitId)

  if (parsed.effectiveFrom < habit.startDate) {
    throw new AppError(
      'validation',
      'La regla futura no puede comenzar antes del hábito.',
    )
  }

  if (parsed.effectiveFrom <= getLocalDateKey(new Date().toISOString())) {
    throw new AppError('validation', 'La regla futura debe comenzar después de hoy.')
  }

  if (habit.trackingType === 'boolean' && parsed.goalValue !== 1) {
    throw new AppError('validation', 'La meta de un hábito booleano debe ser 1.')
  }

  const versions = await listHabitScheduleVersions(habit.id)
  if (versions.some((version) => version.effectiveFrom === parsed.effectiveFrom)) {
    throw new AppError('validation', 'Ya existe una regla para esa fecha efectiva.')
  }
  const previous = [...versions]
    .filter((version) => version.effectiveFrom < parsed.effectiveFrom)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]
  const next = [...versions]
    .filter((version) => version.effectiveFrom > parsed.effectiveFrom)
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))[0]

  if (previous) {
    await runInsForgeAction(
      () =>
        insforge.database
          .from('habit_schedule_versions')
          .update({ effective_to: shiftDateKey(parsed.effectiveFrom, -1) })
          .eq('id', previous.id)
          .eq('owner_id', ownerId),
      'No se pudo cerrar la regla anterior.',
    )
  }

  const data = await runInsForge<HabitVersionRow>(
    () =>
      insforge.database
        .from('habit_schedule_versions')
        .insert([
          {
            ...toHabitVersionPayload(ownerId, parsed),
            effective_to: next ? shiftDateKey(next.effectiveFrom, -1) : null,
          },
        ])
        .select(HABIT_VERSION_COLUMNS)
        .single(),
    'No se pudo guardar la regla futura.',
  )

  return mapHabitVersion(data)
}

export async function saveHabitLog(input: HabitLogInput): Promise<HabitLog> {
  const ownerId = await requireCurrentUserId()
  const parsed = parseInput(habitLogInputSchema, input)
  await getHabitOrThrow(parsed.habitId)
  const existing = await runInsForgeOptional<HabitLogRow>(
    () =>
      insforge.database
        .from('habit_logs')
        .select(HABIT_LOG_COLUMNS)
        .eq('owner_id', ownerId)
        .eq('habit_id', parsed.habitId)
        .eq('local_date', parsed.localDate)
        .eq('source', parsed.source)
        .maybeSingle(),
    'No se pudo revisar el registro existente.',
  )

  const payload: HabitLogPayload = {
    external_id: parsed.externalId,
    habit_id: parsed.habitId,
    local_date: parsed.localDate,
    owner_id: ownerId,
    source: parsed.source,
    status: parsed.status,
    value: parsed.value,
  }

  const data = existing
    ? await runInsForge<HabitLogRow>(
        () =>
          insforge.database
            .from('habit_logs')
            .update(payload)
            .eq('id', existing.id)
            .eq('owner_id', ownerId)
            .select(HABIT_LOG_COLUMNS)
            .single(),
        'No se pudo actualizar el registro del hábito.',
      )
    : await runInsForge<HabitLogRow>(
        () =>
          insforge.database
            .from('habit_logs')
            .insert([payload])
            .select(HABIT_LOG_COLUMNS)
            .single(),
        'No se pudo guardar el registro del hábito.',
      )

  return mapHabitLog(data)
}

export async function deleteHabitLog(id: string): Promise<void> {
  const ownerId = await requireCurrentUserId()
  await runInsForgeAction(
    () =>
      insforge.database
        .from('habit_logs')
        .delete()
        .eq('id', id)
        .eq('owner_id', ownerId),
    'No se pudo quitar el registro del hábito.',
  )
}

export async function listHabitNotes(habitId?: string): Promise<HabitNote[]> {
  const ownerId = await requireCurrentUserId()
  let query = insforge.database
    .from('habit_notes')
    .select(HABIT_NOTE_COLUMNS)
    .eq('owner_id', ownerId)

  if (habitId) query = query.eq('habit_id', habitId)

  const data = await runInsForge<HabitNoteRow[]>(
    () => query.order('updated_at', { ascending: false }).limit(500),
    'No se pudieron cargar las notas de hábitos.',
  )

  return data.map(mapHabitNote)
}

export async function createHabitNote(input: HabitNoteInput): Promise<HabitNote> {
  const ownerId = await requireCurrentUserId()
  const parsed = parseInput(habitNoteInputSchema, input)
  await getHabitOrThrow(parsed.habitId)
  const payload: HabitNotePayload = {
    content_markdown: parsed.contentMarkdown,
    entry_date: parsed.entryDate,
    habit_id: parsed.habitId,
    owner_id: ownerId,
    title: parsed.title,
  }
  const data = await runInsForge<HabitNoteRow>(
    () =>
      insforge.database
        .from('habit_notes')
        .insert([payload])
        .select(HABIT_NOTE_COLUMNS)
        .single(),
    'No se pudo crear la nota del hábito.',
  )

  return mapHabitNote(data)
}

export async function updateHabitNote(
  id: string,
  input: HabitNotePatch,
): Promise<HabitNote> {
  const ownerId = await requireCurrentUserId()
  const current = await runInsForgeOptional<HabitNoteRow>(
    () =>
      insforge.database
        .from('habit_notes')
        .select(HABIT_NOTE_COLUMNS)
        .eq('id', id)
        .eq('owner_id', ownerId)
        .maybeSingle(),
    'No se pudo cargar la nota del hábito.',
  )

  if (!current) throw new AppError('not_found', 'No se encontró la nota del hábito.')

  const parsedPatch = parseInput(habitNotePatchSchema, input)
  const parsed = parseInput(habitNoteInputSchema, {
    contentMarkdown: current.content_markdown,
    entryDate: current.entry_date,
    habitId: current.habit_id,
    title: current.title,
    ...parsedPatch,
  })
  const data = await runInsForge<HabitNoteRow>(
    () =>
      insforge.database
        .from('habit_notes')
        .update({
          content_markdown: parsed.contentMarkdown,
          entry_date: parsed.entryDate,
          habit_id: parsed.habitId,
          title: parsed.title,
        })
        .eq('id', id)
        .eq('owner_id', ownerId)
        .select(HABIT_NOTE_COLUMNS)
        .single(),
    'No se pudo actualizar la nota del hábito.',
  )

  return mapHabitNote(data)
}

export async function deleteHabitNote(id: string): Promise<void> {
  const ownerId = await requireCurrentUserId()
  await runInsForgeAction(
    () =>
      insforge.database
        .from('habit_notes')
        .delete()
        .eq('id', id)
        .eq('owner_id', ownerId),
    'No se pudo eliminar la nota del hábito.',
  )
}

function toRecurringTaskPayload(
  ownerId: string,
  input: z.output<typeof recurringTaskInputSchema>,
): RecurringTaskPayload {
  return {
    calendar_enabled: input.calendarEnabled,
    color: input.color,
    description: input.description,
    due_time: input.dueTime,
    duration_minutes: input.durationMinutes,
    end_date: input.endDate,
    next_due_date: input.nextDueDate,
    owner_id: ownerId,
    personal_group_id: input.personalGroupId,
    schedule: input.schedule,
    start_date: input.startDate,
    status: input.status,
    subject_id: input.subjectId,
    title: input.title,
  }
}

function toRecurringTaskVersionPayload(
  ownerId: string,
  input: z.output<typeof recurringTaskScheduleVersionInputSchema>,
): RecurringTaskVersionPayload {
  return {
    effective_from: input.effectiveFrom,
    owner_id: ownerId,
    recurring_task_id: input.recurringTaskId,
    schedule: input.schedule,
  }
}

async function getRecurringTaskOrThrow(id: string): Promise<RecurringTask> {
  const ownerId = await requireCurrentUserId()
  const data = await runInsForgeOptional<RecurringTaskRow>(
    () =>
      insforge.database
        .from('recurring_tasks')
        .select(RECURRING_TASK_COLUMNS)
        .eq('id', id)
        .eq('owner_id', ownerId)
        .maybeSingle(),
    'No se pudo cargar la tarea recurrente.',
  )

  if (!data) throw new AppError('not_found', 'No se encontró la tarea recurrente.')
  return mapRecurringTask(data)
}

export async function listRecurringTasks(
  includeArchived = false,
): Promise<RecurringTask[]> {
  const ownerId = await requireCurrentUserId()
  let query = insforge.database
    .from('recurring_tasks')
    .select(RECURRING_TASK_COLUMNS)
    .eq('owner_id', ownerId)

  if (!includeArchived) query = query.in('status', ['active', 'paused'])

  const data = await runInsForge<RecurringTaskRow[]>(
    () => query.order('next_due_date', { ascending: true }).limit(500),
    'No se pudieron cargar las tareas recurrentes.',
  )
  return data.map(mapRecurringTask)
}

export async function listRecurringTaskOccurrences(
  recurringTaskId?: string,
): Promise<RecurringTaskOccurrence[]> {
  const ownerId = await requireCurrentUserId()
  let query = insforge.database
    .from('recurring_task_occurrences')
    .select(RECURRING_TASK_OCCURRENCE_COLUMNS)
    .eq('owner_id', ownerId)
  if (recurringTaskId) query = query.eq('recurring_task_id', recurringTaskId)
  const data = await runInsForge<RecurringTaskOccurrenceRow[]>(
    () => query.order('due_date', { ascending: false }).limit(1000),
    'No se pudo cargar el historial de tareas recurrentes.',
  )
  return data.map(mapRecurringTaskOccurrence)
}

export async function createRecurringTask(
  input: RecurringTaskInput,
): Promise<RecurringTask> {
  const ownerId = await requireCurrentUserId()
  const parsed = parseInput(recurringTaskInputSchema, input)
  const data = await runInsForge<RecurringTaskRow>(
    () =>
      insforge.database
        .from('recurring_tasks')
        .insert([toRecurringTaskPayload(ownerId, parsed)])
        .select(RECURRING_TASK_COLUMNS)
        .single(),
    'No se pudo crear la tarea recurrente.',
  )
  const task = mapRecurringTask(data)
  await runInsForgeAction(
    () =>
      insforge.database.from('recurring_task_schedule_versions').insert([
        toRecurringTaskVersionPayload(ownerId, {
          effectiveFrom: task.startDate,
          recurringTaskId: task.id,
          schedule: parsed.schedule,
        }),
      ]),
    'No se pudo guardar la regla inicial de la tarea recurrente.',
  )
  return task
}

export async function listRecurringTaskScheduleVersions(
  recurringTaskId?: string,
): Promise<RecurringTaskScheduleVersion[]> {
  const ownerId = await requireCurrentUserId()
  let query = insforge.database
    .from('recurring_task_schedule_versions')
    .select(RECURRING_TASK_VERSION_COLUMNS)
    .eq('owner_id', ownerId)

  if (recurringTaskId) query = query.eq('recurring_task_id', recurringTaskId)

  const data = await runInsForge<RecurringTaskVersionRow[]>(
    () => query.order('effective_from', { ascending: true }).limit(500),
    'No se pudieron cargar las reglas de tareas recurrentes.',
  )
  return data.map(mapRecurringTaskVersion)
}

export async function updateRecurringTaskScheduleVersion(
  input: RecurringTaskScheduleVersionInput,
): Promise<RecurringTaskScheduleVersion> {
  const ownerId = await requireCurrentUserId()
  const parsed = parseInput(recurringTaskScheduleVersionInputSchema, input)
  const task = await getRecurringTaskOrThrow(parsed.recurringTaskId)

  if (parsed.effectiveFrom < task.startDate) {
    throw new AppError(
      'validation',
      'La regla futura no puede comenzar antes de la tarea.',
    )
  }

  if (parsed.effectiveFrom <= getLocalDateKey(new Date().toISOString())) {
    throw new AppError('validation', 'La regla futura debe comenzar después de hoy.')
  }

  const versions = await listRecurringTaskScheduleVersions(task.id)
  if (versions.some((version) => version.effectiveFrom === parsed.effectiveFrom)) {
    throw new AppError('validation', 'Ya existe una regla para esa fecha efectiva.')
  }
  const previous = [...versions]
    .filter((version) => version.effectiveFrom < parsed.effectiveFrom)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]
  const next = [...versions]
    .filter((version) => version.effectiveFrom > parsed.effectiveFrom)
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))[0]

  if (previous) {
    await runInsForgeAction(
      () =>
        insforge.database
          .from('recurring_task_schedule_versions')
          .update({ effective_to: shiftDateKey(parsed.effectiveFrom, -1) })
          .eq('id', previous.id)
          .eq('owner_id', ownerId),
      'No se pudo cerrar la regla anterior de la tarea.',
    )
  }

  const data = await runInsForge<RecurringTaskVersionRow>(
    () =>
      insforge.database
        .from('recurring_task_schedule_versions')
        .insert([
          {
            ...toRecurringTaskVersionPayload(ownerId, parsed),
            effective_to: next ? shiftDateKey(next.effectiveFrom, -1) : null,
          },
        ])
        .select(RECURRING_TASK_VERSION_COLUMNS)
        .single(),
    'No se pudo guardar la regla futura de la tarea.',
  )

  return mapRecurringTaskVersion(data)
}

function recurringTaskToInput(
  task: RecurringTask,
): z.input<typeof recurringTaskInputSchema> {
  return {
    calendarEnabled: task.calendarEnabled,
    color: task.color,
    description: task.description,
    dueTime: task.dueTime,
    durationMinutes: task.durationMinutes,
    endDate: task.endDate,
    nextDueDate: task.nextDueDate,
    personalGroupId: task.personalGroupId,
    schedule: task.schedule,
    startDate: task.startDate,
    status: task.status,
    subjectId: task.subjectId,
    title: task.title,
  }
}

export async function updateRecurringTask(
  id: string,
  input: RecurringTaskPatch,
): Promise<RecurringTask> {
  const ownerId = await requireCurrentUserId()
  const existing = await getRecurringTaskOrThrow(id)
  const parsedPatch = parseInput(recurringTaskPatchSchema, input)
  const parsed = parseInput(recurringTaskInputSchema, {
    ...recurringTaskToInput(existing),
    ...parsedPatch,
  })
  const data = await runInsForge<RecurringTaskRow>(
    () =>
      insforge.database
        .from('recurring_tasks')
        .update(toRecurringTaskPayload(ownerId, parsed))
        .eq('id', id)
        .eq('owner_id', ownerId)
        .select(RECURRING_TASK_COLUMNS)
        .single(),
    'No se pudo actualizar la tarea recurrente.',
  )
  return mapRecurringTask(data)
}

export async function completeRecurringTask(
  id: string,
  dueDate: string,
): Promise<RecurringTask> {
  const ownerId = await requireCurrentUserId()
  const task = await getRecurringTaskOrThrow(id)
  const parsedDueDate = parseInput(habitLocalDateSchema, dueDate)
  const currentOccurrence = await runInsForgeOptional<RecurringTaskOccurrenceRow>(
    () =>
      insforge.database
        .from('recurring_task_occurrences')
        .select(RECURRING_TASK_OCCURRENCE_COLUMNS)
        .eq('owner_id', ownerId)
        .eq('recurring_task_id', id)
        .eq('due_date', parsedDueDate)
        .maybeSingle(),
    'No se pudo revisar la ocurrencia de la tarea.',
  )

  if (currentOccurrence?.status === 'completed') return task
  const versions = await listRecurringTaskScheduleVersions(task.id)
  const currentVersion = [...versions]
    .filter(
      (version) =>
        version.effectiveFrom <= parsedDueDate &&
        (!version.effectiveTo || version.effectiveTo >= parsedDueDate),
    )
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0]
  const nextVersion = [...versions]
    .filter((version) => version.effectiveFrom > parsedDueDate)
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))[0]
  let nextDueDate = getNextScheduledDate(
    currentVersion?.schedule ?? task.schedule,
    currentVersion?.effectiveFrom ?? task.startDate,
    parsedDueDate,
    task.endDate,
  )

  if (nextVersion && (!nextDueDate || nextDueDate >= nextVersion.effectiveFrom)) {
    nextDueDate = getNextScheduledDate(
      nextVersion.schedule,
      nextVersion.effectiveFrom,
      shiftDateKey(nextVersion.effectiveFrom, -1),
      task.endDate,
    )
  }
  const payload: RecurringTaskOccurrencePayload = {
    completed_at: new Date().toISOString(),
    due_date: parsedDueDate,
    owner_id: ownerId,
    recurring_task_id: id,
    rescheduled_to: null,
    status: 'completed',
  }

  if (currentOccurrence) {
    await runInsForgeAction(
      () =>
        insforge.database
          .from('recurring_task_occurrences')
          .update(payload)
          .eq('id', currentOccurrence.id)
          .eq('owner_id', ownerId),
      'No se pudo completar la tarea recurrente.',
    )
  } else {
    await runInsForgeAction(
      () => insforge.database.from('recurring_task_occurrences').insert([payload]),
      'No se pudo registrar la tarea recurrente.',
    )
  }

  const updated = await runInsForge<RecurringTaskRow>(
    () =>
      insforge.database
        .from('recurring_tasks')
        .update({
          next_due_date: nextDueDate ?? parsedDueDate,
          status: nextDueDate ? task.status : 'archived',
        })
        .eq('id', id)
        .eq('owner_id', ownerId)
        .select(RECURRING_TASK_COLUMNS)
        .single(),
    'No se pudo calcular la próxima fecha de la tarea.',
  )

  return mapRecurringTask(updated)
}

export async function rescheduleRecurringTask(
  id: string,
  dueDate: string,
  rescheduledTo: string,
): Promise<RecurringTask> {
  const ownerId = await requireCurrentUserId()
  await getRecurringTaskOrThrow(id)
  const parsedDueDate = parseInput(habitLocalDateSchema, dueDate)
  const parsedRescheduledTo = parseInput(habitLocalDateSchema, rescheduledTo)
  const payload: RecurringTaskOccurrencePayload = {
    completed_at: null,
    due_date: parsedDueDate,
    owner_id: ownerId,
    recurring_task_id: id,
    rescheduled_to: parsedRescheduledTo,
    status: 'rescheduled',
  }
  await runInsForgeAction(
    () => insforge.database.from('recurring_task_occurrences').insert([payload]),
    'No se pudo registrar la reprogramación.',
  )
  const data = await runInsForge<RecurringTaskRow>(
    () =>
      insforge.database
        .from('recurring_tasks')
        .update({ next_due_date: parsedRescheduledTo })
        .eq('id', id)
        .eq('owner_id', ownerId)
        .select(RECURRING_TASK_COLUMNS)
        .single(),
    'No se pudo reprogramar la tarea recurrente.',
  )
  return mapRecurringTask(data)
}

export async function updateRecurringTaskLifecycle(
  id: string,
  status: RecurringTask['status'],
): Promise<RecurringTask> {
  return updateRecurringTask(id, { status })
}

export const habitService = {
  list: listHabits,
  getById: getHabit,
  listScheduleVersions: listHabitScheduleVersions,
  listLogs: listHabitLogs,
  create: createHabit,
  update: updateHabit,
  updateLifecycle: updateHabitLifecycle,
  updateScheduleVersion: updateHabitScheduleVersion,
  saveLog: saveHabitLog,
  deleteLog: deleteHabitLog,
  listNotes: listHabitNotes,
  createNote: createHabitNote,
  updateNote: updateHabitNote,
  deleteNote: deleteHabitNote,
  listRecurringTasks,
  listRecurringTaskOccurrences,
  listRecurringTaskScheduleVersions,
  createRecurringTask,
  updateRecurringTask,
  updateRecurringTaskScheduleVersion,
  completeRecurringTask,
  rescheduleRecurringTask,
  updateRecurringTaskLifecycle,
}
