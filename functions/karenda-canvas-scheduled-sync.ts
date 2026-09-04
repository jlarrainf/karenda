import { createAdminClient } from 'npm:@insforge/sdk'

const BASE_URL = Deno.env.get('INSFORGE_BASE_URL') ?? ''
const ADMIN_API_KEY = Deno.env.get('API_KEY') ?? ''
const SCHEDULE_SECRET = Deno.env.get('CANVAS_SCHEDULE_SECRET') ?? ''
const PILOT_OWNER_IDS = new Set(
  (Deno.env.get('CANVAS_PILOT_OWNER_IDS') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
)

function json(value: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function authorized(request: Request): boolean {
  const bearer = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  const internal = request.headers.get('X-Karenda-Schedule-Secret')?.trim()
  return Boolean(SCHEDULE_SECRET && (bearer === SCHEDULE_SECRET || internal === SCHEDULE_SECRET))
}

export default async function main(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error_code: 'METHOD_NOT_ALLOWED', message: 'El método solicitado no está disponible.' }, 405)
  if (!authorized(request)) return json({ error_code: 'UNAUTHORIZED', message: 'La ejecución programada no está autorizada.' }, 401)
  if (!BASE_URL || !ADMIN_API_KEY || !SCHEDULE_SECRET) return json({ error_code: 'BACKEND_UNAVAILABLE', message: 'La sincronización programada no está disponible.' }, 503)

  const admin = createAdminClient({ baseUrl: BASE_URL, apiKey: ADMIN_API_KEY })
  const now = new Date().toISOString()
  const { data, error } = await admin.database.from('canvas_connections')
    .select('id, owner_id').in('status', ['connected', 'error']).lte('next_sync_at', now).order('next_sync_at', { ascending: true }).limit(20)
  if (error) return json({ error_code: 'BACKEND_UNAVAILABLE', message: 'No se pudieron consultar las conexiones programadas.' }, 503)

  let started = 0
  let failed = 0
  for (const connection of (data ?? []) as Array<{ id: string; owner_id: string }>) {
    if (!PILOT_OWNER_IDS.has(connection.owner_id)) continue
    try {
      const result = await fetch(`${BASE_URL}/functions/karenda-canvas-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Karenda-Schedule-Secret': SCHEDULE_SECRET },
        body: JSON.stringify({ connectionId: connection.id }),
      })
      if (result.ok || result.status === 409) started += 1
      else failed += 1
    } catch {
      failed += 1
    }
  }

  return json({ due: (data ?? []).length, started, failed })
}
