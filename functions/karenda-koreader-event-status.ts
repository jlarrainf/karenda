import { createAdminClient } from 'npm:@insforge/sdk'

const BASE_URL = Deno.env.get('INSFORGE_BASE_URL') ?? ''
const ADMIN_API_KEY = Deno.env.get('API_KEY') ?? ''
const REQUIRED_SCOPE = 'write:event_status'
const ALLOWED_ORIGINS = new Set([
  'https://5zz5dxgt.insforge.site',
  'https://5zz5dxgt-tkp.insforge.site',
  'https://karenda.insforge.site',
  'https://localhost',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

type EventStatus = 'pending' | 'completed'

class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string,
  ) {
    super(message)
  }
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function jsonResponse(request: Request, body: Record<string, unknown>, status: number): Response {
  const headers = new Headers(corsHeaders(request))
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers })
}

function errorResponse(request: Request, error: RequestError): Response {
  return jsonResponse(request, { error_code: error.errorCode, message: error.message }, error.status)
}

function adminClient() {
  if (!BASE_URL || !ADMIN_API_KEY) {
    throw new RequestError(503, 'BACKEND_UNAVAILABLE', 'Karenda no está disponible.')
  }
  return createAdminClient({ baseUrl: BASE_URL, apiKey: ADMIN_API_KEY })
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value as Record<string, unknown>
  } catch {
    throw new RequestError(400, 'INVALID_REQUEST', 'La solicitud no es válida.')
  }
}

function parseEventInput(body: Record<string, unknown>): { eventId: string; status: EventStatus } {
  const keys = Object.keys(body)
  if (keys.length !== 2 || !keys.includes('event_id') || !keys.includes('status')) {
    throw new RequestError(400, 'INVALID_REQUEST', 'La solicitud no es válida.')
  }
  const eventId = body.event_id
  const status = body.status
  if (typeof eventId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
    throw new RequestError(400, 'INVALID_REQUEST', 'El identificador del evento no es válido.')
  }
  if (status !== 'pending' && status !== 'completed') {
    throw new RequestError(400, 'INVALID_REQUEST', 'El estado del evento no es válido.')
  }
  return { eventId, status }
}

async function authenticate(request: Request) {
  const match = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)
  const bearer = match?.[1]?.trim()
  if (!bearer) {
    throw new RequestError(401, 'UNAUTHORIZED', 'El token del dispositivo no es válido.')
  }
  const tokenDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bearer))
  const tokenHash = Array.from(new Uint8Array(tokenDigest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const admin = adminClient()
  const { data, error } = await admin.database
    .from('device_tokens')
    .select('id, owner_id, scopes, revoked_at, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (error) {
    throw new RequestError(503, 'BACKEND_UNAVAILABLE', 'Karenda no está disponible.')
  }
  if (!data || data.revoked_at || (data.expires_at && new Date(data.expires_at).getTime() <= Date.now())) {
    throw new RequestError(401, 'UNAUTHORIZED', 'El token del dispositivo no es válido.')
  }
  if (!Array.isArray(data.scopes) || !data.scopes.includes(REQUIRED_SCOPE)) {
    throw new RequestError(
      403,
      'INSUFFICIENT_SCOPE',
      'Activa “Cambiar estado de eventos desde InkDesk” en Karenda > Dispositivos.',
    )
  }
  return { admin, tokenId: data.id as string, ownerId: data.owner_id as string }
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== 'POST') {
    return errorResponse(request, new RequestError(405, 'METHOD_NOT_ALLOWED', 'El método solicitado no está disponible.'))
  }

  const input = parseEventInput(await parseBody(request))
  const auth = await authenticate(request)
  const { data, error } = await auth.admin.database
    .from('events')
    .update({ status: input.status })
    .eq('id', input.eventId)
    .eq('owner_id', auth.ownerId)
    .select('id, status, updated_at')
    .maybeSingle()

  if (error) {
    throw new RequestError(503, 'BACKEND_UNAVAILABLE', 'No se pudo actualizar el evento.')
  }
  if (!data) {
    throw new RequestError(404, 'EVENT_NOT_FOUND', 'No se encontró el evento.')
  }

  await auth.admin.database
    .from('device_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', auth.tokenId)
    .eq('owner_id', auth.ownerId)

  return jsonResponse(request, {
    event_id: data.id,
    status: data.status,
    updated_at: data.updated_at,
  }, 200)
}

export default async function handle(request: Request): Promise<Response> {
  try {
    return await handleRequest(request)
  } catch (error) {
    if (error instanceof RequestError) return errorResponse(request, error)
    return errorResponse(request, new RequestError(503, 'BACKEND_UNAVAILABLE', 'Karenda no está disponible.'))
  }
}
