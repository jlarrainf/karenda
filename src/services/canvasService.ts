import { insforge } from '../lib/insforge/client.ts'
import type { CalendarEvent } from '../types/domain.ts'
import type {
  CanvasConnection,
  CanvasCourseLink,
  CanvasEventSource,
  CanvasReviewDecision,
  CanvasReviewItem,
  CanvasSyncRun,
} from '../types/canvas.ts'
import { requireCurrentUserId } from './authService.ts'
import { runInsForge, runInsForgeAction } from './errors.ts'
import { entityIdSchema, parseInput } from './validation.ts'

const CONNECTION_FUNCTION = 'karenda-canvas-connection'
const SYNC_FUNCTION = 'karenda-canvas-sync'
const REVIEW_FUNCTION = 'karenda-canvas-review'

type Row = Record<string, unknown>

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function mapConnection(row: Row | null): CanvasConnection | null {
  if (!row) return null
  return {
    id: asString(row.id),
    canvasBaseUrl: asString(row.canvas_base_url),
    authMode: row.auth_mode === 'oauth' ? 'oauth' : 'personal_access_token',
    status:
      row.status === 'expired' || row.status === 'error' || row.status === 'disabled'
        ? row.status
        : 'connected',
    timeZone: asString(row.time_zone),
    tokenExpiresAt: asString(row.token_expires_at),
    lastSyncAt: asNullableString(row.last_sync_at),
    nextSyncAt: asNullableString(row.next_sync_at),
    lastErrorCode: asNullableString(row.last_error_code),
    lastErrorMessage: asNullableString(row.last_error_message),
  }
}

function mapReview(row: Row): CanvasReviewItem {
  return {
    id: asString(row.id),
    courseLinkId: asNullableString(row.course_link_id),
    canvasCourseId: asString(row.canvas_course_id),
    canvasItemType: asNullableString(row.canvas_item_type),
    canvasItemId: asNullableString(row.canvas_item_id),
    reviewKind: row.review_kind as CanvasReviewItem['reviewKind'],
    title: asString(row.title),
    sourceUrl: asNullableString(row.source_url),
    sourceExcerpt: asNullableString(row.source_excerpt),
    academicActivityType:
      asNullableString(row.academic_activity_type) as CanvasReviewItem['academicActivityType'],
    proposedData:
      row.proposed_data && typeof row.proposed_data === 'object'
        ? (row.proposed_data as Record<string, unknown>)
        : {},
    candidateEventIds: Array.isArray(row.candidate_event_ids)
      ? row.candidate_event_ids.filter((id): id is string => typeof id === 'string')
      : [],
    createdAt: asString(row.created_at),
  }
}

export async function getCanvasConnection(): Promise<CanvasConnection | null> {
  const result = await runInsForge<{ connection: Row | null }>(
    () => insforge.functions.invoke(CONNECTION_FUNCTION, { method: 'GET' }),
    'No se pudo cargar la conexión con Canvas.',
  )
  return mapConnection(result.connection)
}

export async function connectCanvas(token: string, tokenExpiresAt: string): Promise<CanvasConnection> {
  const result = await runInsForge<{ connection: Row }>(
    () =>
      insforge.functions.invoke(CONNECTION_FUNCTION, {
        method: 'POST',
        body: { action: 'connect', token, tokenExpiresAt },
      }),
    'No se pudo conectar Canvas.',
  )
  return mapConnection(result.connection)!
}

export async function disconnectCanvas(): Promise<CanvasConnection | null> {
  const result = await runInsForge<{ connection: Row | null }>(
    () =>
      insforge.functions.invoke(CONNECTION_FUNCTION, {
        method: 'POST',
        body: { action: 'disconnect' },
      }),
    'No se pudo desconectar Canvas.',
  )
  return mapConnection(result.connection)
}

export function synchronizeCanvas(): Promise<{
  runId: string
  status: string
  counts: Record<string, number>
}> {
  return runInsForge(
    () => insforge.functions.invoke(SYNC_FUNCTION, { method: 'POST', body: {} }),
    'No se pudo sincronizar Canvas.',
  )
}

export async function listCanvasCourseLinks(): Promise<CanvasCourseLink[]> {
  const ownerId = await requireCurrentUserId()
  const rows = await runInsForge<Row[]>(
    () =>
      insforge.database
        .from('canvas_course_links')
        .select('id, canvas_course_id, subject_id, canvas_name, canvas_code, canvas_term_name')
        .eq('owner_id', ownerId)
        .eq('active', true)
        .order('canvas_name', { ascending: true })
        .limit(500),
    'No se pudieron cargar las asignaturas vinculadas.',
  )
  return rows.map((row) => ({
    id: asString(row.id),
    canvasCourseId: asString(row.canvas_course_id),
    subjectId: asString(row.subject_id),
    canvasName: asString(row.canvas_name),
    canvasCode: asNullableString(row.canvas_code),
    canvasTermName: asNullableString(row.canvas_term_name),
  }))
}

export async function unlinkCanvasCourse(courseLinkId: string): Promise<void> {
  const parsedCourseLinkId = parseInput(entityIdSchema, courseLinkId)

  await runInsForgeAction(
    () =>
      insforge.database.rpc('unlink_canvas_course_link', {
        p_course_link_id: parsedCourseLinkId,
      }),
    'No se pudo desvincular el curso de Canvas.',
  )
}

export async function listCanvasReviews(): Promise<CanvasReviewItem[]> {
  const ownerId = await requireCurrentUserId()
  const rows = await runInsForge<Row[]>(
    () =>
      insforge.database
        .from('canvas_review_items')
        .select('id, course_link_id, canvas_course_id, canvas_item_type, canvas_item_id, review_kind, title, source_url, source_excerpt, academic_activity_type, proposed_data, candidate_event_ids, created_at')
        .eq('owner_id', ownerId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(500),
    'No se pudo cargar la bandeja de revisión.',
  )
  return rows.map(mapReview)
}

export async function listCanvasSyncRuns(): Promise<CanvasSyncRun[]> {
  const ownerId = await requireCurrentUserId()
  const rows = await runInsForge<Row[]>(
    () =>
      insforge.database
        .from('canvas_sync_runs')
        .select('id, trigger_type, status, counts, error_message, started_at, finished_at')
        .eq('owner_id', ownerId)
        .order('started_at', { ascending: false })
        .limit(10),
    'No se pudo cargar el historial de sincronización.',
  )
  return rows.map((row) => ({
    id: asString(row.id),
    triggerType: row.trigger_type === 'scheduled' ? 'scheduled' : 'manual',
    status: row.status as CanvasSyncRun['status'],
    counts:
      row.counts && typeof row.counts === 'object'
        ? (row.counts as Record<string, number>)
        : {},
    errorMessage: asNullableString(row.error_message),
    startedAt: asString(row.started_at),
    finishedAt: asNullableString(row.finished_at),
  }))
}

export async function listCandidateEvents(ids: string[]): Promise<CalendarEvent[]> {
  if (ids.length === 0) return []
  const ownerId = await requireCurrentUserId()
  const rows = await runInsForge<Row[]>(
    () =>
      insforge.database
        .from('events')
        .select('id, owner_id, kind, title, subject_id, personal_group_id, start_at, end_at, is_all_day, status, location, description, academic_activity_type, created_at, updated_at')
        .eq('owner_id', ownerId)
        .in('id', ids)
        .limit(100),
    'No se pudieron cargar los eventos equivalentes.',
  )
  return rows.map((row) => ({
    id: asString(row.id), ownerId: asString(row.owner_id),
    kind: row.kind === 'personal' ? 'personal' : 'academic',
    title: asString(row.title), subjectId: asNullableString(row.subject_id),
    personalGroupId: asNullableString(row.personal_group_id), startAt: asString(row.start_at),
    endAt: asNullableString(row.end_at), isAllDay: row.is_all_day === true,
    status: row.status === 'completed' ? 'completed' : 'pending',
    location: asNullableString(row.location), description: asNullableString(row.description),
    academicActivityType: asNullableString(row.academic_activity_type) as CalendarEvent['academicActivityType'],
    createdAt: asString(row.created_at), updatedAt: asString(row.updated_at),
  }))
}

export async function applyCanvasReview(
  reviewItemId: string,
  decision: CanvasReviewDecision,
  eventId?: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await runInsForge(
    () =>
      insforge.functions.invoke(REVIEW_FUNCTION, {
        method: 'POST',
        body: { reviewItemId, decision, eventId, overrides },
      }),
    'No se pudo aplicar la decisión.',
  )
}

export async function getCanvasEventSource(eventId: string): Promise<CanvasEventSource | null> {
  const ownerId = await requireCurrentUserId()
  const rows = await runInsForge<Row[]>(
    () =>
      insforge.database
        .from('canvas_item_links')
        .select('source_url, canvas_item_type, created_at')
        .eq('owner_id', ownerId)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })
        .limit(1),
    'No se pudo cargar la procedencia del evento.',
  )
  const row = rows[0]
  return row
    ? { sourceUrl: asNullableString(row.source_url), canvasItemType: asString(row.canvas_item_type) }
    : null
}
