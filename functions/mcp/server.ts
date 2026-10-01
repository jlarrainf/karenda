/* eslint-disable @typescript-eslint/no-explicit-any -- MCP tool schemas are runtime-defined and their validated input types vary by registered tool. */
import { McpServer } from "npm:@modelcontextprotocol/server@2.0.0";
import * as z from "npm:zod@4.5.4";
import {
  createEvent,
  createHabit,
  createHabitNote,
  createNote,
  createPersonalGroup,
  createSubject,
  deleteCatalog,
  deleteEvent,
  clearHabitLog,
  deleteHabitNote,
  deleteNote,
  DomainOperationError,
  getEvent,
  getCatalog,
  getHabit,
  getNote,
  getRecurringTask,
  KarendaClient,
  listEvents,
  listHabitLogs,
  listHabitNotes,
  listHabits,
  listNotes,
  listPersonalGroups,
  listSubjects,
  listRecurringTaskOccurrences,
  listRecurringTaskScheduleVersions,
  listRecurringTasks,
  saveHabitLog,
  setEventStatus,
  updateEvent,
  updateHabit,
  updateHabitNote,
  updateNote,
  updatePersonalGroup,
  updateSubject,
  createRecurringTask,
  updateRecurringTask,
  setRecurringTaskLifecycle,
  updateRecurringTaskScheduleVersion,
  completeRecurringTask,
  rescheduleRecurringTask,
  eventStatusSchema,
  habitInputSchema,
  habitLogInputSchema,
  habitNoteInputSchema,
  habitNotePatchSchema,
  habitPatchSchema,
  noteInputSchema,
  notePatchSchema,
  personalGroupInputSchema,
  personalGroupPatchSchema,
  subjectInputSchema,
  subjectPatchSchema,
  recurringTaskInputSchema,
  recurringTaskPatchSchema,
  recurringTaskScheduleVersionInputSchema,
} from "./domain.ts";
import type { McpPrincipal } from "./oauth.ts";
import {
  applyCanvasReview,
  getCanvasConnection,
  listCanvasCourseLinks,
  listCanvasReviews,
  listCanvasSyncRuns,
  prepareAiEventDraft,
  prepareAiHabitDraft,
  saveAiEventDraft,
  saveAiHabitDraft,
  synchronizeCanvas,
  unlinkCanvasCourse,
} from "./integrations.ts";

type ToolOperation = (input: any) => Promise<unknown> | unknown;

function success(value: unknown, message: string) {
  return {
    content: [{ type: "text" as const, text: `${message}\n${JSON.stringify(value, null, 2)}` }],
    structuredContent: { result: value as Record<string, unknown> },
  };
}

function failure(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

function safeError(error: unknown): string {
  if (error instanceof DomainOperationError) return error.message;
  return "No se pudo completar la operación en Karenda. Vuelve a consultar y reintenta.";
}

function registerTool(
  server: McpServer,
  principal: McpPrincipal,
  name: string,
  scope: string,
  description: string,
  inputSchema: z.ZodType,
  operation: ToolOperation,
  options: { destructive?: boolean; readOnly?: boolean; successMessage?: string } = {},
): void {
  server.registerTool(
    name,
    {
      description,
      inputSchema,
      annotations: {
        title: name,
        readOnlyHint: options.readOnly ?? false,
        destructiveHint: options.destructive ?? false,
        idempotentHint: options.readOnly ?? false,
        openWorldHint: false,
      },
    },
    async (input) => {
      if (!principal.scopes.includes(scope)) {
        return failure(`Esta conexión no tiene el permiso «${scope}». Reautoriza Karenda y concede ese permiso.`);
      }
      try {
        const result = await operation(input);
        return success(result, options.successMessage ?? "Operación completada en Karenda.");
      } catch (error) {
        return failure(safeError(error));
      }
    },
  );
}

const eventInput = z.object({
  kind: z.enum(["academic", "personal"]),
  title: z.string().min(1).max(240),
  subjectId: z.string().uuid().nullable().optional(),
  personalGroupId: z.string().uuid().nullable().optional(),
  startAt: z.string().min(1).max(80),
  endAt: z.string().max(80).nullable().optional(),
  isAllDay: z.boolean().default(false),
  status: z.enum(["pending", "completed"]).default("pending"),
  location: z.string().max(240).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
}).strict();

const eventPatch = z.object({
  kind: z.enum(["academic", "personal"]).optional(),
  title: z.string().min(1).max(240).optional(),
  subjectId: z.string().uuid().nullable().optional(),
  personalGroupId: z.string().uuid().nullable().optional(),
  startAt: z.string().min(1).max(80).optional(),
  endAt: z.string().max(80).nullable().optional(),
  isAllDay: z.boolean().optional(),
  status: z.enum(["pending", "completed"]).optional(),
  location: z.string().max(240).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
}).strict();

const idSchema = z.string().uuid();
const versionSchema = z.string().datetime({ offset: true }).optional();
const confirmedDeleteSchema = z.object({
  id: idSchema,
  confirm: z.literal(true).describe("Confirma que Karenda debe eliminar exactamente el registro indicado."),
  expectedUpdatedAt: versionSchema,
}).strict();

function registerCatalogTools(server: McpServer, principal: McpPrincipal, client: KarendaClient): void {
  const catalogDefinitions = [
    {
      entity: "subjects",
      label: "asignatura",
      list: () => listSubjects(client, principal),
      create: (input: Record<string, unknown>) => createSubject(client, principal, input),
      update: (id: string, patch: Record<string, unknown>, version?: string) => updateSubject(client, principal, id, patch, version),
      remove: (id: string, version?: string) => deleteCatalog(client, principal, "subjects", id, version),
      input: subjectInputSchema,
      patch: subjectPatchSchema,
    },
    {
      entity: "personal_groups",
      label: "grupo personal",
      list: () => listPersonalGroups(client, principal),
      create: (input: Record<string, unknown>) => createPersonalGroup(client, principal, input),
      update: (id: string, patch: Record<string, unknown>, version?: string) => updatePersonalGroup(client, principal, id, patch, version),
      remove: (id: string, version?: string) => deleteCatalog(client, principal, "personal_groups", id, version),
      input: personalGroupInputSchema,
      patch: personalGroupPatchSchema,
    },
  ] as const;

  for (const definition of catalogDefinitions) {
    registerTool(server, principal, `${definition.entity}.list`, "catalogs:read", `Lista las ${definition.label === "asignatura" ? "asignaturas" : "grupos personales"} de la cuenta autenticada.`, z.object({}).strict(), () => definition.list(), { readOnly: true, successMessage: "Resultados de Karenda:" });
    const table = definition.entity === "subjects" ? "subjects" as const : "personal_groups" as const;
    registerTool(server, principal, `${definition.entity}.get`, "catalogs:read", `Lee una ${definition.label} por ID, solo si pertenece a la cuenta autenticada.`, z.object({ id: idSchema }).strict(), (input) => getCatalog(client, principal, table, input.id), { readOnly: true, successMessage: `${definition.label}:` });
    registerTool(server, principal, `${definition.entity}.create`, "catalogs:write", `Crea una ${definition.label} con los campos permitidos por Karenda.`, definition.input as z.ZodType, (input) => definition.create(input), { successMessage: `${definition.label} creada:` });
    registerTool(server, principal, `${definition.entity}.update`, "catalogs:write", `Edita una ${definition.label}; usa expectedUpdatedAt para evitar sobrescribir cambios recientes.`, z.object({ id: idSchema, patch: definition.patch, expectedUpdatedAt: versionSchema }).strict(), (input) => definition.update(input.id, input.patch, input.expectedUpdatedAt), { successMessage: `${definition.label} actualizada:` });
    registerTool(server, principal, `${definition.entity}.delete`, "catalogs:delete", `Elimina la ${definition.label} indicada. Requiere confirm=true y puede estar bloqueado si existen eventos o notas relacionados.`, confirmedDeleteSchema, (input) => definition.remove(input.id, input.expectedUpdatedAt).then(() => ({ id: input.id, deleted: true })), { destructive: true, successMessage: `${definition.label} eliminada:` });
  }
}

function registerEventTools(server: McpServer, principal: McpPrincipal, client: KarendaClient): void {
  registerTool(server, principal, "events.list", "events:read", "Lista los eventos del calendario que se superponen con un intervalo ISO-8601. El intervalo máximo es 366 días. Usa nextOffset para continuar.", z.object({ startAt: z.string().min(1).max(80), endAt: z.string().min(1).max(80), limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).max(10000).default(0) }).strict(), (input) => listEvents(client, principal, input), { readOnly: true, successMessage: "Eventos encontrados:" });
  registerTool(server, principal, "events.get", "events:read", "Lee un evento por su ID, solo si pertenece a la cuenta autenticada.", z.object({ id: idSchema }).strict(), (input) => getEvent(client, principal, input.id), { readOnly: true, successMessage: "Evento:" });
  registerTool(server, principal, "events.create", "events:write", "Crea un evento validando tipo, fechas y relaciones con una asignatura o grupo personal de la misma cuenta.", eventInput, (input) => createEvent(client, principal, input), { successMessage: "Evento creado:" });
  registerTool(server, principal, "events.update", "events:write", "Edita campos de un evento. Proporciona updatedAt leído recientemente para evitar sobrescribir cambios concurrentes.", z.object({ id: idSchema, patch: eventPatch, expectedUpdatedAt: versionSchema }).strict(), (input) => updateEvent(client, principal, input.id, input.patch, input.expectedUpdatedAt), { successMessage: "Evento actualizado:" });
  registerTool(server, principal, "events.set_status", "events:write", "Marca un evento como completado o pendiente.", z.object({ id: idSchema, status: eventStatusSchema, expectedUpdatedAt: versionSchema }).strict(), (input) => setEventStatus(client, principal, input.id, input.status, input.expectedUpdatedAt), { successMessage: "Estado del evento actualizado:" });
  registerTool(server, principal, "events.delete", "events:delete", "Elimina permanentemente el evento indicado. Requiere confirm=true y puede comparar updatedAt para evitar borrar una versión distinta.", confirmedDeleteSchema, (input) => deleteEvent(client, principal, input.id, input.expectedUpdatedAt).then(() => ({ id: input.id, deleted: true })), { destructive: true, successMessage: "Evento eliminado:" });
}

function registerNoteTools(server: McpServer, principal: McpPrincipal, client: KarendaClient): void {
  registerTool(server, principal, "notes.list", "notes:read", "Lista las notas de una asignatura o grupo personal propio.", z.object({ targetType: z.enum(["subject", "personal_group"]), targetId: idSchema }).strict(), (input) => listNotes(client, principal, input.targetType, input.targetId), { readOnly: true, successMessage: "Notas encontradas:" });
  registerTool(server, principal, "notes.get", "notes:read", "Lee una nota por ID, solo si pertenece a la cuenta autenticada.", z.object({ id: idSchema }).strict(), (input) => getNote(client, principal, input.id), { readOnly: true, successMessage: "Nota:" });
  registerTool(server, principal, "notes.create", "notes:write", "Crea una nota Markdown vinculada a una asignatura o grupo personal propio.", noteInputSchema, (input) => createNote(client, principal, input), { successMessage: "Nota creada:" });
  registerTool(server, principal, "notes.update", "notes:write", "Edita una nota y sus relaciones dentro de la cuenta. Usa expectedUpdatedAt para proteger cambios recientes.", z.object({ id: idSchema, patch: notePatchSchema, expectedUpdatedAt: versionSchema }).strict(), (input) => updateNote(client, principal, input.id, input.patch, input.expectedUpdatedAt), { successMessage: "Nota actualizada:" });
  registerTool(server, principal, "notes.delete", "notes:delete", "Elimina permanentemente la nota indicada. Requiere confirm=true.", confirmedDeleteSchema, (input) => deleteNote(client, principal, input.id, input.expectedUpdatedAt).then(() => ({ id: input.id, deleted: true })), { destructive: true, successMessage: "Nota eliminada:" });
}

function registerRecurringTaskTools(server: McpServer, principal: McpPrincipal, client: KarendaClient): void {
  registerTool(server, principal, "recurring.list", "recurring:read", "Lista tareas recurrentes activas y pausadas; opcionalmente incluye las archivadas.", z.object({ includeArchived: z.boolean().default(false) }).strict(), (input) => listRecurringTasks(client, principal, input.includeArchived), { readOnly: true, successMessage: "Tareas recurrentes:" });
  registerTool(server, principal, "recurring.get", "recurring:read", "Lee una tarea recurrente propia por ID.", z.object({ id: idSchema }).strict(), (input) => getRecurringTask(client, principal, input.id), { readOnly: true, successMessage: "Tarea recurrente:" });
  registerTool(server, principal, "recurring.list_occurrences", "recurring:read", "Lee el historial de ocurrencias; se puede limitar a una tarea.", z.object({ recurringTaskId: idSchema.optional() }).strict(), (input) => listRecurringTaskOccurrences(client, principal, input.recurringTaskId), { readOnly: true, successMessage: "Historial de tareas recurrentes:" });
  registerTool(server, principal, "recurring.list_schedule_versions", "recurring:read", "Lee el historial de reglas de frecuencia de una tarea.", z.object({ recurringTaskId: idSchema }).strict(), (input) => listRecurringTaskScheduleVersions(client, principal, input.recurringTaskId), { readOnly: true, successMessage: "Reglas de frecuencia:" });
  registerTool(server, principal, "recurring.create", "recurring:write", "Crea una tarea recurrente con calendario, frecuencia, fechas, hora y relaciones permitidas por Karenda.", recurringTaskInputSchema, (input) => createRecurringTask(client, principal, input), { successMessage: "Tarea recurrente creada:" });
  registerTool(server, principal, "recurring.update", "recurring:write", "Edita una tarea recurrente sin borrar su historial. Usa expectedUpdatedAt para evitar sobrescribir cambios recientes.", z.object({ id: idSchema, patch: recurringTaskPatchSchema, expectedUpdatedAt: versionSchema }).strict(), (input) => updateRecurringTask(client, principal, input.id, input.patch, input.expectedUpdatedAt), { successMessage: "Tarea recurrente actualizada:" });
  registerTool(server, principal, "recurring.set_lifecycle", "recurring:write", "Activa, pausa o archiva una tarea recurrente. Karenda conserva su historial.", z.object({ id: idSchema, status: z.enum(["active", "paused", "archived"]), expectedUpdatedAt: versionSchema }).strict(), (input) => setRecurringTaskLifecycle(client, principal, input.id, input.status, input.expectedUpdatedAt), { successMessage: "Estado de la tarea actualizado:" });
  registerTool(server, principal, "recurring.update_schedule", "recurring:write", "Programa una nueva regla de frecuencia con fecha efectiva futura, manteniendo el historial previo.", recurringTaskScheduleVersionInputSchema, (input) => updateRecurringTaskScheduleVersion(client, principal, input), { successMessage: "Nueva regla de frecuencia guardada:" });
  registerTool(server, principal, "recurring.complete_occurrence", "recurring:write", "Marca una ocurrencia como completada y calcula la siguiente fecha según sus reglas.", z.object({ id: idSchema, dueDate: z.string() }).strict(), (input) => completeRecurringTask(client, principal, input.id, input.dueDate), { successMessage: "Ocurrencia completada:" });
  registerTool(server, principal, "recurring.reschedule_occurrence", "recurring:write", "Reprograma una ocurrencia y actualiza la próxima fecha de la tarea.", z.object({ id: idSchema, dueDate: z.string(), rescheduledTo: z.string() }).strict(), (input) => rescheduleRecurringTask(client, principal, input.id, input.dueDate, input.rescheduledTo), { successMessage: "Ocurrencia reprogramada:" });
}

const aiAnswerSchema = z.object({
  questionId: z.string().min(1).max(80),
  optionId: z.string().max(80).optional(),
  otherText: z.string().max(500).optional(),
  noPreference: z.boolean().optional(),
}).strict();

const aiDraftSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  mode: z.enum(["quick", "guided"]).default("quick"),
  timeZone: z.string().max(64).optional(),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  answers: z.array(aiAnswerSchema).max(5).optional(),
}).strict();

function registerAiTools(server: McpServer, principal: McpPrincipal, client: KarendaClient): void {
  registerTool(server, principal, "events.prepare_ai_draft", "ai:draft", "Prepara propuestas de eventos a partir de una descripción. Puede hacer preguntas aclaratorias. No guarda ningún evento; confirma y usa events.save_ai_draft para persistir uno.", aiDraftSchema, (input) => prepareAiEventDraft(client, input), { readOnly: true, successMessage: "Borrador de eventos preparado; aún no se guardó:" });
  registerTool(server, principal, "events.save_ai_draft", "events:write", "Guarda un borrador de evento después de que la persona haya revisado y confirmado todos sus campos.", z.object({ event: eventInput, confirm: z.literal(true) }).strict(), (input) => saveAiEventDraft(client, principal, input), { successMessage: "Borrador guardado como evento:" });
  registerTool(server, principal, "habits.prepare_ai_draft", "ai:draft", "Prepara propuestas de hábitos a partir de una descripción y puede hacer preguntas aclaratorias. No guarda ningún hábito; usa habits.save_ai_draft después de confirmar los campos.", aiDraftSchema, (input) => prepareAiHabitDraft(client, input), { readOnly: true, successMessage: "Borrador de hábitos preparado; aún no se guardó:" });
  registerTool(server, principal, "habits.save_ai_draft", "habits:write", "Guarda un borrador de hábito después de que la persona revise y confirme su frecuencia, medición, meta y relaciones.", z.object({ habit: habitInputSchema, confirm: z.literal(true) }).strict(), (input) => saveAiHabitDraft(client, principal, input), { successMessage: "Borrador guardado como hábito:" });
}

function registerCanvasTools(server: McpServer, principal: McpPrincipal, client: KarendaClient): void {
  registerTool(server, principal, "canvas.get_status", "canvas:read", "Lee el estado de conexión y los últimos resultados de Canvas. Nunca devuelve la credencial.", z.object({}).strict(), () => getCanvasConnection(client), { readOnly: true, successMessage: "Estado de Canvas:" });
  registerTool(server, principal, "canvas.list_course_links", "canvas:read", "Lista los cursos de Canvas vinculados a asignaturas propias.", z.object({}).strict(), () => listCanvasCourseLinks(client, principal), { readOnly: true, successMessage: "Cursos vinculados:" });
  registerTool(server, principal, "canvas.list_sync_runs", "canvas:read", "Lista las diez sincronizaciones más recientes con conteos y errores sanitizados.", z.object({}).strict(), () => listCanvasSyncRuns(client, principal), { readOnly: true, successMessage: "Historial de sincronización:" });
  registerTool(server, principal, "canvas.list_reviews", "canvas:read", "Lista propuestas pendientes de Canvas. Revisar una propuesta no escribe en Canvas.", z.object({}).strict(), () => listCanvasReviews(client, principal), { readOnly: true, successMessage: "Propuestas pendientes:" });
  registerTool(server, principal, "canvas.sync", "canvas:sync", "Solicita una sincronización manual de solo lectura desde Canvas hacia Karenda. Confirma antes de iniciarla; el resultado puede actualizar campos sin cambios locales y crear propuestas para revisión.", z.object({ confirm: z.literal(true) }).strict(), () => synchronizeCanvas(client), { destructive: true, successMessage: "Sincronización iniciada o completada:" });
  registerTool(server, principal, "canvas.unlink_course", "canvas:review", "Desvincula un curso de una asignatura sin borrar eventos ni el historial de Canvas. Requiere confirmación.", z.object({ courseLinkId: idSchema, confirm: z.literal(true) }).strict(), (input) => unlinkCanvasCourse(client, input.courseLinkId).then(() => ({ courseLinkId: input.courseLinkId, unlinked: true })), { destructive: true, successMessage: "Curso desvinculado:" });
  registerTool(server, principal, "canvas.apply_review", "canvas:review", "Aplica, vincula o ignora una propuesta pendiente dentro de Karenda. No realiza escrituras en Canvas. Revisa primero la propuesta y los campos propuestos.", z.object({ reviewItemId: idSchema, decision: z.enum(["link_existing", "create_subject", "create_event", "apply_update", "ignore"]), eventId: idSchema.optional(), overrides: z.record(z.string(), z.unknown()).optional(), confirm: z.literal(true) }).strict(), (input) => applyCanvasReview(client, input), { destructive: true, successMessage: "Decisión de revisión aplicada:" });
}

function registerHabitTools(server: McpServer, principal: McpPrincipal, client: KarendaClient): void {
  registerTool(server, principal, "habits.list", "habits:read", "Lista hábitos activos y pausados; opcionalmente incluye los archivados.", z.object({ includeArchived: z.boolean().default(false) }).strict(), (input) => listHabits(client, principal, input.includeArchived), { readOnly: true, successMessage: "Hábitos encontrados:" });
  registerTool(server, principal, "habits.get", "habits:read", "Lee un hábito propio por ID.", z.object({ id: idSchema }).strict(), (input) => getHabit(client, principal, input.id), { readOnly: true, successMessage: "Hábito:" });
  registerTool(server, principal, "habits.create", "habits:write", "Crea un hábito respetando seguimiento, meta, frecuencia, relaciones y proyección al calendario de Karenda.", habitInputSchema, (input) => createHabit(client, principal, input), { successMessage: "Hábito creado:" });
  registerTool(server, principal, "habits.update", "habits:write", "Edita un hábito con las mismas validaciones que Karenda.", z.object({ id: idSchema, patch: habitPatchSchema, expectedUpdatedAt: versionSchema }).strict(), (input) => updateHabit(client, principal, input.id, input.patch, input.expectedUpdatedAt), { successMessage: "Hábito actualizado:" });
  registerTool(server, principal, "habits.set_lifecycle", "habits:write", "Activa, pausa o archiva un hábito sin borrar su historial.", z.object({ id: idSchema, lifecycleStatus: z.enum(["active", "paused", "archived"]), expectedUpdatedAt: versionSchema }).strict(), (input) => updateHabit(client, principal, input.id, { lifecycleStatus: input.lifecycleStatus }, input.expectedUpdatedAt), { successMessage: "Estado del hábito actualizado:" });
  registerTool(server, principal, "habits.list_logs", "habits:read", "Lista registros de un hábito propio en un rango de fechas locales.", z.object({ habitId: idSchema, startDate: z.string(), endDate: z.string() }).strict(), (input) => listHabitLogs(client, principal, input.habitId, { startDate: input.startDate, endDate: input.endDate }), { readOnly: true, successMessage: "Registros encontrados:" });
  registerTool(server, principal, "habits.mark_log", "habits:write", "Registra o corrige el progreso manual de un hábito en una fecha local. Los registros importados desde KOReader no se pueden suplantar.", habitLogInputSchema, (input) => saveHabitLog(client, principal, input), { successMessage: "Progreso guardado:" });
  registerTool(server, principal, "habits.clear_log", "habits:delete", "Quita un registro manual del hábito. Requiere confirm=true; los registros importados no se pueden borrar desde MCP.", z.object({ id: idSchema, confirm: z.literal(true) }).strict(), (input) => clearHabitLog(client, principal, input.id).then(() => ({ id: input.id, deleted: true })), { destructive: true, successMessage: "Registro eliminado:" });
  registerTool(server, principal, "habits.list_notes", "habits:read", "Lista notas de hábitos, opcionalmente limitadas a un hábito.", z.object({ habitId: idSchema.optional() }).strict(), (input) => listHabitNotes(client, principal, input.habitId), { readOnly: true, successMessage: "Notas de hábitos encontradas:" });
  registerTool(server, principal, "habits.create_note", "habits:write", "Crea una nota general o diaria para un hábito propio.", habitNoteInputSchema, (input) => createHabitNote(client, principal, input), { successMessage: "Nota de hábito creada:" });
  registerTool(server, principal, "habits.update_note", "habits:write", "Edita una nota de hábito.", z.object({ id: idSchema, patch: habitNotePatchSchema, expectedUpdatedAt: versionSchema }).strict(), (input) => updateHabitNote(client, principal, input.id, input.patch, input.expectedUpdatedAt), { successMessage: "Nota de hábito actualizada:" });
  registerTool(server, principal, "habits.delete_note", "habits:delete", "Elimina una nota de hábito. Requiere confirm=true.", confirmedDeleteSchema, (input) => deleteHabitNote(client, principal, input.id, input.expectedUpdatedAt).then(() => ({ id: input.id, deleted: true })), { destructive: true, successMessage: "Nota de hábito eliminada:" });
}

export function createKarendaMcpServer(client: KarendaClient, principal: McpPrincipal): McpServer {
  const server = new McpServer({ name: "karenda", version: "0.1.0" });

  registerTool(server, principal, "profile.get_context", "profile:read", "Obtiene idioma, zona horaria y fecha/hora actual. Si el harness conoce tu zona, indícala como timeZone; el valor inicial es America/Santiago. No revela correo ni identificadores de cuenta.", z.object({ timeZone: z.string().trim().min(1).max(64).optional() }).strict(), (input) => {
    const timeZone = input.timeZone || "America/Santiago";
    const now = new Date();
    let localDate: string;
    try {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      localDate = `${values.year}-${values.month}-${values.day}`;
    } catch {
      throw new DomainOperationError("invalid_argument", "La zona horaria indicada no es válida.");
    }
    return { language: "es", timeZone, localDate, currentTime: now.toISOString() };
  }, { readOnly: true, successMessage: "Contexto de Karenda:" });
  registerEventTools(server, principal, client);
  registerCatalogTools(server, principal, client);
  registerNoteTools(server, principal, client);
  registerHabitTools(server, principal, client);
  registerRecurringTaskTools(server, principal, client);
  registerAiTools(server, principal, client);
  registerCanvasTools(server, principal, client);
  return server;
}
