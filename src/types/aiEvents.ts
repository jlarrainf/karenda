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
  | 'new_subject'
  | 'new_personal_group'

export interface AiEventQuestionOption {
  id: string
  label: string
}

export interface AiEventQuestion {
  id: string
  question: string
  options: AiEventQuestionOption[]
  allowsOther: boolean
  optional: boolean
}

export interface AiEventQuestionSet {
  kind: 'questions'
  questions: AiEventQuestion[]
}

export interface AiEventAnswer {
  questionId: string
  optionId: string | null
  otherText: string | null
  noPreference: boolean
}

export interface AiEventDraft {
  draftId: string
  input: EventInput
  newSubjectName: string | null
  newPersonalGroupName: string | null
  reviewFlags: AiReviewFlag[]
}
