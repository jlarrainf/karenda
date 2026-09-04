import { z } from 'zod'
import { insforge } from '../lib/insforge/client.ts'
import type {
  AiHabitAnswer,
  AiHabitDraft,
  AiHabitQuestionSet,
  AiHabitReviewFlag,
} from '../types/aiHabits.ts'
import {
  habitInputSchema,
  type HabitInput,
} from './habitValidation.ts'
import { AppError, toAppError } from './errors.ts'
import { parseInput } from './validation.ts'

const AI_FUNCTION_SLUG = 'karenda-ai-habit-drafts'
const PROMPT_MAX_LENGTH = 4000

const aiPromptSchema = z.object({
  prompt: z.string().trim().min(1, 'Describe al menos un hábito.').max(
    PROMPT_MAX_LENGTH,
    'La descripción es demasiado larga.',
  ),
})

const aiFunctionHabitSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  subject_id: z.string().uuid().nullable(),
  personal_group_id: z.string().uuid().nullable(),
  tracking_type: z.enum(['boolean', 'count', 'duration']),
  unit: z.string().nullable(),
  goal_value: z.number(),
  evaluation_mode: z.enum(['scheduled_occurrence', 'period_quota']),
  quota_period: z.enum(['day', 'week', 'month']).nullable(),
  miss_policy: z.enum(['mark_missed', 'keep_pending']),
  schedule: z.object({
    unit: z.enum(['day', 'week', 'month']),
    interval: z.number(),
    weekdays: z.array(z.number()),
    dayOfMonth: z.number().nullable(),
    anchorDate: z.string().nullable(),
  }),
  start_date: z.string(),
  end_date: z.string().nullable(),
  lifecycle_status: z.enum(['active', 'paused', 'archived']),
  stats_enabled: z.boolean(),
  note_policy: z.enum(['none', 'general', 'daily', 'both']),
  calendar_enabled: z.boolean(),
  calendar_schedule: z.object({
    mode: z.enum(['rule', 'active_days', 'custom']),
    weekdays: z.array(z.number()),
    dates: z.array(z.string()),
  }).nullable(),
  review_flags: z.array(z.string()).default([]),
})

const aiFunctionQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  question: z.string().min(1).max(240),
  options: z.array(z.object({ id: z.string().min(1).max(80), label: z.string().min(1).max(160) })).min(1).max(6),
  allows_other: z.boolean(),
  optional: z.boolean(),
})

interface AiFunctionResponse {
  habits?: z.infer<typeof aiFunctionHabitSchema>[]
  questions?: z.infer<typeof aiFunctionQuestionSchema>[]
}

function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function getBrowserDate(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function mapHabit(value: z.infer<typeof aiFunctionHabitSchema>, index: number, subjectIds: Set<string>, groupIds: Set<string>): AiHabitDraft {
  const subjectId = value.subject_id && subjectIds.has(value.subject_id) ? value.subject_id : null
  const personalGroupId = value.personal_group_id && groupIds.has(value.personal_group_id) ? value.personal_group_id : null
  const flags = [...new Set(value.review_flags)].filter((flag): flag is AiHabitReviewFlag =>
    ['unknown_subject', 'unknown_personal_group', 'ambiguous_date', 'guessed_schedule', 'invalid_tracking_type'].includes(flag),
  )
  if (value.subject_id && !subjectId) flags.push('unknown_subject')
  if (value.personal_group_id && !personalGroupId) flags.push('unknown_personal_group')
  const isDurationUnit = value.unit?.toLocaleLowerCase().match(/hora|minuto|hour|minute/)
  const trackingType = value.tracking_type === 'boolean' && value.unit
    ? isDurationUnit ? 'duration' : 'count'
    : value.tracking_type === 'boolean' && value.goal_value !== 1
      ? 'count'
      : value.tracking_type
  const unit = trackingType === 'boolean' ? null : value.unit ?? (trackingType === 'count' ? 'veces' : 'minutos')
  const goalValue = trackingType === 'boolean' ? 1 : value.goal_value > 0 ? value.goal_value : 1
  const input: HabitInput = {
    calendarEnabled: value.calendar_enabled,
    calendarSchedule: value.calendar_schedule,
    color: value.color,
    description: value.description,
    endDate: value.end_date,
    evaluationMode: value.evaluation_mode,
    goalValue,
    lifecycleStatus: value.lifecycle_status,
    missPolicy: value.miss_policy,
    name: value.name,
    notePolicy: value.note_policy,
    personalGroupId,
    quotaPeriod: value.quota_period,
    schedule: value.schedule,
    startDate: value.start_date,
    statsEnabled: value.stats_enabled,
    subjectId,
    trackingType,
    unit,
  }
  const parsed = habitInputSchema.safeParse(input)
  if (!parsed.success) throw new AppError('validation', parsed.error.issues[0]?.message ?? 'La IA devolvió un hábito no válido.')
  return { draftId: `ai-habit-draft-${index + 1}`, input: parsed.data, reviewFlags: [...new Set(flags)] }
}

export interface GenerateAiHabitDraftOptions { prompt: string; timeZone?: string; referenceDate?: string; subjectIds?: string[]; personalGroupIds?: string[] }

export interface GenerateAiHabitPlanOptions extends GenerateAiHabitDraftOptions {
  mode: 'quick' | 'guided'
  answers?: AiHabitAnswer[]
}

function mapQuestions(questions: z.infer<typeof aiFunctionQuestionSchema>[]): AiHabitQuestionSet {
  return {
    kind: 'questions',
    questions: questions.map((question) => ({
      allowsOther: question.allows_other,
      id: question.id,
      optional: question.optional,
      options: question.options,
      question: question.question,
    })),
  }
}

export async function requestAiHabitPlan(options: GenerateAiHabitPlanOptions): Promise<AiHabitDraft[] | AiHabitQuestionSet> {
  const parsed = parseInput(aiPromptSchema, options)
  const timeZone = options.timeZone?.trim() || getBrowserTimeZone()
  const referenceDate = options.referenceDate?.trim() || getBrowserDate(timeZone)
  try {
    const { data, error } = await insforge.functions.invoke(AI_FUNCTION_SLUG, { body: {
      answers: options.answers?.map((answer) => ({
        no_preference: answer.noPreference,
        option_id: answer.optionId,
        other_text: answer.otherText,
        question_id: answer.questionId,
      })),
      mode: options.mode,
      prompt: parsed.prompt,
      reference_date: referenceDate,
      time_zone: timeZone,
    } })
    if (error) throw error
    const response = data as AiFunctionResponse | undefined
    if (options.mode === 'guided' && !options.answers?.length && response?.questions) {
      const questions = response.questions.map((question) => aiFunctionQuestionSchema.parse(question))
      if (questions.length > 5) throw new AppError('validation', 'La IA devolvió demasiadas preguntas.')
      return mapQuestions(questions)
    }
    if (!response || !Array.isArray(response.habits) || response.habits.length > 10) throw new AppError('validation', 'La IA no devolvió borradores válidos.')
    const subjectIds = new Set(options.subjectIds ?? [])
    const groupIds = new Set(options.personalGroupIds ?? [])
    return response.habits.map((habit, index) => mapHabit(aiFunctionHabitSchema.parse(habit), index, subjectIds, groupIds))
  } catch (error) {
    throw toAppError(error, 'No se pudieron preparar los hábitos.')
  }
}

export async function requestAiHabitDrafts(options: GenerateAiHabitDraftOptions): Promise<AiHabitDraft[]> {
  const result = await requestAiHabitPlan({ ...options, mode: 'quick' })
  return result as AiHabitDraft[]
}

export { habitInputSchema }
