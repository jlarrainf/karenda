import type { EventInput } from '../services/validation.ts'

export type AiReviewFlag =
  | 'missing_subject'
  | 'unknown_subject'
  | 'unknown_personal_group'
  | 'missing_time'
  | 'ambiguous_date'
  | 'guessed_date'
  | 'uncertain_duration'
  | 'invalid_status'
  | 'new_personal_group'

export interface AiEventDraft {
  draftId: string
  input: EventInput
  newPersonalGroupName: string | null
  reviewFlags: AiReviewFlag[]
}
