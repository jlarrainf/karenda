import { createClient } from 'npm:@insforge/sdk'

const BASE_URL = Deno.env.get('INSFORGE_BASE_URL') ?? ''
const PILOT_OWNER_IDS = new Set(
  (Deno.env.get('CANVAS_PILOT_OWNER_IDS') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
)
const ALLOWED_ORIGINS = new Set([
  'https://5zz5dxgt.insforge.site',
  'https://karenda.insforge.site',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])
const DECISIONS = new Set(['link_existing', 'create_subject', 'create_event', 'apply_update', 'ignore'])

class RequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

function cors(request: Request): HeadersInit {
  const origin = request.headers.get('Origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin',
  }
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function response(request: Request, value: Record<string, unknown>, status = 200): Response {
  const headers = new Headers(cors(request))
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(value), { headers, status })
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid')
    return value as Record<string, unknown>
  } catch {
    throw new RequestError(400, 'INVALID_REQUEST', 'La solicitud no es válida.')
  }
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) })
  if (request.method !== 'POST') throw new RequestError(405, 'METHOD_NOT_ALLOWED', 'El método solicitado no está disponible.')
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (!token || !BASE_URL) throw new RequestError(401, 'UNAUTHORIZED', 'La sesión web no es válida.')
  const client = createClient({ baseUrl: BASE_URL, accessToken: token })
  const current = await client.auth.getCurrentUser()
  const ownerId = current.data?.user?.id
  if (current.error || !ownerId) throw new RequestError(401, 'UNAUTHORIZED', 'La sesión web no es válida.')
  if (!PILOT_OWNER_IDS.has(ownerId)) throw new RequestError(403, 'PILOT_RESTRICTED', 'El piloto de Canvas aún no está habilitado para esta cuenta.')

  const input = await parseBody(request)
  if (!validUuid(input.reviewItemId) || typeof input.decision !== 'string' || !DECISIONS.has(input.decision)) {
    throw new RequestError(400, 'INVALID_REQUEST', 'La decisión de revisión no es válida.')
  }
  if (input.eventId !== undefined && input.eventId !== null && !validUuid(input.eventId)) {
    throw new RequestError(400, 'INVALID_REQUEST', 'El evento seleccionado no es válido.')
  }
  const overrides = input.overrides === undefined ? {} : input.overrides
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides) || JSON.stringify(overrides).length > 12_000) {
    throw new RequestError(400, 'INVALID_REQUEST', 'Los cambios propuestos no son válidos.')
  }

  const { data, error } = await client.database.rpc('apply_canvas_review', {
    p_review_item_id: input.reviewItemId,
    p_decision: input.decision,
    p_target_id: input.eventId ?? null,
    p_overrides: overrides,
  })
  if (error) {
    const message = String((error as { message?: unknown }).message ?? '')
    if (message.includes('No se encontró')) throw new RequestError(404, 'NOT_FOUND', 'No se encontró la revisión pendiente.')
    if (message.includes('Vincula primero')) throw new RequestError(409, 'COURSE_MAPPING_REQUIRED', 'Vincula primero la asignatura de Canvas.')
    throw new RequestError(400, 'REVIEW_NOT_APPLIED', 'No se pudo aplicar la decisión. Revisa los datos e inténtalo nuevamente.')
  }
  return response(request, { result: data, message: 'La decisión fue aplicada.' })
}

export default async function main(request: Request): Promise<Response> {
  try {
    return await handle(request)
  } catch (error) {
    const safe = error instanceof RequestError ? error : new RequestError(503, 'BACKEND_UNAVAILABLE', 'La revisión de Canvas no está disponible.')
    return response(request, { error_code: safe.code, message: safe.message }, safe.status)
  }
}
