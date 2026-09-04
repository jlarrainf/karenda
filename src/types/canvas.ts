import type { AcademicActivityType, EntityId, IsoDateTime } from './domain.ts'

export type CanvasConnectionStatus = 'connected' | 'expired' | 'error' | 'disabled'
export type CanvasReviewKind =
  | 'course_mapping'
  | 'event_create'
  | 'event_update'
  | 'conflict'
  | 'source_removed'
  | 'undated'
export type CanvasReviewDecision =
  | 'link_existing'
  | 'create_subject'
  | 'create_event'
  | 'apply_update'
  | 'ignore'

export interface CanvasConnection {
  id: EntityId
  canvasBaseUrl: string
  authMode: 'personal_access_token' | 'oauth'
  status: CanvasConnectionStatus
  timeZone: string
  tokenExpiresAt: IsoDateTime
  lastSyncAt: IsoDateTime | null
  nextSyncAt: IsoDateTime | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
}

export interface CanvasCourseLink {
  id: EntityId
  canvasCourseId: string
  subjectId: EntityId
  canvasName: string
  canvasCode: string | null
  canvasTermName: string | null
}

export interface CanvasReviewItem {
  id: EntityId
  courseLinkId: EntityId | null
  canvasCourseId: string
  canvasItemType: string | null
  canvasItemId: string | null
  reviewKind: CanvasReviewKind
  title: string
  sourceUrl: string | null
  sourceExcerpt: string | null
  academicActivityType: AcademicActivityType | null
  proposedData: Record<string, unknown>
  candidateEventIds: EntityId[]
  createdAt: IsoDateTime
}

export interface CanvasSyncRun {
  id: EntityId
  triggerType: 'manual' | 'scheduled'
  status: 'running' | 'completed' | 'partial' | 'failed'
  counts: Record<string, number>
  errorMessage: string | null
  startedAt: IsoDateTime
  finishedAt: IsoDateTime | null
}

export interface CanvasEventSource {
  sourceUrl: string | null
  canvasItemType: string
}
