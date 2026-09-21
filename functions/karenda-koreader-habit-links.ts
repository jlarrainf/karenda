import { createAdminClient, createClient } from 'npm:@insforge/sdk'

const BASE_URL = Deno.env.get('INSFORGE_BASE_URL') ?? ''
const ADMIN_API_KEY = Deno.env.get('API_KEY') ?? ''
const TOKEN_COLUMNS =
  'id, label, scopes, created_at, updated_at, last_used_at, revoked_at, expires_at'

const ALLOWED_ORIGINS = new Set([
  'https://5zz5dxgt.insforge.site',
  'https://karenda.insforge.site',
  'https://localhost',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

const METRICS = [
  {
    key: 'reading_pages',
    label: 'Páginas leídas',
    description: 'Páginas distintas registradas por KOReader.',
    sourceUnit: 'pages',
    trackingType: 'count',
    defaultName: 'Leer páginas',
    defaultUnit: 'páginas',
  },
  {
    key: 'reading_minutes',
    label: 'Tiempo de lectura',
    description: 'Tiempo acumulado de lectura, mostrado en horas.',
    sourceUnit: 'minutes',
    trackingType: 'duration',
    defaultName: 'Leer',
    defaultUnit: 'horas',
  },
  {
    key: 'books_completed',
    label: 'Libros terminados',
    description: 'Libros que KOReader pudo confirmar como terminados.',
    sourceUnit: 'books',
    trackingType: 'count',
    defaultName: 'Terminar libros',
    defaultUnit: 'libros',
  },
  {
    key: 'anki_cards_reviewed',
    label: 'Cartas revisadas de Anki',
    description: 'Cartas revisadas por día en Anki del Kindle.',
    sourceUnit: 'cards',
    trackingType: 'count',
    defaultName: 'Revisar Anki',
    defaultUnit: 'cartas',
  },
] as const

class RequestError extends Error {
  readonly status: number
  readonly errorCode: string

  constructor(status: number, errorCode: string, message: string) {
    super(message)
    this.status = status
    this.errorCode = errorCode
  }
}

function getBearerToken(request: Request): string | null {
  const match = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function getCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function response(
  request: Request,
  body: Record<string, unknown> | null,
  status: number,
): Response {
  const headers = new Headers(getCorsHeaders(request))
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(body === null ? null : JSON.stringify(body), { status, headers })
}

function errorResponse(request: Request, error: RequestError): Response {
  return response(
    request,
    { error_code: error.errorCode, message: error.message },
    error.status,
  )
}

function admin() {
  if (!BASE_URL || !ADMIN_API_KEY) {
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'La configuración de estadísticas no está disponible.',
    )
  }
  return createAdminClient({ baseUrl: BASE_URL, apiKey: ADMIN_API_KEY })
}

async function authenticated(request: Request) {
  const accessToken = getBearerToken(request)
  if (!accessToken || !BASE_URL) {
    throw new RequestError(401, 'UNAUTHORIZED', 'La sesión web no es válida.')
  }
  const client = createClient({ baseUrl: BASE_URL, accessToken })
  const { data, error } = await client.auth.getCurrentUser()
  if (error || !data?.user?.id) {
    throw new RequestError(401, 'UNAUTHORIZED', 'La sesión web no es válida.')
  }
  return { client, ownerId: data.user.id }
}

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value as Record<string, unknown>
  } catch {
    throw new RequestError(400, 'INVALID_REQUEST', 'La solicitud no es válida.')
  }
}

async function listIntegration(request: Request, ownerId: string): Promise<Response> {
  const database = admin().database
  const [devices, links] = await Promise.all([
    database
      .from('device_tokens')
      .select(TOKEN_COLUMNS)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(100),
    database
      .from('koreader_habit_links')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true })
      .limit(100),
  ])

  if (devices.error || links.error) {
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'No se pudo cargar la configuración de estadísticas.',
    )
  }

  return response(
    request,
    {
      devices: devices.data ?? [],
      links: links.data ?? [],
      metrics: METRICS,
    },
    200,
  )
}

function requireUuid(value: unknown, message: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new RequestError(400, 'INVALID_REQUEST', message)
  }
  return value
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

function requireStatus(value: unknown): 'active' | 'paused' | 'revoked' {
  if (value !== 'active' && value !== 'paused' && value !== 'revoked') {
    throw new RequestError(
      400,
      'INVALID_REQUEST',
      'El estado del vínculo no es válido.',
    )
  }
  return value
}

function validateSetupLinks(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > METRICS.length) {
    throw new RequestError(
      400,
      'INVALID_REQUEST',
      'La configuración de métricas no es válida.',
    )
  }

  const seen = new Set<string>()
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new RequestError(
        400,
        'INVALID_REQUEST',
        'La configuración de métricas no es válida.',
      )
    }
    const entry = item as Record<string, unknown>
    const metric = METRICS.find((candidate) => candidate.key === entry.metric_key)
    if (!metric || seen.has(metric.key)) {
      throw new RequestError(
        400,
        'INVALID_REQUEST',
        'La métrica no es válida o está repetida.',
      )
    }
    seen.add(metric.key)
    if (
      entry.source_unit !== metric.sourceUnit ||
      typeof entry.target_unit !== 'string' ||
      entry.target_unit.trim().length < 1 ||
      entry.target_unit.trim().length > 80
    ) {
      throw new RequestError(
        400,
        'INVALID_REQUEST',
        'La unidad de la métrica no es válida.',
      )
    }
    if (
      entry.habit_id !== null &&
      entry.habit_id !== undefined &&
      !isUuid(entry.habit_id)
    ) {
      throw new RequestError(400, 'INVALID_REQUEST', 'El hábito no es válido.')
    }
    if (
      entry.description !== null &&
      entry.description !== undefined &&
      (typeof entry.description !== 'string' || entry.description.length > 2000)
    ) {
      throw new RequestError(400, 'INVALID_REQUEST', 'La descripción no es válida.')
    }
    if (
      entry.conversion_factor !== undefined &&
      (typeof entry.conversion_factor !== 'number' ||
        !Number.isFinite(entry.conversion_factor) ||
        entry.conversion_factor <= 0)
    ) {
      throw new RequestError(400, 'INVALID_REQUEST', 'La conversión no es válida.')
    }
    if (
      (entry.habit_id === null || entry.habit_id === undefined) &&
      (typeof entry.name !== 'string' ||
        typeof entry.goal_value !== 'number' ||
        !Number.isFinite(entry.goal_value) ||
        entry.goal_value <= 0 ||
        typeof entry.start_date !== 'string' ||
        !isDate(entry.start_date))
    ) {
      throw new RequestError(
        400,
        'INVALID_REQUEST',
        'La meta del hábito es obligatoria.',
      )
    }
    return entry
  })
}

async function setup(
  request: Request,
  client: ReturnType<typeof createClient>,
  bodyValue: Record<string, unknown>,
): Promise<Response> {
  const deviceTokenId = requireUuid(
    bodyValue.device_token_id,
    'El dispositivo no es válido.',
  )
  const timezone = bodyValue.timezone
  if (typeof timezone !== 'string' || !timezone.trim()) {
    throw new RequestError(400, 'INVALID_REQUEST', 'La zona horaria es obligatoria.')
  }
  const links = validateSetupLinks(bodyValue.links)
  const { data, error } = await client.database.rpc('setup_koreader_habit_links', {
    p_device_token_id: deviceTokenId,
    p_timezone: timezone.trim(),
    p_links: links,
  })
  if (error) {
    throw new RequestError(
      409,
      'SETUP_CONFLICT',
      'No se pudo activar la configuración de estadísticas.',
    )
  }
  return response(
    request,
    { links: data ?? [], message: 'Las estadísticas quedaron vinculadas.' },
    201,
  )
}

async function updateStatus(
  request: Request,
  ownerId: string,
  bodyValue: Record<string, unknown>,
): Promise<Response> {
  const linkId = requireUuid(bodyValue.link_id, 'El vínculo no es válido.')
  const status = requireStatus(bodyValue.status)
  const database = admin().database
  const existing = await database
    .from('koreader_habit_links')
    .select('id, status')
    .eq('id', linkId)
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (existing.error || !existing.data) {
    throw new RequestError(404, 'NOT_FOUND', 'No se encontró el vínculo.')
  }
  if (existing.data.status === 'revoked' && status !== 'revoked') {
    throw new RequestError(
      409,
      'SETUP_CONFLICT',
      'Un vínculo revocado no se puede reactivar.',
    )
  }
  const result = await database
    .from('koreader_habit_links')
    .update({
      status,
      revoked_at: status === 'revoked' ? new Date().toISOString() : null,
    })
    .eq('id', linkId)
    .eq('owner_id', ownerId)
  if (result.error) {
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'No se pudo actualizar el vínculo.',
    )
  }
  return response(request, { message: 'El vínculo fue actualizado.' }, 200)
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: getCorsHeaders(request) })
  if (!['GET', 'POST'].includes(request.method)) {
    return errorResponse(
      request,
      new RequestError(
        405,
        'METHOD_NOT_ALLOWED',
        'El método solicitado no está disponible.',
      ),
    )
  }
  const { client, ownerId } = await authenticated(request)
  if (request.method === 'GET') return listIntegration(request, ownerId)
  const value = await body(request)
  if (value.action === 'setup') return setup(request, client, value)
  if (value.action === 'status') return updateStatus(request, ownerId, value)
  throw new RequestError(
    400,
    'INVALID_REQUEST',
    'La operación solicitada no es válida.',
  )
}

export default async function handler(request: Request): Promise<Response> {
  try {
    return await handle(request)
  } catch (error) {
    if (error instanceof RequestError) return errorResponse(request, error)
    return errorResponse(
      request,
      new RequestError(
        503,
        'BACKEND_UNAVAILABLE',
        'La integración de estadísticas no está disponible.',
      ),
    )
  }
}
