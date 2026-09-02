import { insforge } from '../lib/insforge/client.ts'
import type { Database } from '../lib/insforge/database.types.ts'
import type { PersonalGroup } from '../types/domain.ts'
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
  personalGroupInputSchema,
  personalGroupPatchSchema,
  type PersonalGroupInput,
  type PersonalGroupPatch,
} from './validation.ts'

type PersonalGroupRow = Database['public']['Tables']['personal_groups']['Row']

const PERSONAL_GROUP_COLUMNS = 'id, owner_id, name, color, created_at, updated_at'
const MAX_PERSONAL_GROUPS = 500

function mapPersonalGroup(row: PersonalGroupRow): PersonalGroup {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listPersonalGroups(): Promise<PersonalGroup[]> {
  const ownerId = await requireCurrentUserId()
  const data = await runInsForge<PersonalGroupRow[]>(
    () =>
      insforge.database
        .from('personal_groups')
        .select(PERSONAL_GROUP_COLUMNS)
        .eq('owner_id', ownerId)
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .limit(MAX_PERSONAL_GROUPS),
    'No se pudieron cargar los grupos personales.',
  )

  return data.map(mapPersonalGroup)
}

export async function getPersonalGroup(id: string): Promise<PersonalGroup | null> {
  const ownerId = await requireCurrentUserId()
  const parsedId = parseInput(entityIdSchema, id)
  const data = await runInsForgeOptional<PersonalGroupRow>(
    () =>
      insforge.database
        .from('personal_groups')
        .select(PERSONAL_GROUP_COLUMNS)
        .eq('id', parsedId)
        .eq('owner_id', ownerId)
        .maybeSingle(),
    'No se pudo cargar el grupo personal.',
  )

  return data ? mapPersonalGroup(data) : null
}

export async function createPersonalGroup(
  input: PersonalGroupInput,
): Promise<PersonalGroup> {
  const ownerId = await requireCurrentUserId()
  const parsed = parseInput(personalGroupInputSchema, input)
  const data = await runInsForge<PersonalGroupRow>(
    () =>
      insforge.database
        .from('personal_groups')
        .insert([{ owner_id: ownerId, ...parsed }])
        .select(PERSONAL_GROUP_COLUMNS)
        .single(),
    'No se pudo crear el grupo personal.',
  )

  return mapPersonalGroup(data)
}

export async function updatePersonalGroup(
  id: string,
  input: PersonalGroupPatch,
): Promise<PersonalGroup> {
  const ownerId = await requireCurrentUserId()
  const parsedId = parseInput(entityIdSchema, id)
  const parsed = parseInput(personalGroupPatchSchema, input)
  const data = await runInsForge<PersonalGroupRow>(
    () =>
      insforge.database
        .from('personal_groups')
        .update(parsed)
        .eq('id', parsedId)
        .eq('owner_id', ownerId)
        .select(PERSONAL_GROUP_COLUMNS)
        .single(),
    'No se pudo actualizar el grupo personal.',
  )

  return mapPersonalGroup(data)
}

export async function deletePersonalGroup(id: string): Promise<void> {
  const ownerId = await requireCurrentUserId()
  const parsedId = parseInput(entityIdSchema, id)
  const group = await getPersonalGroup(parsedId)

  if (!group) {
    throw new AppError('not_found', 'No se encontró el grupo personal.')
  }

  await runInsForgeAction(
    () =>
      insforge.database
        .from('personal_groups')
        .delete()
        .eq('id', parsedId)
        .eq('owner_id', ownerId),
    'No se pudo eliminar el grupo personal. Resuelve primero sus asociaciones.',
  )
}

export const personalGroupService = {
  list: listPersonalGroups,
  getById: getPersonalGroup,
  create: createPersonalGroup,
  update: updatePersonalGroup,
  remove: deletePersonalGroup,
}
