import { insforge } from '../lib/insforge/client.ts'
import type { Database } from '../lib/insforge/database.types.ts'
import type { Subject } from '../types/domain.ts'
import { requireCurrentUserId } from './authService.ts'
import {
  AppError,
  runInsForge,
  runInsForgeAction,
  runInsForgeOptional,
} from './errors.ts'
import {
  entityIdSchema,
  parseInput,
  subjectInputSchema,
  subjectPatchSchema,
  type SubjectInput,
  type SubjectPatch,
} from './validation.ts'

type SubjectRow = Database['public']['Tables']['subjects']['Row']

const SUBJECT_COLUMNS =
  'id, owner_id, name, code, abbreviation, color, created_at, updated_at'
const MAX_SUBJECTS = 500

function mapSubject(row: SubjectRow): Subject {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    code: row.code,
    abbreviation: row.abbreviation,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listSubjects(): Promise<Subject[]> {
  const ownerId = await requireCurrentUserId()
  const data = await runInsForge<SubjectRow[]>(
    () =>
      insforge.database
        .from('subjects')
        .select(SUBJECT_COLUMNS)
        .eq('owner_id', ownerId)
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .limit(MAX_SUBJECTS),
    'No se pudieron cargar las asignaturas.',
  )

  return data.map(mapSubject)
}

export async function getSubject(id: string): Promise<Subject | null> {
  const ownerId = await requireCurrentUserId()
  const parsedId = parseInput(entityIdSchema, id)
  const data = await runInsForgeOptional<SubjectRow>(
    () =>
      insforge.database
        .from('subjects')
        .select(SUBJECT_COLUMNS)
        .eq('id', parsedId)
        .eq('owner_id', ownerId)
        .maybeSingle(),
    'No se pudo cargar la asignatura.',
  )

  return data ? mapSubject(data) : null
}

export async function createSubject(input: SubjectInput): Promise<Subject> {
  const ownerId = await requireCurrentUserId()
  const parsed = parseInput(subjectInputSchema, input)
  const data = await runInsForge<SubjectRow>(
    () =>
      insforge.database
        .from('subjects')
        .insert([{ owner_id: ownerId, ...parsed }])
        .select(SUBJECT_COLUMNS)
        .single(),
    'No se pudo crear la asignatura.',
  )

  return mapSubject(data)
}

export async function updateSubject(id: string, input: SubjectPatch): Promise<Subject> {
  const ownerId = await requireCurrentUserId()
  const parsedId = parseInput(entityIdSchema, id)
  const parsed = parseInput(subjectPatchSchema, input)
  const data = await runInsForge<SubjectRow>(
    () =>
      insforge.database
        .from('subjects')
        .update(parsed)
        .eq('id', parsedId)
        .eq('owner_id', ownerId)
        .select(SUBJECT_COLUMNS)
        .single(),
    'No se pudo actualizar la asignatura.',
  )

  return mapSubject(data)
}

export async function deleteSubject(id: string): Promise<void> {
  const ownerId = await requireCurrentUserId()
  const parsedId = parseInput(entityIdSchema, id)
  const subject = await getSubject(parsedId)

  if (!subject) {
    throw new AppError('not_found', 'No se encontró la asignatura.')
  }

  await runInsForgeAction(
    () =>
      insforge.database
        .from('subjects')
        .delete()
        .eq('id', parsedId)
        .eq('owner_id', ownerId),
    'No se pudo eliminar la asignatura. Resuelve primero sus asociaciones.',
  )
}

export const subjectService = {
  list: listSubjects,
  getById: getSubject,
  create: createSubject,
  update: updateSubject,
  remove: deleteSubject,
}
