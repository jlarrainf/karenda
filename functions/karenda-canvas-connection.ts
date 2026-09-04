import { createAdminClient, createClient } from 'npm:@insforge/sdk'

const BASE_URL = Deno.env.get('INSFORGE_BASE_URL') ?? ''
const ADMIN_API_KEY = Deno.env.get('API_KEY') ?? ''
const CANVAS_BASE_URL = 'https://cursos.canvas.uc.cl'
const ENCRYPTION_KEY = Deno.env.get('CANVAS_CREDENTIAL_ENCRYPTION_KEY') ?? ''
const PILOT_OWNER_IDS = new Set(
  (Deno.env.get('CANVAS_PILOT_OWNER_IDS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
)
const ALLOWED_ORIGINS = new Set([
  'https://5zz5dxgt.insforge.site',
  'https://karenda.insforge.site',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function json(request: Request, body: Record<string, unknown>, status = 200): Response {
  const headers = new Headers(corsHeaders(request))
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { headers, status })
}

function bearer(request: Request): string | null {
  return request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null
}

function adminClient() {
  if (!BASE_URL || !ADMIN_API_KEY || !ENCRYPTION_KEY) {
    throw new RequestError(503, 'BACKEND_UNAVAILABLE', 'La conexión con Canvas no está disponible.')
  }
  return createAdminClient({ baseUrl: BASE_URL, apiKey: ADMIN_API_KEY })
}

async function authenticatedOwner(request: Request): Promise<string> {
  const accessToken = bearer(request)
  if (!accessToken || !BASE_URL) throw new RequestError(401, 'UNAUTHORIZED', 'La sesión web no es válida.')
  const client = createClient({ baseUrl: BASE_URL, accessToken })
  const { data, error } = await client.auth.getCurrentUser()
  if (error || !data?.user?.id) throw new RequestError(401, 'UNAUTHORIZED', 'La sesión web no es válida.')
  if (!PILOT_OWNER_IDS.has(data.user.id)) {
    throw new RequestError(403, 'PILOT_RESTRICTED', 'El piloto de Canvas aún no está habilitado para esta cuenta.')
  }
  return data.user.id
}

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid')
    return value as Record<string, unknown>
  } catch {
    throw new RequestError(400, 'INVALID_REQUEST', 'La solicitud no es válida.')
  }
}

function decodeKey(value: string): Uint8Array {
  try {
    const binary = atob(value)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    if (bytes.length !== 32) throw new Error('length')
    return bytes
  } catch {
    throw new RequestError(503, 'BACKEND_UNAVAILABLE', 'La conexión con Canvas no está disponible.')
  }
}

function encode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function encryptToken(token: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await crypto.subtle.importKey('raw', decodeKey(ENCRYPTION_KEY), 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('karenda-canvas-token:v1') },
    key,
    new TextEncoder().encode(token),
  )
  return { ciphertext: encode(new Uint8Array(encrypted)), iv: encode(iv) }
}

function timeZoneParts(date: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
}

function localToUtc(year: number, month: number, day: number, hour: number): Date {
  let result = new Date(Date.UTC(year, month - 1, day, hour))
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = timeZoneParts(result)
    const wanted = Date.UTC(year, month - 1, day, hour)
    const observed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    result = new Date(result.getTime() + wanted - observed)
  }
  return result
}

function nextSyncAt(now = new Date()): string {
  const parts = timeZoneParts(now)
  const localDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  if (parts.hour >= 6) localDay.setUTCDate(localDay.getUTCDate() + 1)
  return localToUtc(localDay.getUTCFullYear(), localDay.getUTCMonth() + 1, localDay.getUTCDate(), 6).toISOString()
}

function normalizeExpiry(value: unknown): string {
  if (typeof value !== 'string') throw new RequestError(400, 'INVALID_EXPIRY', 'Indica la fecha de vencimiento del token.')
  const expiry = new Date(value)
  const lifetime = expiry.getTime() - Date.now()
  if (!Number.isFinite(expiry.getTime()) || lifetime <= 0 || lifetime > 91 * 24 * 60 * 60 * 1000) {
    throw new RequestError(400, 'INVALID_EXPIRY', 'El vencimiento debe estar dentro de los próximos 90 días.')
  }
  return expiry.toISOString()
}

async function validateCanvasToken(token: string): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(`${CANVAS_BASE_URL}/api/v1/users/self/profile`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal,
    })
    if (response.status === 401 || response.status === 403) {
      throw new RequestError(422, 'CANVAS_TOKEN_INVALID', 'Canvas rechazó el token. Revísalo o genera uno nuevo.')
    }
    if (!response.ok) throw new RequestError(502, 'CANVAS_UNAVAILABLE', 'Canvas no respondió correctamente. Inténtalo más tarde.')
  } catch (error) {
    if (error instanceof RequestError) throw error
    throw new RequestError(502, 'CANVAS_UNAVAILABLE', 'No fue posible comunicarse con Canvas.')
  } finally {
    clearTimeout(timeout)
  }
}

async function getConnection(ownerId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await adminClient().database
    .from('canvas_connections')
    .select('id, canvas_base_url, auth_mode, status, time_zone, token_expires_at, last_sync_at, next_sync_at, last_error_code, last_error_message, created_at, updated_at')
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (error) throw new RequestError(503, 'BACKEND_UNAVAILABLE', 'No se pudo cargar la conexión con Canvas.')
  return (data as Record<string, unknown> | null) ?? null
}

async function connect(ownerId: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = typeof input.token === 'string' ? input.token.trim() : ''
  if (token.length < 16 || token.length > 512) throw new RequestError(400, 'INVALID_TOKEN', 'El token de Canvas no es válido.')
  const tokenExpiresAt = normalizeExpiry(input.tokenExpiresAt)
  await validateCanvasToken(token)
  const encrypted = await encryptToken(token)
  const admin = adminClient()
  const existing = await getConnection(ownerId)
  let connectionId: string
  if (existing) {
    connectionId = String(existing.id)
    const { error } = await admin.database.from('canvas_connections').update({
      status: 'connected', token_expires_at: tokenExpiresAt, next_sync_at: nextSyncAt(),
      last_error_code: null, last_error_message: null,
    }).eq('id', connectionId).eq('owner_id', ownerId)
    if (error) throw new RequestError(503, 'BACKEND_UNAVAILABLE', 'No se pudo actualizar la conexión con Canvas.')
  } else {
    const { data, error } = await admin.database.from('canvas_connections').insert([{
      owner_id: ownerId, token_expires_at: tokenExpiresAt, next_sync_at: nextSyncAt(),
    }]).select('id').single()
    if (error || !data) throw new RequestError(503, 'BACKEND_UNAVAILABLE', 'No se pudo guardar la conexión con Canvas.')
    connectionId = String((data as { id: string }).id)
  }
  const { data: credential } = await admin.database.from('canvas_credentials').select('id').eq('connection_id', connectionId).maybeSingle()
  const credentialPayload = {
    connection_id: connectionId, owner_id: ownerId, token_ciphertext: encrypted.ciphertext,
    token_iv: encrypted.iv, key_version: 1,
  }
  const credentialResult = credential
    ? await admin.database.from('canvas_credentials').update(credentialPayload).eq('connection_id', connectionId)
    : await admin.database.from('canvas_credentials').insert([credentialPayload])
  if (credentialResult.error) throw new RequestError(503, 'BACKEND_UNAVAILABLE', 'No se pudo proteger el token de Canvas.')
  return (await getConnection(ownerId))!
}

async function disconnect(ownerId: string): Promise<void> {
  const admin = adminClient()
  const existing = await getConnection(ownerId)
  if (!existing) return
  const connectionId = String(existing.id)
  const deletion = await admin.database.from('canvas_credentials').delete().eq('connection_id', connectionId).eq('owner_id', ownerId)
  if (deletion.error) throw new RequestError(503, 'BACKEND_UNAVAILABLE', 'No se pudo eliminar la credencial de Canvas.')
  const update = await admin.database.from('canvas_connections').update({
    status: 'disabled', next_sync_at: null, sync_lock_expires_at: null,
    last_error_code: null, last_error_message: null,
  }).eq('id', connectionId).eq('owner_id', ownerId)
  if (update.error) throw new RequestError(503, 'BACKEND_UNAVAILABLE', 'No se pudo desconectar Canvas.')
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (!['GET', 'POST'].includes(request.method)) throw new RequestError(405, 'METHOD_NOT_ALLOWED', 'El método solicitado no está disponible.')
  const ownerId = await authenticatedOwner(request)
  if (request.method === 'GET') return json(request, { connection: await getConnection(ownerId) })
  const input = await body(request)
  const action = input.action ?? 'connect'
  if (action === 'disconnect') {
    await disconnect(ownerId)
    return json(request, { connection: await getConnection(ownerId), message: 'Canvas fue desconectado. Tus datos históricos se conservaron.' })
  }
  if (action !== 'connect' && action !== 'replace_token') throw new RequestError(400, 'INVALID_REQUEST', 'La operación solicitada no es válida.')
  return json(request, { connection: await connect(ownerId, input), message: 'La conexión con Canvas quedó lista.' }, 201)
}

export default async function main(request: Request): Promise<Response> {
  try {
    return await handle(request)
  } catch (error) {
    const safe = error instanceof RequestError ? error : new RequestError(503, 'BACKEND_UNAVAILABLE', 'La conexión con Canvas no está disponible.')
    return json(request, { error_code: safe.errorCode, message: safe.message }, safe.status)
  }
}
