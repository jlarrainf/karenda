import type { HabitInput } from '../services/habitValidation.ts'

export type AiHabitReviewFlag =
  | 'unknown_subject'
  | 'unknown_personal_group'
  | 'ambiguous_date'
  | 'guessed_schedule'
  | 'invalid_tracking_type'

export interface AiHabitDraft {
  draftId: string
  input: HabitInput
  reviewFlags: AiHabitReviewFlag[]
}
