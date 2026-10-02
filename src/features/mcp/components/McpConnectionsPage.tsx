import { useCallback, useEffect, useState } from 'react'
import { getCurrentAccessToken } from '../../../lib/insforge/client.ts'

interface McpGrant {
  id: string
  clientName: string
  scopes: string[]
  grantedAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

const scopeLabels: Record<string, string> = {
  'profile:read': 'Contexto de cuenta',
  'events:read': 'Leer eventos',
  'events:write': 'Crear y editar eventos',
  'events:delete': 'Eliminar eventos',
  'notes:read': 'Leer notas',
  'notes:write': 'Crear y editar notas',
  'notes:delete': 'Eliminar notas',
  'habits:read': 'Leer hábitos',
  'habits:write': 'Modificar hábitos',
  'habits:delete': 'Eliminar registros y notas de hábitos',
  'recurring:read': 'Leer tareas recurrentes',
  'recurring:write': 'Modificar tareas recurrentes',
  'catalogs:read': 'Leer asignaturas y grupos',
  'catalogs:write': 'Modificar asignaturas y grupos',
  'catalogs:delete': 'Eliminar asignaturas y grupos',
  'canvas:read': 'Leer estado de Canvas',
  'canvas:sync': 'Solicitar sincronización de Canvas',
  'canvas:review': 'Revisar propuestas de Canvas',
  'ai:draft': 'Solicitar borradores con IA',
}

function getMcpBaseUrl(): string | null {
  const configured = import.meta.env.VITE_KARENDA_MCP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  const baseUrl = import.meta.env.VITE_INSFORGE_URL?.trim()
  if (!baseUrl) return null
  try {
    const appKey = new URL(baseUrl).hostname.split('.')[0]
    return `https://${appKey}.function2.insforge.app/karenda-mcp`
  } catch {
    return null
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'Todavía no se ha usado'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

async function authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = getCurrentAccessToken()
  if (!accessToken) throw new Error('La sesión de Karenda venció. Inicia sesión nuevamente.')
  return await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  })
}

async function readApiError(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null)
  if (typeof payload === 'object' && payload !== null && 'error_description' in payload && typeof payload.error_description === 'string') {
    return payload.error_description
  }
  return 'No se pudo completar la solicitud. Vuelve a intentarlo.'
}

export function McpConnectionsPage() {
  const baseUrl = getMcpBaseUrl()
  const [grants, setGrants] = useState<McpGrant[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(baseUrl))
  const [busyGrantId, setBusyGrantId] = useState<string | null>(null)
  const [confirmGrantId, setConfirmGrantId] = useState<string | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [error, setError] = useState<string | null>(baseUrl ? null : 'Karenda MCP no está configurado para este entorno.')
  const [notice, setNotice] = useState<string | null>(null)

  const loadGrants = useCallback(async () => {
    if (!baseUrl) {
      return
    }
    try {
      const response = await authorizedFetch(`${baseUrl}/oauth/grants`)
      setError(null)
      if (!response.ok) throw new Error(await readApiError(response))
      const payload = await response.json() as { grants?: McpGrant[] }
      setGrants(Array.isArray(payload.grants) ? payload.grants : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las conexiones MCP.')
    } finally {
      setIsLoading(false)
    }
  }, [baseUrl])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadGrants() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadGrants])

  const revoke = async (grantId?: string) => {
    if (!baseUrl) return
    setBusyGrantId(grantId ?? 'all')
    setError(null)
    setNotice(null)
    try {
      const response = await authorizedFetch(`${baseUrl}/oauth/grants/revoke`, {
        method: 'POST',
        body: JSON.stringify(grantId ? { grant_id: grantId } : { revoke_all: true }),
      })
      if (!response.ok) throw new Error(await readApiError(response))
      const payload = await response.json() as { revoked_count?: number }
      setNotice(payload.revoked_count
        ? `Se revocó${payload.revoked_count === 1 ? '' : 'n'} ${payload.revoked_count} conexión${payload.revoked_count === 1 ? '' : 'es'}.`
        : 'La conexión ya estaba revocada.')
      setConfirmGrantId(null)
      setConfirmAll(false)
      await loadGrants()
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'No se pudo revocar la conexión.')
    } finally {
      setBusyGrantId(null)
    }
  }

  const activeCount = grants.filter((grant) => !grant.revokedAt).length

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6" id="main-content">
      <section aria-labelledby="mcp-connections-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink" id="mcp-connections-title">Conexiones MCP</h1>
            <p className="mt-2 max-w-[68ch] text-sm leading-6 text-ink-muted">
              Revisa qué herramientas pueden acceder a Karenda y revoca su acceso cuando quieras.
            </p>
          </div>
          {activeCount > 0 && !confirmAll && (
            <button className="min-h-11 rounded-control border border-danger/50 px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft" onClick={() => setConfirmAll(true)} type="button">
              Revocar todas
            </button>
          )}
        </div>

        {confirmAll && (
          <div className="mt-5 border-y border-danger/40 bg-danger-soft px-4 py-4 sm:px-5" role="alert">
            <p className="font-semibold text-ink">¿Revocar todas las conexiones MCP?</p>
            <p className="mt-1 text-sm leading-5 text-ink-muted">Las herramientas dejarán de acceder a tu cuenta inmediatamente. Tendrás que autorizar cada una otra vez.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="min-h-11 rounded-control bg-danger px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft disabled:opacity-60" disabled={busyGrantId !== null} onClick={() => void revoke()} type="button">
                {busyGrantId === 'all' ? 'Revocando…' : 'Sí, revocar todas'}
              </button>
              <button className="min-h-11 rounded-control border border-border bg-surface px-4 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft" disabled={busyGrantId !== null} onClick={() => setConfirmAll(false)} type="button">Cancelar</button>
            </div>
          </div>
        )}

        {notice && <p aria-live="polite" className="mt-5 rounded-control bg-success-soft px-4 py-3 text-sm font-medium text-success">{notice}</p>}
        {error && <p aria-live="assertive" className="mt-5 rounded-control bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}

        {isLoading ? (
          <div aria-busy="true" aria-live="polite" className="mt-6 space-y-3">
            <div className="h-36 animate-pulse rounded-panel bg-surface-strong" />
            <div className="h-36 animate-pulse rounded-panel bg-surface-strong" />
          </div>
        ) : grants.length === 0 ? (
          <div className="mt-6 border-y border-border py-8">
            <h2 className="text-lg font-semibold text-ink">Todavía no hay conexiones MCP</h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">Cuando autorices un cliente compatible, aquí podrás revisar sus permisos y revocar el acceso.</p>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {grants.map((grant) => {
              const isRevoked = Boolean(grant.revokedAt)
              const isConfirming = confirmGrantId === grant.id
              const isBusy = busyGrantId === grant.id
              return (
                <li className="py-5 sm:py-6" key={grant.id}>
                  <article aria-labelledby={`mcp-client-${grant.id}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="break-words text-lg font-semibold text-ink" id={`mcp-client-${grant.id}`}>{grant.clientName}</h2>
                          <span className={isRevoked ? 'rounded-full bg-surface-strong px-2.5 py-1 text-xs font-semibold text-ink-muted' : 'rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success'}>
                            {isRevoked ? 'Revocada' : 'Activa'}
                          </span>
                        </div>
                        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                          <div><dt className="inline text-ink-subtle">Autorizada: </dt><dd className="inline text-ink-muted">{formatDate(grant.grantedAt)}</dd></div>
                          <div><dt className="inline text-ink-subtle">Último uso: </dt><dd className="inline text-ink-muted">{formatDate(grant.lastUsedAt)}</dd></div>
                          {grant.revokedAt && <div><dt className="inline text-ink-subtle">Revocada: </dt><dd className="inline text-ink-muted">{formatDate(grant.revokedAt)}</dd></div>}
                        </dl>
                        <div className="mt-4">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Permisos concedidos</h3>
                          <ul className="mt-2 flex flex-wrap gap-2">
                            {grant.scopes.map((scope) => <li className="rounded-control bg-surface-subtle px-2.5 py-1.5 text-xs font-medium text-ink" key={scope}>{scopeLabels[scope] ?? scope}</li>)}
                          </ul>
                        </div>
                      </div>
                      {!isRevoked && !isConfirming && (
                        <button className="min-h-11 shrink-0 self-start rounded-control border border-danger/50 px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft" onClick={() => setConfirmGrantId(grant.id)} type="button">
                          Revocar acceso
                        </button>
                      )}
                    </div>

                    {isConfirming && (
                      <div className="mt-4 border-y border-danger/40 bg-danger-soft px-4 py-4" role="alert">
                        <p className="text-sm font-semibold text-ink">¿Revocar el acceso de {grant.clientName}?</p>
                        <p className="mt-1 text-sm leading-5 text-ink-muted">La herramienta dejará de acceder a Karenda inmediatamente. Puedes volver a autorizarla desde esa herramienta.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button className="min-h-11 rounded-control bg-danger px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft disabled:opacity-60" disabled={busyGrantId !== null} onClick={() => void revoke(grant.id)} type="button">
                            {isBusy ? 'Revocando…' : 'Sí, revocar acceso'}
                          </button>
                          <button className="min-h-11 rounded-control border border-border bg-surface px-4 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft" disabled={busyGrantId !== null} onClick={() => setConfirmGrantId(null)} type="button">Cancelar</button>
                        </div>
                      </div>
                    )}
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
