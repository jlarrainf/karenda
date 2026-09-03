import { createAdminClient } from 'npm:@insforge/sdk'

const BASE_URL = Deno.env.get('INSFORGE_BASE_URL') ?? ''
const ADMIN_API_KEY = Deno.env.get('API_KEY') ?? ''
const DEFAULT_TIMEZONE = 'America/Santiago'
const SCHEMA_VERSION = 1
const MAX_JSON_BYTES = 1024 * 1024
const PAGE_SIZE = 500

const ALLOWED_ORIGINS = new Set([
  'https://5zz5dxgt.insforge.site',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

const SUBJECT_COLUMNS = 'id, name, code, abbreviation, color, updated_at'
const PERSONAL_GROUP_COLUMNS = 'id, name, color, updated_at'
const EVENT_COLUMNS =
  'id, kind, title, subject_id, personal_group_id, start_at, end_at, is_all_day, status, location, description, updated_at'
const NOTE_COLUMNS = 'id, target_type, target_id, title, content_markdown, updated_at'
const TOKEN_COLUMNS = 'id, owner_id, scopes, revoked_at, expires_at'

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  extraHeaders: Record<string, string> = {},
): Response {
  const headers = new Headers(getCorsHeaders(request))
  headers.set('Content-Type', 'application/json; charset=utf-8')

  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value)
  }

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
      'La sincronización no está disponible.',
    )
  }

  return createAdminClient({ baseUrl: BASE_URL, apiKey: ADMIN_API_KEY })
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

async function authenticateDevice(request: Request) {
  const token = getBearerToken(request)

  if (!token) {
    throw new RequestError(
      401,
      'UNAUTHORIZED',
      'El token del dispositivo no es válido.',
    )
  }

  const admin = getAdminClient()
  const tokenHash = await hashToken(token)
  const { data, error } = await admin.database
    .from('device_tokens')
    .select(TOKEN_COLUMNS)
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !data) {
    throw new RequestError(
      401,
      'UNAUTHORIZED',
      'El token del dispositivo no es válido.',
    )
  }

  const now = Date.now()
  const expiresAt =
    typeof data.expires_at === 'string' ? Date.parse(data.expires_at) : NaN

  if (data.revoked_at || (!Number.isNaN(expiresAt) && expiresAt <= now)) {
    throw new RequestError(
      401,
      'UNAUTHORIZED',
      'El token del dispositivo no es válido.',
    )
  }

  if (!Array.isArray(data.scopes) || !data.scopes.includes('read:snapshot')) {
    throw new RequestError(
      403,
      'INSUFFICIENT_SCOPE',
      'El dispositivo no tiene permiso para leer el calendario.',
    )
  }

  return { admin, ownerId: data.owner_id as string, tokenId: data.id as string }
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

function parseDateKey(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

function formatDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function shiftDateKey(value: string, days: number): string {
  const parsed = parseDateKey(value)

  if (!parsed) {
    throw new RequestError(400, 'INVALID_REQUEST', 'La ventana de fechas no es válida.')
  }

  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days))
  return formatDateKey(date)
}

interface SnapshotDateTimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

// InsForge deploys this handler as a single file, so timezone projection stays inline.
function getDateTimeParts(value: Date, timezone: string): SnapshotDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    month: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(value)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function getOffsetMinutes(value: Date, parts: SnapshotDateTimeParts): number {
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )

  return Math.round((localAsUtc - value.getTime()) / 60000)
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+'
  const absolute = Math.abs(offsetMinutes)
  const hours = Math.floor(absolute / 60)
  const minutes = absolute % 60

  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function formatInstantInTimeZone(value: unknown, timezone: string): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const parts = getDateTimeParts(date, timezone)
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0')
  const offset = formatOffset(getOffsetMinutes(date, parts))

  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}.${milliseconds}${offset}`
}

function getTodayKey(timezone: string): string {
  const parts = getDateTimeParts(new Date(), timezone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function getLocalMidnightUtc(dateKey: string, timezone: string): string {
  const parsed = parseDateKey(dateKey)

  if (!parsed) {
    throw new RequestError(400, 'INVALID_REQUEST', 'La ventana de fechas no es válida.')
  }

  const target = Date.UTC(parsed.year, parsed.month - 1, parsed.day)
  let guess = target

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const local = getDateTimeParts(new Date(guess), timezone)
    const localAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    )
    const nextGuess = guess + (target - localAsUtc)

    if (nextGuess === guess) {
      break
    }

    guess = nextGuess
  }

  return new Date(guess).toISOString()
}

function getUtcDateStart(dateKey: string): string {
  const parsed = parseDateKey(dateKey)

  if (!parsed) {
    throw new RequestError(400, 'INVALID_REQUEST', 'La ventana de fechas no es válida.')
  }

  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).toISOString()
}

function getRequestWindow(request: Request): {
  from: string
  to: string
  timezone: string
} {
  const url = new URL(request.url)
  const timezone = url.searchParams.get('timezone') || DEFAULT_TIMEZONE

  if (!isValidTimeZone(timezone)) {
    throw new RequestError(400, 'INVALID_REQUEST', 'La zona horaria no es válida.')
  }

  const today = getTodayKey(timezone)
  const from = url.searchParams.get('from') || shiftDateKey(today, -7)
  const to = url.searchParams.get('to') || shiftDateKey(today, 180)

  if (!parseDateKey(from) || !parseDateKey(to) || from >= to) {
    throw new RequestError(400, 'INVALID_REQUEST', 'La ventana de fechas no es válida.')
  }

  return { from, to, timezone }
}

async function fetchCatalogRows(
  admin: ReturnType<typeof createAdminClient>,
  table: 'subjects' | 'personal_groups',
  columns: string,
  ownerId: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  let offset = 0

  while (true) {
    const { data, error } = await admin.database
      .from(table)
      .select(columns)
      .eq('owner_id', ownerId)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      throw new RequestError(
        503,
        'BACKEND_UNAVAILABLE',
        'No se pudo cargar el catálogo.',
      )
    }

    const page = (data ?? []) as Record<string, unknown>[]
    rows.push(...page)

    if (page.length < PAGE_SIZE) {
      return rows
    }

    offset += PAGE_SIZE
  }
}

async function fetchEvents(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  window: { from: string; to: string; timezone: string },
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  const timedStartAt = getLocalMidnightUtc(window.from, window.timezone)
  const timedEndAt = getLocalMidnightUtc(window.to, window.timezone)
  const allDayStartAt = getUtcDateStart(window.from)
  const allDayEndAt = getUtcDateStart(window.to)
  let offset = 0

  while (true) {
    const { data, error } = await admin.database
      .from('events')
      .select(EVENT_COLUMNS)
      .eq('owner_id', ownerId)
      .or(
        `and(start_at.gte.${timedStartAt},start_at.lt.${timedEndAt},is_all_day.eq.false),and(start_at.lt.${timedEndAt},end_at.gt.${timedStartAt},is_all_day.eq.false),and(is_all_day.eq.true,start_at.lt.${allDayEndAt},end_at.gte.${allDayStartAt})`,
      )
      .order('start_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      throw new RequestError(
        503,
        'BACKEND_UNAVAILABLE',
        'No se pudieron cargar los eventos.',
      )
    }

    const page = (data ?? []) as Record<string, unknown>[]
    rows.push(...page)

    if (page.length < PAGE_SIZE) {
      return rows
    }

    offset += PAGE_SIZE
  }
}

async function fetchNotes(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  let offset = 0

  while (true) {
    const { data, error } = await admin.database
      .from('notes')
      .select(NOTE_COLUMNS)
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      throw new RequestError(
        503,
        'BACKEND_UNAVAILABLE',
        'No se pudieron cargar las notas.',
      )
    }

    const page = (data ?? []) as Record<string, unknown>[]
    rows.push(...page)

    if (page.length < PAGE_SIZE) {
      return rows
    }

    offset += PAGE_SIZE
  }
}

function normalizeInstant(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function mapSubject(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    abbreviation: row.abbreviation,
    color: row.color,
    updated_at: normalizeInstant(row.updated_at),
  }
}

function mapPersonalGroup(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    updated_at: normalizeInstant(row.updated_at),
  }
}

function mapEvent(
  row: Record<string, unknown>,
  timezone: string,
): Record<string, unknown> {
  const allDay = row.is_all_day === true
  const startAt = typeof row.start_at === 'string' ? row.start_at : ''
  const endAt = typeof row.end_at === 'string' ? row.end_at : null

  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    subject_id: row.subject_id ?? null,
    personal_group_id: row.personal_group_id ?? null,
    start_at: allDay
      ? startAt.slice(0, 10)
      : formatInstantInTimeZone(startAt, timezone),
    end_at: allDay
      ? endAt
        ? endAt.slice(0, 10)
        : null
      : formatInstantInTimeZone(endAt, timezone),
    all_day: allDay,
    status: row.status,
    location: row.location ?? null,
    description: row.description ?? null,
    updated_at: normalizeInstant(row.updated_at),
  }
}

function mapNote(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    target_type: row.target_type,
    target_id: row.target_id,
    title: row.title,
    content_markdown: row.content_markdown,
    updated_at: normalizeInstant(row.updated_at),
  }
}

function sortById(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): number {
  return String(left.id).localeCompare(String(right.id))
}

function buildStableSnapshot(
  window: { from: string; to: string; timezone: string },
  subjects: Record<string, unknown>[],
  personalGroups: Record<string, unknown>[],
  events: Record<string, unknown>[],
  notes: Record<string, unknown>[],
): Record<string, unknown> {
  const mappedSubjects = subjects.map(mapSubject)
  const mappedPersonalGroups = personalGroups.map(mapPersonalGroup)
  const mappedEvents = events.map((event) => mapEvent(event, window.timezone))
  const mappedNotes = notes.map(mapNote)
  const referencedSubjectIds = new Set<string>()
  const referencedPersonalGroupIds = new Set<string>()

  for (const event of mappedEvents) {
    if (typeof event.subject_id === 'string') {
      referencedSubjectIds.add(event.subject_id)
    }

    if (typeof event.personal_group_id === 'string') {
      referencedPersonalGroupIds.add(event.personal_group_id)
    }
  }

  for (const note of mappedNotes) {
    if (note.target_type === 'subject' && typeof note.target_id === 'string') {
      referencedSubjectIds.add(note.target_id)
    }

    if (note.target_type === 'personal_group' && typeof note.target_id === 'string') {
      referencedPersonalGroupIds.add(note.target_id)
    }
  }

  return {
    schema_version: SCHEMA_VERSION,
    timezone: window.timezone,
    window: { from: window.from, to: window.to },
    subjects: mappedSubjects
      .filter((subject) => referencedSubjectIds.has(String(subject.id)))
      .sort(sortById),
    personal_groups: mappedPersonalGroups
      .filter((group) => referencedPersonalGroupIds.has(String(group.id)))
      .sort(sortById),
    events: mappedEvents.sort((left, right) => {
      const startOrder = String(left.start_at).localeCompare(String(right.start_at))
      return startOrder || sortById(left, right)
    }),
    notes: mappedNotes.sort((left, right) => {
      const updatedOrder = String(right.updated_at).localeCompare(
        String(left.updated_at),
      )
      return updatedOrder || sortById(left, right)
    }),
  }
}

function getStableGeneratedAt(snapshot: Record<string, unknown>): string {
  const timestamps: string[] = []

  for (const collectionName of ['subjects', 'personal_groups', 'events', 'notes']) {
    const collection = snapshot[collectionName]

    if (!Array.isArray(collection)) {
      continue
    }

    for (const item of collection) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).updated_at === 'string'
      ) {
        timestamps.push((item as Record<string, unknown>).updated_at as string)
      }
    }
  }

  timestamps.sort()
  return timestamps[timestamps.length - 1] ?? '1970-01-01T00:00:00.000Z'
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) {
    return false
  }

  return header
    .split(',')
    .map((value) => value.trim())
    .some((value) => value === '*' || value === etag)
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) })
  }

  if (request.method !== 'GET') {
    return errorResponse(
      request,
      new RequestError(
        405,
        'METHOD_NOT_ALLOWED',
        'El método solicitado no está disponible.',
      ),
    )
  }

  const { admin, ownerId, tokenId } = await authenticateDevice(request)
  const window = getRequestWindow(request)
  const [subjects, personalGroups, events, notes] = await Promise.all([
    fetchCatalogRows(admin, 'subjects', SUBJECT_COLUMNS, ownerId),
    fetchCatalogRows(admin, 'personal_groups', PERSONAL_GROUP_COLUMNS, ownerId),
    fetchEvents(admin, ownerId, window),
    fetchNotes(admin, ownerId),
  ])

  const stableSnapshot = buildStableSnapshot(
    window,
    subjects,
    personalGroups,
    events,
    notes,
  )
  const stableJson = JSON.stringify(stableSnapshot)
  const stableHash = await sha256Hex(stableJson)
  const etag = `"${stableHash}"`
  const snapshot = {
    ...stableSnapshot,
    snapshot_id: stableHash,
    generated_at: getStableGeneratedAt(stableSnapshot),
  }
  const json = JSON.stringify(snapshot)
  const size = new TextEncoder().encode(json).byteLength

  if (size > MAX_JSON_BYTES) {
    return errorResponse(
      request,
      new RequestError(
        413,
        'SNAPSHOT_TOO_LARGE',
        'El snapshot supera el límite permitido de 1 MiB.',
      ),
    )
  }

  const lastUsedAt = new Date().toISOString()
  await admin.database
    .from('device_tokens')
    .update({ last_used_at: lastUsedAt })
    .eq('id', tokenId)
    .eq('owner_id', ownerId)

  if (matchesEtag(request.headers.get('If-None-Match'), etag)) {
    return jsonResponse(request, null, 304, {
      'Cache-Control': 'private, no-cache',
      ETag: etag,
    })
  }

  return jsonResponse(request, snapshot, 200, {
    ETag: etag,
    'Cache-Control': 'private, no-cache',
  })
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
        'La sincronización no está disponible.',
      ),
    )
  }
}
