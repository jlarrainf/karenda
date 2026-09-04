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

export interface AiHabitQuestionOption {
  id: string
  label: string
}

export interface AiHabitQuestion {
  id: string
  question: string
  options: AiHabitQuestionOption[]
  allowsOther: boolean
  optional: boolean
}

export interface AiHabitAnswer {
  questionId: string
  optionId: string | null
  otherText: string | null
  noPreference: boolean
}

export interface AiHabitQuestionSet {
  kind: 'questions'
  questions: AiHabitQuestion[]
}
