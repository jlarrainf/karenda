import { insforge } from '../lib/insforge/client.ts'
import type { Database } from '../lib/insforge/database.types.ts'
import type { Note } from '../types/domain.ts'
import { requireCurrentUserId } from './authService.ts'
import {
  AppError,
  runInsForge,
  runInsForgeAction,
  runInsForgeOptional,
} from './errors.ts'
import {
  entityIdSchema,
  noteInputSchema,
  notePatchSchema,
  noteTargetTypeSchema,
  parseInput,
  type NoteInput,
  type NotePatch,
} from './validation.ts'

type NoteRow = Database['public']['Tables']['notes']['Row']
type NoteTargetType = NoteRow['target_type']

const NOTE_COLUMNS =
  'id, owner_id, target_type, target_id, title, content_markdown, created_at, updated_at'
const MAX_NOTES = 500

function mapNote(row: NoteRow): Note {
  return {
    id: row.id,
    ownerId: row.owner_id,
    targetType: row.target_type,
    targetId: row.target_id,
    title: row.title,
    contentMarkdown: row.content_markdown,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listNotes(
  targetType: NoteTargetType,
  targetId: string,
): Promise<Note[]> {
  const ownerId = await requireCurrentUserId()
  const parsedTargetType = parseInput(noteTargetTypeSchema, targetType)
  const parsedTargetId = parseInput(entityIdSchema, targetId)
  const data = await runInsForge<NoteRow[]>(
    () =>
      insforge.database
        .from('notes')
        .select(NOTE_COLUMNS)
        .eq('owner_id', ownerId)
        .eq('target_type', parsedTargetType)
        .eq('target_id', parsedTargetId)
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(MAX_NOTES),
    'No se pudieron cargar las notas.',
  )

  return data.map(mapNote)
}

export async function listAllSubjectNotes(): Promise<Note[]> {
  const ownerId = await requireCurrentUserId()
  const data = await runInsForge<NoteRow[]>(
    () =>
      insforge.database
        .from('notes')
        .select(NOTE_COLUMNS)
        .eq('owner_id', ownerId)
        .eq('target_type', 'subject')
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(MAX_NOTES),
    'No se pudieron cargar las notas.',
  )

  return data.map(mapNote)
}

export async function getNote(id: string): Promise<Note | null> {
  const ownerId = await requireCurrentUserId()
  const parsedId = parseInput(entityIdSchema, id)
  const data = await runInsForgeOptional<NoteRow>(
    () =>
      insforge.database
        .from('notes')
        .select(NOTE_COLUMNS)
        .eq('id', parsedId)
        .eq('owner_id', ownerId)
        .maybeSingle(),
    'No se pudo cargar la nota.',
  )

  return data ? mapNote(data) : null
}

export async function createNote(input: NoteInput): Promise<Note> {
  const ownerId = await requireCurrentUserId()
  const parsed = parseInput(noteInputSchema, input)
  const data = await runInsForge<NoteRow>(
    () =>
      insforge.database
        .from('notes')
        .insert([
          {
            owner_id: ownerId,
            target_type: parsed.targetType,
            target_id: parsed.targetId,
            title: parsed.title,
            content_markdown: parsed.contentMarkdown,
          },
        ])
        .select(NOTE_COLUMNS)
        .single(),
    'No se pudo crear la nota.',
  )

  return mapNote(data)
}

export async function updateNote(id: string, input: NotePatch): Promise<Note> {
  const ownerId = await requireCurrentUserId()
  const parsedId = parseInput(entityIdSchema, id)
  const parsed = parseInput(notePatchSchema, input)
  const data = await runInsForge<NoteRow>(
    () =>
      insforge.database
        .from('notes')
        .update({
          ...(parsed.targetType !== undefined
            ? { target_type: parsed.targetType }
            : {}),
          ...(parsed.targetId !== undefined ? { target_id: parsed.targetId } : {}),
          ...(parsed.title !== undefined ? { title: parsed.title } : {}),
          ...(parsed.contentMarkdown !== undefined
            ? { content_markdown: parsed.contentMarkdown }
            : {}),
        })
        .eq('id', parsedId)
        .eq('owner_id', ownerId)
        .select(NOTE_COLUMNS)
        .single(),
    'No se pudo actualizar la nota.',
  )

  return mapNote(data)
}

export async function deleteNote(id: string): Promise<void> {
  const ownerId = await requireCurrentUserId()
  const parsedId = parseInput(entityIdSchema, id)
  const note = await getNote(parsedId)

  if (!note) {
    throw new AppError('not_found', 'No se encontró la nota.')
  }

  await runInsForgeAction(
    () =>
      insforge.database
        .from('notes')
        .delete()
        .eq('id', parsedId)
        .eq('owner_id', ownerId),
    'No se pudo eliminar la nota.',
  )
}

export const noteService = {
  list: listNotes,
  listAllSubjects: listAllSubjectNotes,
  getById: getNote,
  create: createNote,
  update: updateNote,
  remove: deleteNote,
}
