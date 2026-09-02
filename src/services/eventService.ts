import { insforge } from '../lib/insforge/client.ts'
import type { Database } from '../lib/insforge/database.types.ts'
import type { CalendarEvent, EventStatus } from '../types/domain.ts'
import { localDateStartToIso, utcDateStartToIso } from '../lib/dates/dateUtils.ts'
import { requireCurrentUserId } from './authService.ts'
import {
  AppError,
  runInsForge,
  runInsForgeAction,
  runInsForgeOptional,
} from './errors.ts'
import {
  entityIdSchema,
  eventInputSchema,
  eventDateSchema,
  eventPatchSchema,
  eventRangeSchema,
  eventStatusSchema,
  parseInput,
  type EventInput,
  type EventPatch,
  type EventRange,
  type NormalizedEventInput,
} from './validation.ts'

type EventRow = Database['public']['Tables']['events']['Row']
type EventPayload = Database['public']['Tables']['events']['Insert']

const EVENT_COLUMNS =
  'id, owner_id, kind, title, subject_id, personal_group_id, start_at, end_at, is_all_day, status, location, description, created_at, updated_at'
const MAX_EVENTS = 1000

function serializeEventDate(value: string, isAllDay: boolean): string {
  if (isAllDay) {
    return `${value.slice(0, 10)}T00:00:00.000Z`
  }

  return new Date(value).toISOString()
}

function serializeRangeDate(value: string): string {
  return new Date(value).toISOString()
}

function getRangeDateKey(value: string): string {
  return value.slice(0, 10)
}

function serializeQueryBoundary(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? localDateStartToIso(value)
    : serializeRangeDate(value)
}

function deserializeEventDate(value: string, isAllDay: boolean): string {
  return isAllDay ? value.slice(0, 10) : value
}

function mapEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    ownerId: row.owner_id,
    kind: row.kind,
    title: row.title,
    subjectId: row.subject_id,
    personalGroupId: row.personal_group_id,
    startAt: deserializeEventDate(row.start_at, row.is_all_day),
    endAt: row.end_at ? deserializeEventDate(row.end_at, row.is_all_day) : null,
    isAllDay: row.is_all_day,
    status: row.status,
    location: row.location,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toEventPayload(ownerId: string, input: NormalizedEventInput): EventPayload {
  return {
    owner_id: ownerId,
    kind: input.kind,
    title: input.title,
    subject_id: input.subjectId ?? null,
    personal_group_id: input.personalGroupId ?? null,
    start_at: serializeEventDate(input.startAt, input.isAllDay),
    end_at: input.endAt ? serializeEventDate(input.endAt, input.isAllDay) : null,
    is_all_day: input.isAllDay,
    status: input.status,
    location: input.location ?? null,
    description: input.description ?? null,
  }
}

function eventToInput(event: CalendarEvent): NormalizedEventInput {
  return {
    kind: event.kind,
    title: event.title,
    subjectId: event.subjectId,
    personalGroupId: event.personalGroupId,
    startAt: event.startAt,
    endAt: event.endAt,
    isAllDay: event.isAllDay,
    status: event.status,
    location: event.location,
    description: event.description,
  }
}

export async function listEvents(range: EventRange): Promise<CalendarEvent[]> {
  const ownerId = await requireCurrentUserId()
  const parsedRange = parseInput(eventRangeSchema, range)
  const startDateKey = getRangeDateKey(parsedRange.startAt)
  const endDateKey = getRangeDateKey(parsedRange.endAt)
  const startAt = serializeQueryBoundary(parsedRange.startAt)
  const endAt = serializeQueryBoundary(parsedRange.endAt)
  const allDayStartAt = utcDateStartToIso(startDateKey)
  const allDayEndAt = utcDateStartToIso(endDateKey)

  const data = await runInsForge<EventRow[]>(
    () =>
      insforge.database
        .from('events')
        .select(EVENT_COLUMNS)
        .eq('owner_id', ownerId)
        .or(
          `and(start_at.gte.${startAt},start_at.lt.${endAt}),and(start_at.lt.${endAt},end_at.gt.${startAt},is_all_day.eq.false),and(is_all_day.eq.true,start_at.lt.${allDayEndAt},end_at.gte.${allDayStartAt})`,
        )
        .order('start_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(MAX_EVENTS),
    'No se pudieron cargar los eventos.',
  )

  return data.map(mapEvent)
}

export async function listUpcomingEvents(startAt: string): Promise<CalendarEvent[]> {
  const ownerId = await requireCurrentUserId()
  const parsedStartAt = parseInput(eventDateSchema, startAt)
  const startDateKey = getRangeDateKey(parsedStartAt)
  const timedStartAt = serializeQueryBoundary(parsedStartAt)
  const allDayStartAt = utcDateStartToIso(startDateKey)

  const data = await runInsForge<EventRow[]>(
    () =>
      insforge.database
        .from('events')
        .select(EVENT_COLUMNS)
        .eq('owner_id', ownerId)
        .or(
          `start_at.gte.${timedStartAt},and(start_at.lt.${timedStartAt},end_at.gt.${timedStartAt},is_all_day.eq.false),and(is_all_day.eq.true,start_at.gte.${allDayStartAt}),and(is_all_day.eq.true,start_at.lt.${allDayStartAt},end_at.gte.${allDayStartAt})`,
        )
        .order('start_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(MAX_EVENTS),
    'No se pudieron cargar los próximos eventos.',
  )

  return data.map(mapEvent)
}

export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const ownerId = await requireCurrentUserId()
  const parsedId = parseInput(entityIdSchema, id)
  const data = await runInsForgeOptional<EventRow>(
    () =>
      insforge.database
        .from('events')
        .select(EVENT_COLUMNS)
        .eq('id', parsedId)
        .eq('owner_id', ownerId)
        .maybeSingle(),
    'No se pudo cargar el evento.',
  )

  return data ? mapEvent(data) : null
}

export async function createEvent(input: EventInput): Promise<CalendarEvent> {
  const ownerId = await requireCurrentUserId()
  const parsed = parseInput(eventInputSchema, input)
  const data = await runInsForge<EventRow>(
    () =>
      insforge.database
        .from('events')
        .insert([toEventPayload(ownerId, parsed)])
        .select(EVENT_COLUMNS)
        .single(),
    'No se pudo crear el evento.',
  )

  return mapEvent(data)
}

export async function updateEvent(
  id: string,
  input: EventPatch,
): Promise<CalendarEvent> {
  const ownerId = await requireCurrentUserId()
  const parsedId = parseInput(entityIdSchema, id)
  const parsedPatch = parseInput(eventPatchSchema, input)
  const existing = await getEvent(parsedId)

  if (!existing) {
    throw new AppError('not_found', 'No se encontró el evento.')
  }

  const parsed = parseInput(eventInputSchema, {
    ...eventToInput(existing),
    ...parsedPatch,
  })
  const data = await runInsForge<EventRow>(
    () =>
      insforge.database
        .from('events')
        .update(toEventPayload(ownerId, parsed))
        .eq('id', parsedId)
        .eq('owner_id', ownerId)
        .select(EVENT_COLUMNS)
        .single(),
    'No se pudo actualizar el evento.',
  )

  return mapEvent(data)
}

export async function deleteEvent(id: string): Promise<void> {
  const ownerId = await requireCurrentUserId()
  const parsedId = parseInput(entityIdSchema, id)
  const event = await getEvent(parsedId)

  if (!event) {
    throw new AppError('not_found', 'No se encontró el evento.')
  }

  await runInsForgeAction(
    () =>
      insforge.database
        .from('events')
        .delete()
        .eq('id', parsedId)
        .eq('owner_id', ownerId),
    'No se pudo eliminar el evento.',
  )
}

export async function updateEventStatus(
  id: string,
  status: EventStatus,
): Promise<CalendarEvent> {
  const parsedStatus = parseInput(eventStatusSchema, status)
  return updateEvent(id, { status: parsedStatus })
}

export const eventService = {
  list: listEvents,
  listUpcoming: listUpcomingEvents,
  getById: getEvent,
  create: createEvent,
  update: updateEvent,
  remove: deleteEvent,
  updateStatus: updateEventStatus,
}
