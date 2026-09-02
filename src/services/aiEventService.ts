import { z } from 'zod'
import { insforge } from '../lib/insforge/client.ts'
import type { AiEventDraft, AiReviewFlag } from '../types/aiEvents.ts'
import {
  aiEventDraftResponseSchema,
  aiReviewFlagSchema,
  eventInputSchema,
  parseInput,
  type EventInput,
} from './validation.ts'
import { AppError, toAppError } from './errors.ts'

const AI_FUNCTION_SLUG = 'karenda-ai-event-drafts'
const PROMPT_MAX_LENGTH = 4000

const aiPromptSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'Describe al menos un evento.')
    .max(PROMPT_MAX_LENGTH, 'La descripción es demasiado larga.'),
})

export interface GenerateAiEventDraftOptions {
  prompt: string
  timeZone?: string
  referenceDate?: string
  subjectIds?: string[]
  personalGroupIds?: string[]
}

interface AiFunctionEvent {
  kind: EventInput['kind']
  title: string
  subject_id: string | null
  personal_group_id: string | null
  start_at: string
  end_at: string | null
  is_all_day: boolean
  status: EventInput['status']
  location: string | null
  description: string | null
  new_personal_group_name: string | null
  review_flags: AiReviewFlag[]
}

interface AiFunctionResponse {
  events: AiFunctionEvent[]
}

function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function getBrowserDate(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

function isEntityIdInCatalog(id: string | null, ids: Set<string>): boolean {
  return id === null || ids.has(id)
}

function getNormalizedFlags(
  flags: AiReviewFlag[],
  kind: EventInput['kind'],
  subjectId: string | null,
  newPersonalGroupName: string | null,
) {
  const normalized = [...new Set(flags)]

  if (kind === 'academic' && subjectId === null && !normalized.includes('missing_subject')) {
    normalized.push('missing_subject')
  }

  if (
    kind === 'personal' &&
    newPersonalGroupName !== null &&
    !normalized.includes('new_personal_group')
  ) {
    normalized.push('new_personal_group')
  }

  return normalized
}

function mapFunctionEvent(
  event: AiFunctionEvent,
  index: number,
  subjectIds: Set<string>,
  personalGroupIds: Set<string>,
): AiEventDraft {
  if (!isEntityIdInCatalog(event.subject_id, subjectIds)) {
    throw new AppError('validation', 'La IA devolvió una asignatura no disponible.')
  }

  if (!isEntityIdInCatalog(event.personal_group_id, personalGroupIds)) {
    throw new AppError('validation', 'La IA devolvió un grupo personal no disponible.')
  }

  const input: EventInput = {
    description: event.description,
    endAt: event.end_at,
    isAllDay: event.is_all_day,
    kind: event.kind,
    location: event.location,
    personalGroupId: event.personal_group_id,
    startAt: event.start_at,
    status: event.status,
    subjectId: event.subject_id,
    title: event.title,
  }
  const parsedInput = eventInputSchema.safeParse(input)
  const reviewFlags = getNormalizedFlags(
    event.review_flags,
    event.kind,
    event.subject_id,
    event.new_personal_group_name,
  )

  const onlyMissingSubjectError =
    !parsedInput.success &&
    parsedInput.error.issues.every((issue) => issue.path[0] === 'subjectId')

  if (!parsedInput.success && !onlyMissingSubjectError) {
    throw new AppError(
      'validation',
      parsedInput.error.issues[0]?.message ?? 'La IA devolvió un evento no válido.',
    )
  }

  return {
    draftId: `ai-draft-${index + 1}`,
    input,
    newPersonalGroupName: event.new_personal_group_name,
    reviewFlags,
  }
}

function parseFunctionResponse(
  value: unknown,
  subjectIds: Set<string>,
  personalGroupIds: Set<string>,
): AiEventDraft[] {
  const parsed = aiEventDraftResponseSchema.safeParse(value)

  if (!parsed.success) {
    throw new AppError('validation', 'La IA no devolvió borradores válidos.')
  }

  return parsed.data.events.map((event, index) =>
    mapFunctionEvent(event, index, subjectIds, personalGroupIds),
  )
}

export async function generateAiEventDrafts(
  options: GenerateAiEventDraftOptions,
): Promise<AiEventDraft[]> {
  const parsedOptions = parseInput(aiPromptSchema, options)
  const timeZone = options.timeZone?.trim() || getBrowserTimeZone()
  const referenceDate = options.referenceDate?.trim() || getBrowserDate(timeZone)
  const { data, error } = await insforge.functions.invoke(AI_FUNCTION_SLUG, {
    body: {
      prompt: parsedOptions.prompt,
      reference_date: referenceDate,
      time_zone: timeZone,
    },
  })

  if (error) {
    throw toAppError(error, 'No se pudieron preparar los eventos.')
  }

  const response = data as AiFunctionResponse | undefined
  const subjectIds = new Set(options.subjectIds ?? [])
  const personalGroupIds = new Set(options.personalGroupIds ?? [])

  return parseFunctionResponse(response, subjectIds, personalGroupIds)
}

export async function requestAiEventDrafts(
  options: GenerateAiEventDraftOptions,
): Promise<AiEventDraft[]> {
  return generateAiEventDrafts(options)
}

export function isValidAiEventDraft(input: EventInput): boolean {
  return eventInputSchema.safeParse(input).success
}

export { aiReviewFlagSchema }
