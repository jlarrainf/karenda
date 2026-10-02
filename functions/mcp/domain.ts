/* eslint-disable @typescript-eslint/no-explicit-any -- Dynamic PostgREST builders keep the table projections shared with existing Karenda services. */
import { createClient } from "npm:@insforge/sdk@1.5.2";
import {
  eventInputSchema,
  eventPatchSchema,
  eventRangeSchema,
  eventStatusSchema,
  noteInputSchema,
  notePatchSchema,
  parseInput,
  personalGroupInputSchema,
  personalGroupPatchSchema,
  subjectInputSchema,
  subjectPatchSchema,
} from "../../src/services/validation.ts";
import {
  habitInputSchema,
  habitLogInputSchema,
  habitNoteInputSchema,
  habitNotePatchSchema,
  habitPatchSchema,
  habitRangeSchema,
  habitLocalDateSchema,
  recurringTaskInputSchema,
  recurringTaskPatchSchema,
  recurringTaskScheduleVersionInputSchema,
} from "../../src/services/habitValidation.ts";
import { getNextScheduledDate } from "../../src/features/habits/utils/habitRecurrence.ts";
import { calculateHabitStatistics, evaluateHabitRange } from "../../src/features/habits/utils/habitEvaluation.ts";
import { shiftDateKey } from "../../src/lib/dates/dateUtils.ts";
import type { Habit, HabitLog, HabitScheduleVersion } from "../../src/types/domain.ts";
import type { McpPrincipal } from "./oauth.ts";

export type KarendaClient = ReturnType<typeof createClient>;

export class DomainOperationError extends Error {
  constructor(
    readonly code: "invalid_argument" | "not_found" | "conflict" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "DomainOperationError";
  }
}

type Row = Record<string, any>;

function database(client: KarendaClient, table: string): any {
  return (client.database as any).from(table);
}

function ownerQuery(client: KarendaClient, table: string, ownerId: string): any {
  const builder = database(client, table);
  return {
    select: (...args: unknown[]) => builder.select(...args).eq("owner_id", ownerId),
    update: (...args: unknown[]) => builder.update(...args).eq("owner_id", ownerId),
    delete: (...args: unknown[]) => builder.delete(...args).eq("owner_id", ownerId),
  };
}

function raiseDatabaseError(error: unknown, fallback: string): never {
  const status = typeof error === "object" && error !== null
    ? Number((error as Record<string, unknown>).status ?? (error as Record<string, unknown>).statusCode)
    : 0;
  if (status === 409 || status === 23503 || status === 23505) {
    throw new DomainOperationError(
      "conflict",
      "La operación entra en conflicto con datos asociados. Revisa las relaciones y vuelve a intentarlo.",
    );
  }
  throw new DomainOperationError("unavailable", fallback);
}

async function queryData<T>(operation: PromiseLike<{ data: T | null; error: unknown }>, fallback: string): Promise<T> {
  try {
    const result = await operation;
    if (result.error) raiseDatabaseError(result.error, fallback);
    if (result.data === null) throw new DomainOperationError("unavailable", fallback);
    return result.data;
  } catch (error) {
    if (error instanceof DomainOperationError) throw error;
    raiseDatabaseError(error, fallback);
  }
}

async function queryOptional<T>(operation: PromiseLike<{ data: T | null; error: unknown }>, fallback: string): Promise<T | null> {
  try {
    const result = await operation;
    if (result.error) raiseDatabaseError(result.error, fallback);
    return result.data;
  } catch (error) {
    if (error instanceof DomainOperationError) throw error;
    raiseDatabaseError(error, fallback);
  }
}

function validate<T>(schema: Parameters<typeof parseInput>[0], value: unknown): T {
  try {
    return parseInput(schema as never, value) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Los datos no son válidos.";
    throw new DomainOperationError("invalid_argument", message);
  }
}

function ensureChangedVersion(row: Row, expectedUpdatedAt?: string): void {
  if (expectedUpdatedAt && row.updated_at !== expectedUpdatedAt) {
    throw new DomainOperationError(
      "conflict",
      "El registro cambió desde la última consulta. Vuelve a leerlo antes de modificarlo.",
    );
  }
}

async function requireOwnedRow(
  client: KarendaClient,
  table: string,
  ownerId: string,
  id: string,
  columns: string,
  missingMessage: string,
): Promise<Row> {
  const row = await queryOptional<Row>(
    ownerQuery(client, table, ownerId).select(columns).eq("id", id).maybeSingle(),
    "No se pudo leer el registro.",
  );
  if (!row) throw new DomainOperationError("not_found", missingMessage);
  return row;
}

async function requireOwnedRelation(
  client: KarendaClient,
  table: "subjects" | "personal_groups",
  ownerId: string,
  id: string | null | undefined,
): Promise<void> {
  if (!id) return;
  const relation = await queryOptional<Row>(
    ownerQuery(client, table, ownerId).select("id").eq("id", id).maybeSingle(),
    "No se pudo validar la relación del registro.",
  );
  if (!relation) {
    throw new DomainOperationError("invalid_argument", "La relación indicada no pertenece a esta cuenta.");
  }
}

function mapEvent(row: Row): Record<string, unknown> {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    subjectId: row.subject_id,
    personalGroupId: row.personal_group_id,
    startAt: row.is_all_day ? String(row.start_at).slice(0, 10) : row.start_at,
    endAt: row.end_at ? row.is_all_day ? String(row.end_at).slice(0, 10) : row.end_at : null,
    isAllDay: row.is_all_day,
    status: row.status,
    location: row.location,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const EVENT_COLUMNS = "id, owner_id, kind, title, subject_id, personal_group_id, start_at, end_at, is_all_day, status, location, description, created_at, updated_at";
const EVENT_LIMIT = 100;
const MAX_EVENT_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

function serializeEventDate(value: string, isAllDay: boolean): string {
  return isAllDay ? `${value.slice(0, 10)}T00:00:00.000Z` : new Date(value).toISOString();
}

export async function listEvents(
  client: KarendaClient,
  principal: McpPrincipal,
  input: { startAt: string; endAt: string; limit?: number; offset?: number },
): Promise<{ events: Record<string, unknown>[]; nextOffset: number | null }> {
  const range = validate<{ startAt: string; endAt: string }>(eventRangeSchema, input);
  const startAt = new Date(range.startAt).toISOString();
  const endAt = new Date(range.endAt).toISOString();
  if (Date.parse(endAt) - Date.parse(startAt) > MAX_EVENT_RANGE_MS) {
    throw new DomainOperationError("invalid_argument", "El intervalo no puede superar 366 días.");
  }
  const limit = Math.max(1, Math.min(input.limit ?? 50, EVENT_LIMIT));
  const offset = Math.max(0, Math.min(input.offset ?? 0, 10000));

  const startRows = await queryData<Row[]>(
    ownerQuery(client, "events", principal.ownerId)
      .select(EVENT_COLUMNS)
      .gte("start_at", startAt)
      .lt("start_at", endAt)
      .order("start_at", { ascending: true })
      .limit(1000),
    "No se pudieron cargar los eventos.",
  );
  const overlapRows = await queryData<Row[]>(
    ownerQuery(client, "events", principal.ownerId)
      .select(EVENT_COLUMNS)
      .lt("start_at", startAt)
      .gt("end_at", startAt)
      .order("start_at", { ascending: true })
      .limit(1000),
    "No se pudieron cargar los eventos.",
  );
  const rows = [...new Map([...startRows, ...overlapRows].map((row) => [row.id, row])).values()]
    .sort((left, right) => String(left.start_at).localeCompare(String(right.start_at)) || String(left.id).localeCompare(String(right.id)));
  const page = rows.slice(offset, offset + limit);
  return {
    events: page.map(mapEvent),
    nextOffset: offset + page.length < rows.length ? offset + page.length : null,
  };
}

export async function getEvent(client: KarendaClient, principal: McpPrincipal, id: string): Promise<Record<string, unknown>> {
  const row = await requireOwnedRow(client, "events", principal.ownerId, id, EVENT_COLUMNS, "No se encontró el evento.");
  return mapEvent(row);
}

function eventPayload(ownerId: string, input: Record<string, any>): Row {
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
  };
}

export async function createEvent(client: KarendaClient, principal: McpPrincipal, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const parsed = validate<Record<string, any>>(eventInputSchema, input);
  await requireOwnedRelation(client, "subjects", principal.ownerId, parsed.subjectId);
  await requireOwnedRelation(client, "personal_groups", principal.ownerId, parsed.personalGroupId);
  const row = await queryData<Row>(
    database(client, "events")
      .insert([eventPayload(principal.ownerId, parsed)])
      .select(EVENT_COLUMNS)
      .single(),
    "No se pudo crear el evento.",
  );
  return mapEvent(row);
}

function rowToEventInput(row: Row): Record<string, unknown> {
  return {
    kind: row.kind,
    title: row.title,
    subjectId: row.subject_id,
    personalGroupId: row.personal_group_id,
    startAt: row.is_all_day ? String(row.start_at).slice(0, 10) : row.start_at,
    endAt: row.end_at ? row.is_all_day ? String(row.end_at).slice(0, 10) : row.end_at : null,
    isAllDay: row.is_all_day,
    status: row.status,
    location: row.location,
    description: row.description,
  };
}

export async function updateEvent(
  client: KarendaClient,
  principal: McpPrincipal,
  id: string,
  patch: Record<string, unknown>,
  expectedUpdatedAt?: string,
): Promise<Record<string, unknown>> {
  const existing = await requireOwnedRow(client, "events", principal.ownerId, id, EVENT_COLUMNS, "No se encontró el evento.");
  ensureChangedVersion(existing, expectedUpdatedAt);
  const parsedPatch = validate<Record<string, unknown>>(eventPatchSchema, patch);
  const parsed = validate<Record<string, any>>(eventInputSchema, { ...rowToEventInput(existing), ...parsedPatch });
  await requireOwnedRelation(client, "subjects", principal.ownerId, parsed.subjectId);
  await requireOwnedRelation(client, "personal_groups", principal.ownerId, parsed.personalGroupId);
  let query = ownerQuery(client, "events", principal.ownerId)
    .update(eventPayload(principal.ownerId, parsed))
    .eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const row = await queryOptional<Row>(query.select(EVENT_COLUMNS).maybeSingle(), "No se pudo actualizar el evento.");
  if (!row) throw new DomainOperationError("conflict", "El evento cambió antes de guardarse. Vuelve a leerlo.");
  return mapEvent(row);
}

export async function setEventStatus(client: KarendaClient, principal: McpPrincipal, id: string, status: string, expectedUpdatedAt?: string): Promise<Record<string, unknown>> {
  const parsedStatus = validate<string>(eventStatusSchema, status);
  return await updateEvent(client, principal, id, { status: parsedStatus }, expectedUpdatedAt);
}

export async function deleteEvent(client: KarendaClient, principal: McpPrincipal, id: string, expectedUpdatedAt?: string): Promise<void> {
  const existing = await requireOwnedRow(client, "events", principal.ownerId, id, EVENT_COLUMNS, "No se encontró el evento.");
  ensureChangedVersion(existing, expectedUpdatedAt);
  let query = ownerQuery(client, "events", principal.ownerId).delete().eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const row = await queryOptional<Row>(query.select("id").maybeSingle(), "No se pudo eliminar el evento.");
  if (!row) throw new DomainOperationError("conflict", "El evento cambió antes de eliminarse. Vuelve a leerlo.");
}

export async function listSubjects(client: KarendaClient, principal: McpPrincipal): Promise<Row[]> {
  return await queryData<Row[]>(ownerQuery(client, "subjects", principal.ownerId)
    .select("id, name, code, abbreviation, color, created_at, updated_at")
    .order("name", { ascending: true }).order("id", { ascending: true }).limit(500), "No se pudieron cargar las asignaturas.");
}

export async function listPersonalGroups(client: KarendaClient, principal: McpPrincipal): Promise<Row[]> {
  return await queryData<Row[]>(ownerQuery(client, "personal_groups", principal.ownerId)
    .select("id, name, color, created_at, updated_at")
    .order("name", { ascending: true }).order("id", { ascending: true }).limit(500), "No se pudieron cargar los grupos personales.");
}

export async function getCatalog(client: KarendaClient, principal: McpPrincipal, table: "subjects" | "personal_groups", id: string): Promise<Row> {
  const columns = table === "subjects"
    ? "id, name, code, abbreviation, color, created_at, updated_at"
    : "id, name, color, created_at, updated_at";
  return await requireOwnedRow(client, table, principal.ownerId, id, columns, table === "subjects" ? "No se encontró la asignatura." : "No se encontró el grupo personal.");
}

async function saveCatalog(
  client: KarendaClient,
  principal: McpPrincipal,
  table: "subjects" | "personal_groups",
  id: string | null,
  input: Record<string, unknown>,
  expectedUpdatedAt?: string,
): Promise<Row> {
  const isSubject = table === "subjects";
  const schema = isSubject ? id ? subjectPatchSchema : subjectInputSchema : id ? personalGroupPatchSchema : personalGroupInputSchema;
  const parsed = validate<Record<string, any>>(schema, input);
  if (id) {
    const current = await requireOwnedRow(client, table, principal.ownerId, id, "id, updated_at", "No se encontró el registro.");
    ensureChangedVersion(current, expectedUpdatedAt);
  }
  const payload = isSubject
    ? { name: parsed.name, code: parsed.code, abbreviation: parsed.abbreviation, color: parsed.color }
    : { name: parsed.name, color: parsed.color };
  const returnColumns = isSubject
    ? "id, name, code, abbreviation, color, created_at, updated_at"
    : "id, name, color, created_at, updated_at";
  if (!id) {
    return await queryData<Row>(database(client, table).insert([{ owner_id: principal.ownerId, ...payload }])
      .select(returnColumns).single(), "No se pudo crear el registro.");
  }
  let query = ownerQuery(client, table, principal.ownerId).update(payload).eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const row = await queryOptional<Row>(query.select(returnColumns).maybeSingle(), "No se pudo actualizar el registro.");
  if (!row) throw new DomainOperationError("conflict", "El registro cambió antes de guardarse. Vuelve a leerlo.");
  return row;
}

export async function createSubject(client: KarendaClient, principal: McpPrincipal, input: Record<string, unknown>): Promise<Row> {
  return await saveCatalog(client, principal, "subjects", null, input);
}
export async function updateSubject(client: KarendaClient, principal: McpPrincipal, id: string, input: Record<string, unknown>, expectedUpdatedAt?: string): Promise<Row> {
  return await saveCatalog(client, principal, "subjects", id, input, expectedUpdatedAt);
}
export async function createPersonalGroup(client: KarendaClient, principal: McpPrincipal, input: Record<string, unknown>): Promise<Row> {
  return await saveCatalog(client, principal, "personal_groups", null, input);
}
export async function updatePersonalGroup(client: KarendaClient, principal: McpPrincipal, id: string, input: Record<string, unknown>, expectedUpdatedAt?: string): Promise<Row> {
  return await saveCatalog(client, principal, "personal_groups", id, input, expectedUpdatedAt);
}

export async function deleteCatalog(client: KarendaClient, principal: McpPrincipal, table: "subjects" | "personal_groups", id: string, expectedUpdatedAt?: string): Promise<void> {
  const current = await requireOwnedRow(client, table, principal.ownerId, id, "id, updated_at", "No se encontró el registro.");
  ensureChangedVersion(current, expectedUpdatedAt);
  let query = ownerQuery(client, table, principal.ownerId).delete().eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const result = await queryOptional<Row>(query.select("id").maybeSingle(), "No se pudo eliminar el registro.");
  if (!result) throw new DomainOperationError("conflict", "El registro cambió antes de eliminarse.");
}

export async function listNotes(client: KarendaClient, principal: McpPrincipal, targetType: "subject" | "personal_group", targetId: string): Promise<Row[]> {
  await requireOwnedRelation(client, targetType === "subject" ? "subjects" : "personal_groups", principal.ownerId, targetId);
  return await queryData<Row[]>(ownerQuery(client, "notes", principal.ownerId)
    .select("id, target_type, target_id, title, content_markdown, created_at, updated_at")
    .eq("target_type", targetType).eq("target_id", targetId)
    .order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(500), "No se pudieron cargar las notas.");
}

export async function getNote(client: KarendaClient, principal: McpPrincipal, id: string): Promise<Row> {
  return await requireOwnedRow(client, "notes", principal.ownerId, id, "id, target_type, target_id, title, content_markdown, created_at, updated_at", "No se encontró la nota.");
}

export async function createNote(client: KarendaClient, principal: McpPrincipal, input: Record<string, unknown>): Promise<Row> {
  const parsed = validate<Record<string, any>>(noteInputSchema, input);
  await requireOwnedRelation(client, parsed.targetType === "subject" ? "subjects" : "personal_groups", principal.ownerId, parsed.targetId);
  return await queryData<Row>(database(client, "notes").insert([{
    owner_id: principal.ownerId,
    target_type: parsed.targetType,
    target_id: parsed.targetId,
    title: parsed.title,
    content_markdown: parsed.contentMarkdown,
  }]).select("id, target_type, target_id, title, content_markdown, created_at, updated_at").single(), "No se pudo crear la nota.");
}

export async function updateNote(client: KarendaClient, principal: McpPrincipal, id: string, patch: Record<string, unknown>, expectedUpdatedAt?: string): Promise<Row> {
  const current = await requireOwnedRow(client, "notes", principal.ownerId, id, "id, target_type, target_id, title, content_markdown, updated_at", "No se encontró la nota.");
  ensureChangedVersion(current, expectedUpdatedAt);
  const parsed = validate<Record<string, any>>(notePatchSchema, patch);
  const merged = { targetType: current.target_type, targetId: current.target_id, title: current.title, contentMarkdown: current.content_markdown, ...parsed };
  validate(noteInputSchema, merged);
  await requireOwnedRelation(client, merged.targetType === "subject" ? "subjects" : "personal_groups", principal.ownerId, merged.targetId);
  let query = ownerQuery(client, "notes", principal.ownerId).update({
    target_type: parsed.targetType,
    target_id: parsed.targetId,
    title: parsed.title,
    content_markdown: parsed.contentMarkdown,
  }).eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const row = await queryOptional<Row>(query.select("id, target_type, target_id, title, content_markdown, created_at, updated_at").maybeSingle(), "No se pudo actualizar la nota.");
  if (!row) throw new DomainOperationError("conflict", "La nota cambió antes de guardarse. Vuelve a leerla.");
  return row;
}

export async function deleteNote(client: KarendaClient, principal: McpPrincipal, id: string, expectedUpdatedAt?: string): Promise<void> {
  const current = await requireOwnedRow(client, "notes", principal.ownerId, id, "id, updated_at", "No se encontró la nota.");
  ensureChangedVersion(current, expectedUpdatedAt);
  let query = ownerQuery(client, "notes", principal.ownerId).delete().eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const row = await queryOptional<Row>(query.select("id").maybeSingle(), "No se pudo eliminar la nota.");
  if (!row) throw new DomainOperationError("conflict", "La nota cambió antes de eliminarse.");
}

const HABIT_COLUMNS = "id, name, description, color, subject_id, personal_group_id, tracking_type, unit, goal_value, evaluation_mode, quota_period, miss_policy, schedule, start_date, end_date, lifecycle_status, stats_enabled, note_policy, calendar_enabled, calendar_schedule, created_at, updated_at";
const HABIT_LOG_COLUMNS = "id, habit_id, local_date, value, status, source, external_id, created_at, updated_at";
const HABIT_NOTE_COLUMNS = "id, habit_id, entry_date, title, content_markdown, created_at, updated_at";
const HABIT_VERSION_COLUMNS = "id, habit_id, schedule, evaluation_mode, goal_value, quota_period, miss_policy, effective_from, effective_to, created_at, updated_at";

function mapHabitLog(row: Row, ownerId: string): HabitLog {
  return {
    id: row.id,
    ownerId,
    habitId: row.habit_id,
    localDate: row.local_date,
    value: Number(row.value),
    status: row.status,
    source: row.source,
    externalId: row.external_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHabitScheduleVersion(row: Row, ownerId: string): HabitScheduleVersion {
  return {
    id: row.id,
    ownerId,
    habitId: row.habit_id,
    schedule: row.schedule,
    evaluationMode: row.evaluation_mode,
    goalValue: Number(row.goal_value),
    quotaPeriod: row.quota_period,
    missPolicy: row.miss_policy,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHabit(row: Row): Row {
  return {
    id: row.id, name: row.name, description: row.description, color: row.color,
    subjectId: row.subject_id, personalGroupId: row.personal_group_id,
    trackingType: row.tracking_type, unit: row.unit, goalValue: row.goal_value,
    evaluationMode: row.evaluation_mode, quotaPeriod: row.quota_period,
    missPolicy: row.miss_policy, schedule: row.schedule, startDate: row.start_date,
    endDate: row.end_date, lifecycleStatus: row.lifecycle_status,
    statsEnabled: row.stats_enabled, notePolicy: row.note_policy,
    calendarEnabled: row.calendar_enabled, calendarSchedule: row.calendar_schedule,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function habitPayload(ownerId: string, input: Row): Row {
  return {
    owner_id: ownerId, name: input.name, description: input.description, color: input.color,
    subject_id: input.subjectId, personal_group_id: input.personalGroupId,
    tracking_type: input.trackingType, unit: input.unit, goal_value: input.goalValue,
    evaluation_mode: input.evaluationMode, quota_period: input.quotaPeriod,
    miss_policy: input.missPolicy, schedule: input.schedule, start_date: input.startDate,
    end_date: input.endDate, lifecycle_status: input.lifecycleStatus,
    stats_enabled: input.statsEnabled, note_policy: input.notePolicy,
    calendar_enabled: input.calendarEnabled, calendar_schedule: input.calendarSchedule,
  };
}

export async function listHabits(client: KarendaClient, principal: McpPrincipal, includeArchived = false): Promise<Row[]> {
  let query = ownerQuery(client, "habits", principal.ownerId).select(HABIT_COLUMNS);
  if (!includeArchived) query = query.in("lifecycle_status", ["active", "paused"]);
  const rows = await queryData<Row[]>(query.order("name", { ascending: true }).order("id", { ascending: true }).limit(500), "No se pudieron cargar los hábitos.");
  return rows.map(mapHabit);
}

export async function getHabit(client: KarendaClient, principal: McpPrincipal, id: string): Promise<Row> {
  const row = await requireOwnedRow(client, "habits", principal.ownerId, id, HABIT_COLUMNS, "No se encontró el hábito.");
  return mapHabit(row);
}

async function createHabitScheduleVersion(client: KarendaClient, principal: McpPrincipal, habit: Row): Promise<void> {
  const result = await database(client, "habit_schedule_versions").insert([{
    owner_id: principal.ownerId,
    habit_id: habit.id,
    schedule: habit.schedule,
    evaluation_mode: habit.evaluation_mode,
    goal_value: habit.goal_value,
    quota_period: habit.quota_period,
    miss_policy: habit.miss_policy,
    effective_from: habit.start_date,
  }]);
  if (result.error) {
    await ownerQuery(client, "habits", principal.ownerId).delete().eq("id", habit.id);
    raiseDatabaseError(result.error, "No se pudo guardar la regla inicial del hábito.");
  }
}

export async function createHabit(client: KarendaClient, principal: McpPrincipal, input: Record<string, unknown>): Promise<Row> {
  const parsed = validate<Row>(habitInputSchema, input);
  await requireOwnedRelation(client, "subjects", principal.ownerId, parsed.subjectId);
  await requireOwnedRelation(client, "personal_groups", principal.ownerId, parsed.personalGroupId);
  const row = await queryData<Row>(database(client, "habits").insert([habitPayload(principal.ownerId, parsed)]).select(HABIT_COLUMNS).single(), "No se pudo crear el hábito.");
  await createHabitScheduleVersion(client, principal, row);
  return mapHabit(row);
}

export async function updateHabit(client: KarendaClient, principal: McpPrincipal, id: string, patch: Record<string, unknown>, expectedUpdatedAt?: string): Promise<Row> {
  const current = await requireOwnedRow(client, "habits", principal.ownerId, id, HABIT_COLUMNS, "No se encontró el hábito.");
  ensureChangedVersion(current, expectedUpdatedAt);
  const merged = {
    name: current.name, description: current.description, color: current.color,
    subjectId: current.subject_id, personalGroupId: current.personal_group_id,
    trackingType: current.tracking_type, unit: current.unit, goalValue: current.goal_value,
    evaluationMode: current.evaluation_mode, quotaPeriod: current.quota_period,
    missPolicy: current.miss_policy, schedule: current.schedule, startDate: current.start_date,
    endDate: current.end_date, lifecycleStatus: current.lifecycle_status,
    statsEnabled: current.stats_enabled, notePolicy: current.note_policy,
    calendarEnabled: current.calendar_enabled, calendarSchedule: current.calendar_schedule,
  };
  const parsedPatch = validate<Row>(habitPatchSchema, patch);
  const parsed = validate<Row>(habitInputSchema, { ...merged, ...parsedPatch });
  await requireOwnedRelation(client, "subjects", principal.ownerId, parsed.subjectId);
  await requireOwnedRelation(client, "personal_groups", principal.ownerId, parsed.personalGroupId);
  let query = ownerQuery(client, "habits", principal.ownerId).update(habitPayload(principal.ownerId, parsed)).eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const row = await queryOptional<Row>(query.select(HABIT_COLUMNS).maybeSingle(), "No se pudo actualizar el hábito.");
  if (!row) throw new DomainOperationError("conflict", "El hábito cambió antes de guardarse. Vuelve a leerlo.");
  return mapHabit(row);
}

export async function listHabitLogs(client: KarendaClient, principal: McpPrincipal, habitId: string, rangeInput: { startDate: string; endDate: string }): Promise<Row[]> {
  await getHabit(client, principal, habitId);
  const range = validate<{ startDate: string; endDate: string }>(habitRangeSchema, rangeInput);
  return await queryData<Row[]>(ownerQuery(client, "habit_logs", principal.ownerId).select(HABIT_LOG_COLUMNS)
    .eq("habit_id", habitId).gte("local_date", range.startDate).lte("local_date", range.endDate)
    .order("local_date", { ascending: true }).order("updated_at", { ascending: true }).limit(2000), "No se pudieron cargar los registros del hábito.");
}

async function loadHabitScheduleVersions(client: KarendaClient, principal: McpPrincipal, habitId: string): Promise<HabitScheduleVersion[]> {
  await getHabit(client, principal, habitId);
  const rows = await queryData<Row[]>(ownerQuery(client, "habit_schedule_versions", principal.ownerId)
    .select(HABIT_VERSION_COLUMNS)
    .eq("habit_id", habitId)
    .order("effective_from", { ascending: true })
    .limit(2000), "No se pudieron cargar las reglas del hábito.");
  return rows.map((row) => mapHabitScheduleVersion(row, principal.ownerId));
}

export async function listHabitScheduleVersions(client: KarendaClient, principal: McpPrincipal, habitId: string): Promise<Row[]> {
  const versions = await loadHabitScheduleVersions(client, principal, habitId);
  return versions.map(toPublicHabitScheduleVersion);
}

export function toPublicHabitScheduleVersion(version: HabitScheduleVersion): Row {
  return {
    id: version.id,
    habitId: version.habitId,
    schedule: version.schedule,
    evaluationMode: version.evaluationMode,
    goalValue: version.goalValue,
    quotaPeriod: version.quotaPeriod,
    missPolicy: version.missPolicy,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  };
}

function getLocalDate(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    throw new DomainOperationError("invalid_argument", "La zona horaria indicada no es válida.");
  }
}

export function validateHabitStatisticsRange(startDate: string, endDate: string): void {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 365 * 24 * 60 * 60 * 1000) {
    throw new DomainOperationError("invalid_argument", "El rango máximo para estadísticas es de 366 días.");
  }
}

export async function getHabitStatistics(
  client: KarendaClient,
  principal: McpPrincipal,
  habitId: string,
  rangeInput: { startDate: string; endDate: string; timeZone?: string },
): Promise<Record<string, unknown>> {
  const range = validate<{ startDate: string; endDate: string }>(habitRangeSchema, {
    startDate: rangeInput.startDate,
    endDate: rangeInput.endDate,
  });
  validateHabitStatisticsRange(range.startDate, range.endDate);
  const timeZone = rangeInput.timeZone ?? "America/Santiago";
  const today = getLocalDate(timeZone);
  const habit = { ...await getHabit(client, principal, habitId), ownerId: principal.ownerId } as unknown as Habit;
  if (!habit.statsEnabled) {
    throw new DomainOperationError("invalid_argument", "Las estadísticas de este hábito están desactivadas en Karenda.");
  }

  const [logRows, versions] = await Promise.all([
    listHabitLogs(client, principal, habitId, range),
    loadHabitScheduleVersions(client, principal, habitId),
  ]);
  const logs = logRows.map((row) => mapHabitLog(row, principal.ownerId));
  return calculateMcpHabitStatistics(habit, versions, logs, range.startDate, range.endDate, today, timeZone);
}

export function calculateMcpHabitStatistics(
  habit: Habit,
  versions: HabitScheduleVersion[],
  logs: HabitLog[],
  startDate: string,
  endDate: string,
  today: string,
  timeZone: string,
): Record<string, unknown> {
  const results = evaluateHabitRange(habit, versions, logs, startDate, endDate, today);
  return {
    ...calculateHabitStatistics(habit, results, logs, startDate, endDate, today),
    timeZone,
    today,
  };
}

export async function saveHabitLog(client: KarendaClient, principal: McpPrincipal, input: Record<string, unknown>): Promise<Row> {
  const parsed = validate<Row>(habitLogInputSchema, input);
  if (parsed.source !== "manual") throw new DomainOperationError("invalid_argument", "Solo se pueden crear registros manuales desde MCP.");
  const habit = await getHabit(client, principal, parsed.habitId);
  if (habit.trackingType === "boolean" && parsed.value !== 1) throw new DomainOperationError("invalid_argument", "Un hábito booleano usa valor 1 para completado.");
  const existing = await queryOptional<Row>(ownerQuery(client, "habit_logs", principal.ownerId).select(HABIT_LOG_COLUMNS)
    .eq("habit_id", parsed.habitId).eq("local_date", parsed.localDate).eq("source", "manual").maybeSingle(), "No se pudo revisar el registro existente.");
  const payload = {
    owner_id: principal.ownerId, habit_id: parsed.habitId, local_date: parsed.localDate,
    value: parsed.value, status: parsed.status, source: "manual", external_id: null,
  };
  if (existing) {
    return await queryData<Row>(ownerQuery(client, "habit_logs", principal.ownerId).update(payload).eq("id", existing.id).select(HABIT_LOG_COLUMNS).single(), "No se pudo actualizar el registro.");
  }
  return await queryData<Row>(database(client, "habit_logs").insert([payload]).select(HABIT_LOG_COLUMNS).single(), "No se pudo crear el registro.");
}

export async function clearHabitLog(client: KarendaClient, principal: McpPrincipal, id: string): Promise<void> {
  const row = await requireOwnedRow(client, "habit_logs", principal.ownerId, id, "id, source", "No se encontró el registro del hábito.");
  if (row.source !== "manual") throw new DomainOperationError("invalid_argument", "Los registros importados no se pueden borrar desde MCP.");
  const result = await queryOptional<Row>(ownerQuery(client, "habit_logs", principal.ownerId).delete().eq("id", id).select("id").maybeSingle(), "No se pudo borrar el registro.");
  if (!result) throw new DomainOperationError("not_found", "No se encontró el registro del hábito.");
}

function mapHabitNote(row: Row): Row {
  return { id: row.id, habitId: row.habit_id, entryDate: row.entry_date, title: row.title, contentMarkdown: row.content_markdown, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listHabitNotes(client: KarendaClient, principal: McpPrincipal, habitId?: string): Promise<Row[]> {
  let query = ownerQuery(client, "habit_notes", principal.ownerId).select(HABIT_NOTE_COLUMNS);
  if (habitId) {
    await getHabit(client, principal, habitId);
    query = query.eq("habit_id", habitId);
  }
  const rows = await queryData<Row[]>(query.order("updated_at", { ascending: false }).limit(500), "No se pudieron cargar las notas de hábitos.");
  return rows.map(mapHabitNote);
}

export async function createHabitNote(client: KarendaClient, principal: McpPrincipal, input: Record<string, unknown>): Promise<Row> {
  const parsed = validate<Row>(habitNoteInputSchema, input);
  await getHabit(client, principal, parsed.habitId);
  const row = await queryData<Row>(database(client, "habit_notes").insert([{
    owner_id: principal.ownerId, habit_id: parsed.habitId, entry_date: parsed.entryDate,
    title: parsed.title, content_markdown: parsed.contentMarkdown,
  }]).select(HABIT_NOTE_COLUMNS).single(), "No se pudo crear la nota del hábito.");
  return mapHabitNote(row);
}

export async function updateHabitNote(client: KarendaClient, principal: McpPrincipal, id: string, patch: Record<string, unknown>, expectedUpdatedAt?: string): Promise<Row> {
  const current = await requireOwnedRow(client, "habit_notes", principal.ownerId, id, HABIT_NOTE_COLUMNS, "No se encontró la nota del hábito.");
  ensureChangedVersion(current, expectedUpdatedAt);
  const parsed = validate<Row>(habitNotePatchSchema, patch);
  const merged = { habitId: current.habit_id, entryDate: current.entry_date, title: current.title, contentMarkdown: current.content_markdown, ...parsed };
  validate(habitNoteInputSchema, merged);
  await getHabit(client, principal, merged.habitId);
  let query = ownerQuery(client, "habit_notes", principal.ownerId).update({
    habit_id: parsed.habitId, entry_date: parsed.entryDate, title: parsed.title,
    content_markdown: parsed.contentMarkdown,
  }).eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const row = await queryOptional<Row>(query.select(HABIT_NOTE_COLUMNS).maybeSingle(), "No se pudo actualizar la nota.");
  if (!row) throw new DomainOperationError("conflict", "La nota del hábito cambió antes de guardarse.");
  return mapHabitNote(row);
}

export async function deleteHabitNote(client: KarendaClient, principal: McpPrincipal, id: string, expectedUpdatedAt?: string): Promise<void> {
  const current = await requireOwnedRow(client, "habit_notes", principal.ownerId, id, "id, updated_at", "No se encontró la nota del hábito.");
  ensureChangedVersion(current, expectedUpdatedAt);
  let query = ownerQuery(client, "habit_notes", principal.ownerId).delete().eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const row = await queryOptional<Row>(query.select("id").maybeSingle(), "No se pudo borrar la nota del hábito.");
  if (!row) throw new DomainOperationError("conflict", "La nota cambió antes de borrarse.");
}

const RECURRING_TASK_COLUMNS = "id, title, description, color, subject_id, personal_group_id, schedule, start_date, end_date, next_due_date, due_time, duration_minutes, status, calendar_enabled, created_at, updated_at";
const RECURRING_TASK_OCCURRENCE_COLUMNS = "id, recurring_task_id, due_date, status, completed_at, rescheduled_to, created_at";
const RECURRING_TASK_VERSION_COLUMNS = "id, recurring_task_id, schedule, effective_from, effective_to, created_at, updated_at";

function mapRecurringTask(row: Row): Row {
  return {
    id: row.id, title: row.title, description: row.description, color: row.color,
    subjectId: row.subject_id, personalGroupId: row.personal_group_id,
    schedule: row.schedule, startDate: row.start_date, endDate: row.end_date,
    nextDueDate: row.next_due_date, dueTime: row.due_time,
    durationMinutes: row.duration_minutes, status: row.status,
    calendarEnabled: row.calendar_enabled, createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recurringTaskPayload(ownerId: string, input: Row): Row {
  return {
    owner_id: ownerId, title: input.title, description: input.description,
    color: input.color, subject_id: input.subjectId,
    personal_group_id: input.personalGroupId, schedule: input.schedule,
    start_date: input.startDate, end_date: input.endDate,
    next_due_date: input.nextDueDate, due_time: input.dueTime,
    duration_minutes: input.durationMinutes, status: input.status,
    calendar_enabled: input.calendarEnabled,
  };
}

function mapRecurringTaskVersion(row: Row): Row {
  return {
    id: row.id, recurringTaskId: row.recurring_task_id, schedule: row.schedule,
    effectiveFrom: row.effective_from, effectiveTo: row.effective_to,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapRecurringTaskOccurrence(row: Row): Row {
  return {
    id: row.id, recurringTaskId: row.recurring_task_id, dueDate: row.due_date,
    status: row.status, completedAt: row.completed_at,
    rescheduledTo: row.rescheduled_to, createdAt: row.created_at,
  };
}

async function requireRecurringTask(client: KarendaClient, principal: McpPrincipal, id: string): Promise<Row> {
  return await requireOwnedRow(client, "recurring_tasks", principal.ownerId, id, RECURRING_TASK_COLUMNS, "No se encontró la tarea recurrente.");
}

export async function getRecurringTask(client: KarendaClient, principal: McpPrincipal, id: string): Promise<Row> {
  const row = await requireRecurringTask(client, principal, id);
  return mapRecurringTask(row);
}

export async function listRecurringTasks(client: KarendaClient, principal: McpPrincipal, includeArchived = false): Promise<Row[]> {
  let query = ownerQuery(client, "recurring_tasks", principal.ownerId).select(RECURRING_TASK_COLUMNS);
  if (!includeArchived) query = query.in("status", ["active", "paused"]);
  const rows = await queryData<Row[]>(query.order("next_due_date", { ascending: true }).limit(500), "No se pudieron cargar las tareas recurrentes.");
  return rows.map(mapRecurringTask);
}

export async function listRecurringTaskOccurrences(client: KarendaClient, principal: McpPrincipal, recurringTaskId?: string): Promise<Row[]> {
  if (recurringTaskId) await requireRecurringTask(client, principal, recurringTaskId);
  let query = ownerQuery(client, "recurring_task_occurrences", principal.ownerId).select(RECURRING_TASK_OCCURRENCE_COLUMNS);
  if (recurringTaskId) query = query.eq("recurring_task_id", recurringTaskId);
  const rows = await queryData<Row[]>(query.order("due_date", { ascending: false }).limit(1000), "No se pudo cargar el historial de tareas recurrentes.");
  return rows.map(mapRecurringTaskOccurrence);
}

export async function listRecurringTaskScheduleVersions(client: KarendaClient, principal: McpPrincipal, recurringTaskId: string): Promise<Row[]> {
  await requireRecurringTask(client, principal, recurringTaskId);
  const rows = await queryData<Row[]>(ownerQuery(client, "recurring_task_schedule_versions", principal.ownerId)
    .select(RECURRING_TASK_VERSION_COLUMNS).eq("recurring_task_id", recurringTaskId)
    .order("effective_from", { ascending: true }).limit(500), "No se pudieron cargar las reglas de la tarea recurrente.");
  return rows.map(mapRecurringTaskVersion);
}

async function writeInitialRecurringVersion(client: KarendaClient, principal: McpPrincipal, row: Row): Promise<void> {
  const result = await database(client, "recurring_task_schedule_versions").insert([{
    owner_id: principal.ownerId, recurring_task_id: row.id,
    schedule: row.schedule, effective_from: row.start_date,
  }]);
  if (result.error) {
    await ownerQuery(client, "recurring_tasks", principal.ownerId).delete().eq("id", row.id);
    raiseDatabaseError(result.error, "No se pudo guardar la regla inicial de la tarea recurrente.");
  }
}

export async function createRecurringTask(client: KarendaClient, principal: McpPrincipal, input: Record<string, unknown>): Promise<Row> {
  const parsed = validate<Row>(recurringTaskInputSchema, input);
  await requireOwnedRelation(client, "subjects", principal.ownerId, parsed.subjectId);
  await requireOwnedRelation(client, "personal_groups", principal.ownerId, parsed.personalGroupId);
  const row = await queryData<Row>(database(client, "recurring_tasks").insert([recurringTaskPayload(principal.ownerId, parsed)]).select(RECURRING_TASK_COLUMNS).single(), "No se pudo crear la tarea recurrente.");
  await writeInitialRecurringVersion(client, principal, row);
  return mapRecurringTask(row);
}

export async function updateRecurringTask(client: KarendaClient, principal: McpPrincipal, id: string, patch: Record<string, unknown>, expectedUpdatedAt?: string): Promise<Row> {
  const current = await requireRecurringTask(client, principal, id);
  ensureChangedVersion(current, expectedUpdatedAt);
  const merged = {
    title: current.title, description: current.description, color: current.color,
    subjectId: current.subject_id, personalGroupId: current.personal_group_id,
    schedule: current.schedule, startDate: current.start_date, endDate: current.end_date,
    nextDueDate: current.next_due_date, dueTime: current.due_time,
    durationMinutes: current.duration_minutes, status: current.status,
    calendarEnabled: current.calendar_enabled,
  };
  const parsedPatch = validate<Row>(recurringTaskPatchSchema, patch);
  const parsed = validate<Row>(recurringTaskInputSchema, { ...merged, ...parsedPatch });
  await requireOwnedRelation(client, "subjects", principal.ownerId, parsed.subjectId);
  await requireOwnedRelation(client, "personal_groups", principal.ownerId, parsed.personalGroupId);
  let query = ownerQuery(client, "recurring_tasks", principal.ownerId).update(recurringTaskPayload(principal.ownerId, parsed)).eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const row = await queryOptional<Row>(query.select(RECURRING_TASK_COLUMNS).maybeSingle(), "No se pudo actualizar la tarea recurrente.");
  if (!row) throw new DomainOperationError("conflict", "La tarea cambió antes de guardarse. Vuelve a leerla.");
  return mapRecurringTask(row);
}

export async function setRecurringTaskLifecycle(client: KarendaClient, principal: McpPrincipal, id: string, status: "active" | "paused" | "archived", expectedUpdatedAt?: string): Promise<Row> {
  return await updateRecurringTask(client, principal, id, { status }, expectedUpdatedAt);
}

export async function updateRecurringTaskScheduleVersion(client: KarendaClient, principal: McpPrincipal, input: Record<string, unknown>): Promise<Row> {
  const parsed = validate<Row>(recurringTaskScheduleVersionInputSchema, input);
  const task = await requireRecurringTask(client, principal, parsed.recurringTaskId);
  if (parsed.effectiveFrom < task.start_date) throw new DomainOperationError("invalid_argument", "La regla futura no puede comenzar antes de la tarea.");
  const today = new Date().toISOString().slice(0, 10);
  if (parsed.effectiveFrom <= today) throw new DomainOperationError("invalid_argument", "La regla futura debe comenzar después de hoy (UTC).");

  const versions = await listRecurringTaskScheduleVersions(client, principal, task.id);
  if (versions.some((version) => version.effectiveFrom === parsed.effectiveFrom)) {
    throw new DomainOperationError("conflict", "Ya existe una regla para esa fecha efectiva.");
  }
  const previous = [...versions].filter((version) => version.effectiveFrom < parsed.effectiveFrom)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0];
  const next = [...versions].filter((version) => version.effectiveFrom > parsed.effectiveFrom)
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))[0];
  if (previous) {
    const closed = await ownerQuery(client, "recurring_task_schedule_versions", principal.ownerId)
      .update({ effective_to: shiftDateKey(parsed.effectiveFrom, -1) }).eq("id", previous.id)
      .eq("effective_to", previous.effectiveTo).select("id").maybeSingle();
    if (closed.error || !closed.data) throw new DomainOperationError("conflict", "La regla anterior cambió. Vuelve a consultar el historial.");
  }
  const result = await queryOptional<Row>(database(client, "recurring_task_schedule_versions").insert([{
    owner_id: principal.ownerId,
    recurring_task_id: parsed.recurringTaskId,
    schedule: parsed.schedule,
    effective_from: parsed.effectiveFrom,
    effective_to: next ? shiftDateKey(next.effectiveFrom, -1) : null,
  }]).select(RECURRING_TASK_VERSION_COLUMNS).maybeSingle(), "No se pudo guardar la regla futura.");
  if (!result) {
    if (previous) await ownerQuery(client, "recurring_task_schedule_versions", principal.ownerId)
      .update({ effective_to: previous.effectiveTo }).eq("id", previous.id);
    throw new DomainOperationError("unavailable", "No se pudo guardar la regla futura.");
  }
  return mapRecurringTaskVersion(result);
}

export async function completeRecurringTask(client: KarendaClient, principal: McpPrincipal, id: string, dueDate: string): Promise<Row> {
  const task = await requireRecurringTask(client, principal, id);
  const parsedDueDate = validate<string>(habitLocalDateSchema, dueDate);
  const currentOccurrence = await queryOptional<Row>(ownerQuery(client, "recurring_task_occurrences", principal.ownerId)
    .select(RECURRING_TASK_OCCURRENCE_COLUMNS).eq("recurring_task_id", id).eq("due_date", parsedDueDate).maybeSingle(), "No se pudo revisar la ocurrencia de la tarea.");
  if (currentOccurrence?.status === "completed") return mapRecurringTask(task);

  const versions = await listRecurringTaskScheduleVersions(client, principal, id);
  const currentVersion = [...versions].filter((version) => version.effectiveFrom <= parsedDueDate && (!version.effectiveTo || version.effectiveTo >= parsedDueDate))
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0];
  const nextVersion = [...versions].filter((version) => version.effectiveFrom > parsedDueDate)
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))[0];
  let nextDueDate = getNextScheduledDate(currentVersion?.schedule ?? task.schedule, currentVersion?.effectiveFrom ?? task.start_date, parsedDueDate, task.end_date);
  if (nextVersion && (!nextDueDate || nextDueDate >= nextVersion.effectiveFrom)) {
    nextDueDate = getNextScheduledDate(nextVersion.schedule, nextVersion.effectiveFrom, shiftDateKey(nextVersion.effectiveFrom, -1), task.end_date);
  }
  const occurrencePayload = {
    completed_at: new Date().toISOString(), due_date: parsedDueDate, owner_id: principal.ownerId,
    recurring_task_id: id, rescheduled_to: null, status: "completed",
  };
  const occurrenceResult = currentOccurrence
    ? await ownerQuery(client, "recurring_task_occurrences", principal.ownerId).update(occurrencePayload).eq("id", currentOccurrence.id).select("id").maybeSingle()
    : await database(client, "recurring_task_occurrences").insert([occurrencePayload]).select("id").maybeSingle();
  if (occurrenceResult.error || !occurrenceResult.data) raiseDatabaseError(occurrenceResult.error, "No se pudo registrar la tarea completada.");

  const update = await queryOptional<Row>(ownerQuery(client, "recurring_tasks", principal.ownerId)
    .update({ next_due_date: nextDueDate ?? parsedDueDate, status: nextDueDate ? task.status : "archived" })
    .eq("id", id).select(RECURRING_TASK_COLUMNS).maybeSingle(), "No se pudo calcular la próxima fecha de la tarea.");
  if (!update) throw new DomainOperationError("unavailable", "Se guardó la ocurrencia pero no se pudo actualizar la próxima fecha. Revisa la tarea antes de reintentar.");
  return mapRecurringTask(update);
}

export async function rescheduleRecurringTask(client: KarendaClient, principal: McpPrincipal, id: string, dueDate: string, rescheduledTo: string): Promise<Row> {
  await requireRecurringTask(client, principal, id);
  const parsedDueDate = validate<string>(habitLocalDateSchema, dueDate);
  const parsedRescheduledTo = validate<string>(habitLocalDateSchema, rescheduledTo);
  if (parsedRescheduledTo === parsedDueDate) throw new DomainOperationError("invalid_argument", "La nueva fecha debe ser distinta de la fecha original.");
  const occurrencePayload = {
    completed_at: null, due_date: parsedDueDate, owner_id: principal.ownerId,
    recurring_task_id: id, rescheduled_to: parsedRescheduledTo, status: "rescheduled",
  };
  const currentOccurrence = await queryOptional<Row>(ownerQuery(client, "recurring_task_occurrences", principal.ownerId)
    .select("id").eq("recurring_task_id", id).eq("due_date", parsedDueDate).maybeSingle(), "No se pudo revisar la ocurrencia de la tarea.");
  const occurrence = currentOccurrence
    ? await ownerQuery(client, "recurring_task_occurrences", principal.ownerId).update(occurrencePayload).eq("id", currentOccurrence.id).select("id").maybeSingle()
    : await database(client, "recurring_task_occurrences").insert([occurrencePayload]).select("id").maybeSingle();
  if (occurrence.error || !occurrence.data) raiseDatabaseError(occurrence.error, "No se pudo registrar la reprogramación.");
  const row = await queryOptional<Row>(ownerQuery(client, "recurring_tasks", principal.ownerId)
    .update({ next_due_date: parsedRescheduledTo }).eq("id", id).select(RECURRING_TASK_COLUMNS).maybeSingle(), "No se pudo reprogramar la tarea recurrente.");
  if (!row) throw new DomainOperationError("unavailable", "Se guardó la reprogramación pero no se actualizó la próxima fecha. Revisa la tarea antes de reintentar.");
  return mapRecurringTask(row);
}

export { eventStatusSchema, noteInputSchema, notePatchSchema, personalGroupInputSchema, personalGroupPatchSchema, subjectInputSchema, subjectPatchSchema, habitInputSchema, habitPatchSchema, habitNoteInputSchema, habitNotePatchSchema, habitLogInputSchema, recurringTaskInputSchema, recurringTaskPatchSchema, recurringTaskScheduleVersionInputSchema };
