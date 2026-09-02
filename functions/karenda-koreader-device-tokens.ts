import { createAdminClient, createClient } from 'npm:@insforge/sdk'

const BASE_URL = Deno.env.get('INSFORGE_BASE_URL') ?? ''
const ADMIN_API_KEY = Deno.env.get('API_KEY') ?? ''
const DEFAULT_SCOPES = ['read:snapshot']
const ALLOWED_SCOPES = new Set(['read:snapshot', 'write:events'])
const PAIRING_CODE_TTL_MS = 10 * 60 * 1000
const PAIRING_RATE_LIMIT = 12
const PAIRING_RATE_WINDOW_SECONDS = 60

const ALLOWED_ORIGINS = new Set([
  'https://5zz5dxgt.insforge.site',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

const TOKEN_COLUMNS =
  'id, label, scopes, created_at, updated_at, last_used_at, revoked_at, expires_at'

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
  const header = request.headers.get('Authorization')
  const match = header?.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  return token || null
}

function getCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-None-Match',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}

function jsonResponse(
  request: Request,
  body: Record<string, unknown> | null,
  status: number,
): Response {
  const headers = new Headers(getCorsHeaders(request))
  headers.set('Content-Type', 'application/json; charset=utf-8')

  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers,
  })
}

function errorResponse(request: Request, error: RequestError): Response {
  return jsonResponse(
    request,
    { error_code: error.errorCode, message: error.message },
    error.status,
  )
}

function getAdminClient() {
  if (!BASE_URL || !ADMIN_API_KEY) {
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'La gestión de dispositivos no está disponible.',
    )
  }

  return createAdminClient({ baseUrl: BASE_URL, apiKey: ADMIN_API_KEY })
}

async function getAuthenticatedUser(request: Request) {
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

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function createDeviceToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return encodeBase64Url(bytes)
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

async function hashPairingValue(value: string, purpose: string): Promise<string> {
  const secret = Deno.env.get('PAIRING_CODE_SECRET') ?? ADMIN_API_KEY

  if (!secret) {
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'La vinculación de dispositivos no está disponible.',
    )
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${purpose}:${value}`),
  )

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function createPairingCode(): string {
  const values = new Uint32Array(1)
  const range = 1_000_000
  const limit = Math.floor(0x1_0000_0000 / range) * range

  do {
    crypto.getRandomValues(values)
  } while (values[0] >= limit)

  return String(values[0] % range).padStart(6, '0')
}

function getClientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return (
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    forwarded ||
    'unknown'
  )
}

function getUnknownErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message
    return typeof message === 'string' ? message : ''
  }

  return ''
}

function getUnknownStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  const statusCode = (error as Record<string, unknown>).statusCode
  return typeof statusCode === 'number' ? statusCode : undefined
}

function normalizeLabel(value: unknown): string {
  if (value === undefined || value === null) {
    return 'Kindle'
  }

  if (typeof value !== 'string') {
    throw new RequestError(
      400,
      'INVALID_REQUEST',
      'La etiqueta del dispositivo no es válida.',
    )
  }

  const label = value.trim()

  if (!label || label.length > 120) {
    throw new RequestError(
      400,
      'INVALID_REQUEST',
      'La etiqueta del dispositivo no es válida.',
    )
  }

  return label
}

function normalizeScopes(value: unknown): string[] {
  const scopes = value === undefined ? DEFAULT_SCOPES : value

  if (
    !Array.isArray(scopes) ||
    scopes.length === 0 ||
    scopes.some((scope) => typeof scope !== 'string' || !ALLOWED_SCOPES.has(scope))
  ) {
    throw new RequestError(
      400,
      'INVALID_REQUEST',
      'Los permisos del dispositivo no son válidos.',
    )
  }

  const uniqueScopes = [...new Set(scopes)]

  if (!uniqueScopes.includes('read:snapshot')) {
    throw new RequestError(
      400,
      'INVALID_REQUEST',
      'El dispositivo requiere el permiso de lectura.',
    )
  }

  return uniqueScopes
}

function normalizePairingCode(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{6}$/.test(value.trim())) {
    throw new RequestError(
      400,
      'INVALID_REQUEST',
      'El código de emparejamiento debe tener seis dígitos.',
    )
  }

  return value.trim()
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('invalid body')
    }

    return body as Record<string, unknown>
  } catch {
    throw new RequestError(400, 'INVALID_REQUEST', 'La solicitud no es válida.')
  }
}

async function listTokens(request: Request, ownerId: string): Promise<Response> {
  const admin = getAdminClient()
  const { data, error } = await admin.database
    .from('device_tokens')
    .select(TOKEN_COLUMNS)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(100)

  if (error) {
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'No se pudieron cargar los dispositivos.',
    )
  }

  return jsonResponse(request, { tokens: data ?? [] }, 200)
}

async function insertToken(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  label: string,
  scopes: string[],
): Promise<{ token: string; record: Record<string, unknown> }> {
  const token = createDeviceToken()
  const tokenHash = await hashToken(token)
  const { data, error } = await admin.database
    .from('device_tokens')
    .insert([
      {
        owner_id: ownerId,
        token_hash: tokenHash,
        label,
        scopes,
      },
    ])
    .select(TOKEN_COLUMNS)
    .single()

  if (error || !data) {
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'No se pudo generar el token del dispositivo.',
    )
  }

  return { token, record: data as Record<string, unknown> }
}

async function createToken(
  request: Request,
  ownerId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const admin = getAdminClient()
  const label = normalizeLabel(body.label)
  const scopes = normalizeScopes(body.scopes)
  const result = await insertToken(admin, ownerId, label, scopes)

  return jsonResponse(
    request,
    {
      token: result.token,
      token_metadata: result.record,
      message: 'Copia este token ahora. Karenda no volverá a mostrarlo.',
    },
    201,
  )
}

async function createPairing(
  request: Request,
  ownerId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const admin = getAdminClient()
  const label = normalizeLabel(body.label)
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString()
  const cleanupResult = await admin.database
    .from('device_pairing_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('owner_id', ownerId)
    .is('consumed_at', null)
    .lte('expires_at', new Date().toISOString())

  if (cleanupResult.error) {
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'No se pudo preparar la vinculación del dispositivo.',
    )
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createPairingCode()
    const codeHash = await hashPairingValue(code, 'pairing-code')
    const { error } = await admin.database.from('device_pairing_codes').insert([
      {
        owner_id: ownerId,
        code_hash: codeHash,
        label,
        expires_at: expiresAt,
      },
    ])

    if (!error) {
      return jsonResponse(
        request,
        {
          pairing_code: code,
          expires_at: expiresAt,
          message: 'El código vence en 10 minutos y solo puede usarse una vez.',
        },
        201,
      )
    }

    const message = getUnknownErrorMessage(error).toLowerCase()
    const isUniqueError = message.includes('duplicate') || message.includes('unique')
    if (!isUniqueError || attempt === 4) {
      throw new RequestError(
        503,
        'BACKEND_UNAVAILABLE',
        'No se pudo generar el código de emparejamiento.',
      )
    }
  }

  throw new RequestError(
    503,
    'BACKEND_UNAVAILABLE',
    'No se pudo generar el código de emparejamiento.',
  )
}

async function enforcePairingRateLimit(
  request: Request,
  admin: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const rateKeyHash = await hashPairingValue(getClientAddress(request), 'pairing-rate')
  const { data, error } = await admin.database.rpc('consume_device_pairing_attempt', {
    p_limit: PAIRING_RATE_LIMIT,
    p_rate_key_hash: rateKeyHash,
    p_window_seconds: PAIRING_RATE_WINDOW_SECONDS,
  })

  if (error) {
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'La vinculación de dispositivos no está disponible.',
    )
  }

  const allowed = Array.isArray(data) ? data[0] : data
  if (allowed !== true) {
    throw new RequestError(
      429,
      'RATE_LIMITED',
      'Se alcanzó el límite temporal de intentos. Espera un minuto e inténtalo nuevamente.',
    )
  }
}

async function pairDevice(
  request: Request,
  body: Record<string, unknown>,
): Promise<Response> {
  const code = normalizePairingCode(body.code)
  const admin = getAdminClient()
  await enforcePairingRateLimit(request, admin)

  const token = createDeviceToken()
  const [codeHash, tokenHash] = await Promise.all([
    hashPairingValue(code, 'pairing-code'),
    hashToken(token),
  ])
  const { data: pairing, error: lookupError } = await admin.database
    .from('device_pairing_codes')
    .select('id')
    .eq('code_hash', codeHash)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (lookupError) {
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'La vinculación de dispositivos no está disponible.',
    )
  }

  if (!pairing) {
    throw new RequestError(
      401,
      'PAIRING_CODE_INVALID',
      'El código de emparejamiento no es válido o ya venció.',
    )
  }

  const { data, error } = await admin.database.rpc('redeem_device_pairing_code', {
    p_code_hash: codeHash,
    p_token_hash: tokenHash,
  })

  if (error) {
    if (getUnknownStatusCode(error) === 400) {
      throw new RequestError(
        401,
        'PAIRING_CODE_INVALID',
        'El código de emparejamiento no es válido o ya venció.',
      )
    }

    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'La vinculación de dispositivos no está disponible.',
    )
  }

  const record = (Array.isArray(data) ? data[0] : data) as
    Record<string, unknown> | undefined

  if (!record) {
    throw new RequestError(
      401,
      'PAIRING_CODE_INVALID',
      'El código de emparejamiento no es válido o ya venció.',
    )
  }

  return jsonResponse(
    request,
    {
      token,
      token_metadata: record,
      message: 'Dispositivo vinculado. El token quedó guardado en KOReader.',
    },
    201,
  )
}

async function getOwnedToken(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  tokenId: string,
): Promise<Record<string, unknown>> {
  if (!/^[0-9a-f-]{36}$/i.test(tokenId)) {
    throw new RequestError(
      400,
      'INVALID_REQUEST',
      'El identificador del dispositivo no es válido.',
    )
  }

  const { data, error } = await admin.database
    .from('device_tokens')
    .select(TOKEN_COLUMNS)
    .eq('id', tokenId)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (error) {
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'No se pudo cargar el dispositivo.',
    )
  }

  if (!data) {
    throw new RequestError(404, 'NOT_FOUND', 'No se encontró el dispositivo.')
  }

  return data as Record<string, unknown>
}

async function revokeToken(
  request: Request,
  ownerId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const tokenId = body.token_id

  if (typeof tokenId !== 'string') {
    throw new RequestError(
      400,
      'INVALID_REQUEST',
      'El identificador del dispositivo es obligatorio.',
    )
  }

  const admin = getAdminClient()
  await getOwnedToken(admin, ownerId, tokenId)
  const { error } = await admin.database
    .from('device_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('owner_id', ownerId)

  if (error) {
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'No se pudo revocar el token del dispositivo.',
    )
  }

  return jsonResponse(
    request,
    { message: 'El token del dispositivo fue revocado.' },
    200,
  )
}

async function regenerateToken(
  request: Request,
  ownerId: string,
  userClient: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<Response> {
  const tokenId = body.token_id

  if (typeof tokenId !== 'string') {
    throw new RequestError(
      400,
      'INVALID_REQUEST',
      'El identificador del dispositivo es obligatorio.',
    )
  }

  const admin = getAdminClient()
  const previous = await getOwnedToken(admin, ownerId, tokenId)
  const label = normalizeLabel(body.label ?? previous.label)
  const scopes = normalizeScopes(body.scopes ?? previous.scopes)

  const token = createDeviceToken()
  const tokenHash = await hashToken(token)
  const { data, error } = await userClient.database.rpc('rotate_device_token', {
    p_label: label,
    p_scopes: scopes,
    p_token_hash: tokenHash,
    p_token_id: tokenId,
  })

  if (error || !data) {
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'No se pudo regenerar el token del dispositivo.',
    )
  }

  const record = (Array.isArray(data) ? data[0] : data) as
    Record<string, unknown> | undefined

  if (!record) {
    throw new RequestError(
      503,
      'BACKEND_UNAVAILABLE',
      'No se pudo regenerar el token del dispositivo.',
    )
  }

  return jsonResponse(
    request,
    {
      token,
      token_metadata: record,
      message: 'El token anterior fue revocado. Copia este token ahora.',
    },
    201,
  )
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) })
  }

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

  const body = request.method === 'POST' ? await parseBody(request) : null

  if (body?.action === 'pair') {
    return pairDevice(request, body)
  }

  const { client: userClient, ownerId } = await getAuthenticatedUser(request)

  if (request.method === 'GET') {
    return listTokens(request, ownerId)
  }

  const action = body?.action ?? 'create'

  if (action === 'create') {
    return createToken(request, ownerId, body!)
  }

  if (action === 'create_pairing') {
    return createPairing(request, ownerId, body!)
  }

  if (action === 'revoke') {
    return revokeToken(request, ownerId, body!)
  }

  if (action === 'regenerate') {
    return regenerateToken(request, ownerId, userClient, body!)
  }

  return errorResponse(
    request,
    new RequestError(400, 'INVALID_REQUEST', 'La operación solicitada no es válida.'),
  )
}

export default async function handle(request: Request): Promise<Response> {
  try {
    return await handleRequest(request)
  } catch (error) {
    if (error instanceof RequestError) {
      return errorResponse(request, error)
    }

    return errorResponse(
      request,
      new RequestError(
        503,
        'BACKEND_UNAVAILABLE',
        'La gestión de dispositivos no está disponible.',
      ),
    )
  }
}
