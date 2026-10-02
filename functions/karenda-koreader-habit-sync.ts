import { createAdminClient } from 'npm:@insforge/sdk'

const BASE_URL = Deno.env.get('INSFORGE_BASE_URL') ?? ''
const ADMIN_API_KEY = Deno.env.get('API_KEY') ?? ''
const MAX_OBSERVATIONS = 2000
const ALLOWED_ORIGINS = new Set([
  'https://5zz5dxgt.insforge.site',
  'https://karenda.insforge.site',
  'https://localhost',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

const METRIC_UNITS = new Map([
  ['reading_pages', 'pages'],
  ['reading_minutes', 'minutes'],
  ['books_completed', 'books'],
  ['anki_cards_reviewed', 'cards'],
])

interface SyncLink {
  id: string
  metric_key: string
  source_unit: string
  target_unit: string
  conversion_factor: number
  timezone: string
  habit_id: string
}

interface SyncHabit {
  id: string
  owner_id: string
  tracking_type: string
  unit: string | null
  goal_value: number
  start_date: string
  end_date: string | null
}

class RequestError extends Error {
  readonly status: number
  readonly errorCode: string

  constructor(status: number, errorCode: string, message: string) {
    super(message)
    this.status = status
    this.errorCode = errorCode
  }
}

function getCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
  if (origin && ALLOWED_ORIGINS.has(origin))
    headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function jsonResponse(
  request: Request,
  body: Record<string, unknown>,
  status: number,
): Response {
  const headers = new Headers(getCorsHeaders(request))
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers })
}

function errorResponse(request: Request, error: RequestError): Response {
  return jsonResponse(
    request,
    { error_code: error.errorCode, message: error.message },
    error.status,
  )
}

function bearer(request: Request): string {
  const match = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]?.trim())
    throw new RequestError(
      401,
      'UNAUTHORIZED',
      'El token del dispositivo no es válido o fue revocado.',
    )
  return match[1].trim()
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function getAdminClient() {
  if (!BASE_URL || !ADMIN_API_KEY)
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'La sincronización no está disponible.',
    )
  return createAdminClient({ baseUrl: BASE_URL, apiKey: ADMIN_API_KEY })
}

async function authenticate(request: Request) {
  const tokenHash = await hash(bearer(request))
  const database = getAdminClient().database
  const result = await database
    .from('device_tokens')
    .select('id, owner_id, scopes, revoked_at, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (
    result.error ||
    !result.data ||
    result.data.revoked_at ||
    (result.data.expires_at && new Date(result.data.expires_at).getTime() <= Date.now())
  ) {
    throw new RequestError(
      401,
      'UNAUTHORIZED',
      'El token del dispositivo no es válido o fue revocado.',
    )
  }
  if (!result.data.scopes.includes('write:habit_logs')) {
    throw new RequestError(
      403,
      'INSUFFICIENT_SCOPE',
      'El dispositivo no tiene permiso para sincronizar hábitos.',
    )
  }
  await database
    .from('device_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', result.data.id)
  return { database, token: result.data }
}

async function parseJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value as Record<string, unknown>
  } catch {
    throw new RequestError(400, 'INVALID_REQUEST', 'La solicitud no es válida.')
  }
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

async function getConfig(
  request: Request,
  auth: Awaited<ReturnType<typeof authenticate>>,
): Promise<Response> {
  const links = await auth.database
    .from('koreader_habit_links')
    .select(
      'id, metric_key, source_unit, target_unit, conversion_factor, timezone, habit_id',
    )
    .eq('device_token_id', auth.token.id)
    .eq('owner_id', auth.token.owner_id)
    .eq('status', 'active')
    .order('metric_key', { ascending: true })
  if (links.error)
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'No se pudo cargar la configuración de estadísticas.',
    )
  if (!links.data || links.data.length === 0) {
    return jsonResponse(
      request,
      {
        schema_version: 1,
        timezone: null,
        links: [],
      },
      200,
    )
  }
  const habitIds = [...new Set((links.data ?? []).map((link) => link.habit_id))]
  const habits = await auth.database
    .from('habits')
    .select('id, start_date, end_date')
    .eq('owner_id', auth.token.owner_id)
    .in('id', habitIds)
  if (habits.error)
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'No se pudo cargar la configuración de estadísticas.',
    )
  const habitsById = new Map((habits.data ?? []).map((habit) => [habit.id, habit]))
  return jsonResponse(
    request,
    {
      schema_version: 1,
      timezone: links.data?.[0]?.timezone ?? null,
      links: (links.data ?? []).map((link) => ({
        ...link,
        start_date: habitsById.get(link.habit_id)?.start_date ?? null,
        end_date: habitsById.get(link.habit_id)?.end_date ?? null,
      })),
    },
    200,
  )
}

async function syncBatch(
  request: Request,
  auth: Awaited<ReturnType<typeof authenticate>>,
  input: Record<string, unknown>,
): Promise<Response> {
  const timezone = input.timezone
  const observations = input.observations
  if (
    typeof timezone !== 'string' ||
    !timezone.trim() ||
    !Array.isArray(observations) ||
    observations.length === 0 ||
    observations.length > MAX_OBSERVATIONS
  ) {
    throw new RequestError(
      400,
      'INVALID_REQUEST',
      'El lote de estadísticas no es válido.',
    )
  }

  const linksResult = await auth.database
    .from('koreader_habit_links')
    .select(
      'id, metric_key, source_unit, target_unit, conversion_factor, timezone, habit_id',
    )
    .eq('device_token_id', auth.token.id)
    .eq('owner_id', auth.token.owner_id)
    .eq('status', 'active')
  if (linksResult.error)
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'No se pudo validar la configuración de estadísticas.',
    )
  const links = new Map<string, SyncLink>(
    (linksResult.data ?? []).map((link) => [link.id, link as SyncLink]),
  )
  const habitIds = [...new Set((linksResult.data ?? []).map((link) => link.habit_id))]
  const habitsResult = await auth.database
    .from('habits')
    .select('id, owner_id, tracking_type, unit, goal_value, start_date, end_date')
    .eq('owner_id', auth.token.owner_id)
    .in('id', habitIds)
  if (habitsResult.error)
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'No se pudieron validar los hábitos vinculados.',
    )
  const habits = new Map<string, SyncHabit>(
    (habitsResult.data ?? []).map((habit) => [habit.id, habit as SyncHabit]),
  )
  const seen = new Set<string>()
  const normalized: Array<{
    link: SyncLink
    habit: SyncHabit
    date: string
    value: number
    externalId: string
  }> = []

  for (const value of observations) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new RequestError(400, 'INVALID_REQUEST', 'Una observación no es válida.')
    const observation = value as Record<string, unknown>
    const linkId = observation.link_id
    const date = observation.local_date
    const numericValue = observation.value
    const externalId = observation.external_id
    if (
      typeof linkId !== 'string' ||
      !links.has(linkId) ||
      !isDate(date) ||
      typeof numericValue !== 'number' ||
      !Number.isFinite(numericValue) ||
      numericValue < 0 ||
      typeof externalId !== 'string' ||
      externalId.length < 1 ||
      externalId.length > 240
    ) {
      throw new RequestError(
        422,
        'INVALID_OBSERVATION',
        'Una observación de estadísticas no es válida.',
      )
    }
    const link = links.get(linkId)!
    const habit = habits.get(link.habit_id)
    const expectedExternalId = `${linkId}:${date}`
    const duplicateKey = `${linkId}:${date}`
    if (
      seen.has(duplicateKey) ||
      externalId !== expectedExternalId ||
      timezone !== link.timezone
    ) {
      throw new RequestError(
        409,
        'SYNC_CONFLICT',
        'El lote contiene una observación repetida o incompatible.',
      )
    }
    if (
      !habit ||
      habit.tracking_type === 'boolean' ||
      link.source_unit !== METRIC_UNITS.get(link.metric_key) ||
      date < habit.start_date ||
      (habit.end_date && date > habit.end_date)
    ) {
      throw new RequestError(
        422,
        'INVALID_OBSERVATION',
        'El hábito no admite esta métrica.',
      )
    }
    if (
      ['reading_pages', 'books_completed', 'anki_cards_reviewed'].includes(
        link.metric_key,
      ) &&
      !Number.isInteger(numericValue)
    ) {
      throw new RequestError(
        422,
        'INVALID_OBSERVATION',
        'Las métricas de cantidad deben ser enteras.',
      )
    }
    seen.add(duplicateKey)
    normalized.push({ link, habit, date, value: numericValue, externalId })
  }

  let inserted = 0
  let updated = 0
  let deleted = 0
  let unchanged = 0
  const touched = new Set<string>()

  for (const observation of normalized) {
    touched.add(observation.link.id)
    const existing = await auth.database
      .from('habit_logs')
      .select('id, value, external_id')
      .eq('owner_id', auth.token.owner_id)
      .eq('koreader_link_id', observation.link.id)
      .eq('local_date', observation.date)
      .maybeSingle()
    if (existing.error)
      throw new RequestError(
        503,
        'BACKEND_UNAVAILABLE',
        'No se pudo revisar la estadística existente.',
      )

    if (observation.value === 0) {
      if (existing.data) {
        const result = await auth.database
          .from('habit_logs')
          .delete()
          .eq('id', existing.data.id)
        if (result.error)
          throw new RequestError(
            503,
            'BACKEND_UNAVAILABLE',
            'No se pudo corregir la estadística.',
          )
        deleted += 1
      } else unchanged += 1
      continue
    }

    const converted = observation.value * Number(observation.link.conversion_factor)
    const status =
      converted >= Number(observation.habit.goal_value) ? 'completed' : 'partial'
    const payload = {
      owner_id: auth.token.owner_id,
      habit_id: observation.habit.id,
      local_date: observation.date,
      value: converted,
      status,
      source: 'koreader',
      external_id: observation.externalId,
      koreader_link_id: observation.link.id,
    }
    if (!existing.data) {
      const result = await auth.database.from('habit_logs').insert([payload])
      if (result.error)
        throw new RequestError(
          409,
          'SYNC_CONFLICT',
          'La estadística ya existe con otro vínculo.',
        )
      inserted += 1
    } else if (existing.data.external_id !== observation.externalId) {
      throw new RequestError(
        409,
        'SYNC_CONFLICT',
        'La estadística ya existe con otro identificador.',
      )
    } else if (existing.data.value === converted) {
      unchanged += 1
    } else {
      const result = await auth.database
        .from('habit_logs')
        .update(payload)
        .eq('id', existing.data.id)
      if (result.error)
        throw new RequestError(
          503,
          'BACKEND_UNAVAILABLE',
          'No se pudo actualizar la estadística.',
        )
      updated += 1
    }
  }

  if (touched.size > 0) {
    await auth.database
      .from('koreader_habit_links')
      .update({ last_synced_at: new Date().toISOString() })
      .in('id', [...touched])
      .eq('owner_id', auth.token.owner_id)
  }

  return jsonResponse(request, { inserted, updated, deleted, unchanged }, 200)
}

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: getCorsHeaders(request) })
    if (!['GET', 'POST'].includes(request.method))
      throw new RequestError(
        405,
        'METHOD_NOT_ALLOWED',
        'El método solicitado no está disponible.',
      )
    const auth = await authenticate(request)
    if (request.method === 'GET') return getConfig(request, auth)
    return syncBatch(request, auth, await parseJson(request))
  } catch (error) {
    if (error instanceof RequestError) return errorResponse(request, error)
    return errorResponse(
      request,
      new RequestError(
        503,
        'BACKEND_UNAVAILABLE',
        'La sincronización de estadísticas no está disponible.',
      ),
    )
  }
}
