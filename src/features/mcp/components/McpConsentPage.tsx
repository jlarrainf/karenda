import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getCurrentAccessToken } from '../../../lib/insforge/client.ts'

interface ConsentRequest {
  request_id: string
  client_name: string
  redirect_host: string
  requested_scopes: string[]
  expires_at: string
}

interface ScopeDefinition {
  scope: string
  label: string
  description: string
  elevated?: boolean
}

const scopeDefinitions: ScopeDefinition[] = [
  { scope: 'profile:read', label: 'Contexto de cuenta', description: 'Idioma, zona horaria y hora actual para interpretar fechas.' },
  { scope: 'events:read', label: 'Leer eventos', description: 'Consultar el calendario y los detalles de sus eventos.' },
  { scope: 'events:write', label: 'Crear y editar eventos', description: 'Crear eventos, cambiar sus datos y marcarlos como completados o pendientes.', elevated: true },
  { scope: 'events:delete', label: 'Eliminar eventos', description: 'Borrar eventos permanentemente del calendario.', elevated: true },
  { scope: 'notes:read', label: 'Leer notas', description: 'Consultar el contenido de las notas vinculadas a asignaturas y grupos.' },
  { scope: 'notes:write', label: 'Crear y editar notas', description: 'Crear notas y modificar su título, contenido o relación.', elevated: true },
  { scope: 'notes:delete', label: 'Eliminar notas', description: 'Borrar notas permanentemente.', elevated: true },
  { scope: 'habits:read', label: 'Leer hábitos', description: 'Consultar hábitos, progreso, historial y notas.' },
  { scope: 'habits:write', label: 'Modificar hábitos', description: 'Crear, editar, pausar, reanudar y archivar hábitos; registrar progreso y notas.', elevated: true },
  { scope: 'habits:delete', label: 'Eliminar registros y notas', description: 'Borrar registros manuales o notas de hábitos.', elevated: true },
  { scope: 'recurring:read', label: 'Leer tareas recurrentes', description: 'Consultar tareas, próximas ocurrencias e historial.' },
  { scope: 'recurring:write', label: 'Modificar tareas recurrentes', description: 'Crear y editar tareas, cambiar su estado y reprogramar ocurrencias.', elevated: true },
  { scope: 'catalogs:read', label: 'Leer asignaturas y grupos', description: 'Consultar asignaturas y grupos personales.' },
  { scope: 'catalogs:write', label: 'Modificar asignaturas y grupos', description: 'Crear y editar asignaturas y grupos personales.', elevated: true },
  { scope: 'catalogs:delete', label: 'Eliminar asignaturas y grupos', description: 'Borrar elementos que no tengan datos asociados.', elevated: true },
  { scope: 'canvas:read', label: 'Leer estado de Canvas', description: 'Consultar estado de conexión, sincronizaciones y propuestas.' },
  { scope: 'canvas:sync', label: 'Solicitar sincronización de Canvas', description: 'Iniciar sincronización y guardar resultados en Karenda.', elevated: true },
  { scope: 'canvas:review', label: 'Revisar propuestas de Canvas', description: 'Aplicar, vincular o ignorar propuestas dentro de Karenda.', elevated: true },
  { scope: 'ai:draft', label: 'Solicitar borradores con IA', description: 'Preparar sugerencias para que usted decida si las guarda.', elevated: true },
]

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

function formatExpiry(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'No disponible'
    : new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

async function sendConsentRequest(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<{ redirect_url?: string }> {
  const accessToken = getCurrentAccessToken()
  if (!accessToken) {
    throw new Error('La sesión de Karenda venció. Inicia sesión nuevamente para continuar.')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const result: unknown = await response.json().catch(() => null)
  if (!response.ok || typeof result !== 'object' || result === null) {
    const description = typeof result === 'object' && result !== null && 'error_description' in result
      ? (result as { error_description?: unknown }).error_description
      : null
    throw new Error(typeof description === 'string'
      ? description
      : 'No se pudo completar la autorización. Vuelve a cargar la solicitud.')
  }
  return result as { redirect_url?: string }
}

export function McpConsentPage() {
  const [searchParams] = useSearchParams()
  const requestId = searchParams.get('request_id') ?? ''
  const baseUrl = getMcpBaseUrl()
  const [request, setRequest] = useState<ConsentRequest | null>(null)
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    async function loadConsentRequest() {
      if (!baseUrl || !/^[0-9a-f-]{36}$/i.test(requestId)) {
        setError('La solicitud de conexión no es válida o está incompleta.')
        setIsLoading(false)
        return
      }
      const accessToken = getCurrentAccessToken()
      if (!accessToken) {
        setError('La sesión de Karenda venció. Inicia sesión nuevamente para continuar.')
        setIsLoading(false)
        return
      }
      try {
        const response = await fetch(`${baseUrl}/oauth/consent?request_id=${encodeURIComponent(requestId)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        })
        const result: unknown = await response.json().catch(() => null)
        if (!response.ok || typeof result !== 'object' || result === null) {
          throw new Error('La solicitud venció o ya no está disponible. Vuelve a conectar desde tu herramienta MCP.')
        }
        const consent = result as ConsentRequest
        if (isActive) {
          setRequest(consent)
          setSelectedScopes(consent.requested_scopes.filter((scope) => {
            const definition = scopeDefinitions.find((item) => item.scope === scope)
            return definition !== undefined && !definition.elevated
          }))
        }
      } catch (loadError) {
        if (isActive) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la solicitud de conexión.')
      } finally {
        if (isActive) setIsLoading(false)
      }
    }
    void loadConsentRequest()
    return () => { isActive = false }
  }, [baseUrl, requestId])

  const requestedScopes = request?.requested_scopes ?? []
  const visibleScopes = scopeDefinitions.filter((definition) => requestedScopes.includes(definition.scope))
  const selectedVisibleScopeCount = visibleScopes.filter((definition) => selectedScopes.includes(definition.scope)).length
  const allVisibleScopesSelected = visibleScopes.length > 0 && selectedVisibleScopeCount === visibleScopes.length
  const hasSelectedScope = selectedVisibleScopeCount > 0

  const toggleScope = (scope: string) => {
    setSelectedScopes((current) => current.includes(scope)
      ? current.filter((item) => item !== scope)
      : [...current, scope])
  }

  const toggleAllScopes = () => {
    setSelectedScopes(allVisibleScopesSelected ? [] : visibleScopes.map((definition) => definition.scope))
  }

  const decide = async (decision: 'approve' | 'deny') => {
    if (!baseUrl || !request || isSubmitting) return
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await sendConsentRequest(`${baseUrl}/oauth/consent`, {
        request_id: request.request_id,
        decision,
        approved_scopes: decision === 'approve' ? selectedScopes : [],
      })
      if (!result.redirect_url) throw new Error('Karenda no entregó la dirección de retorno. Vuelve a intentar la conexión.')
      setRedirecting(true)
      window.location.assign(result.redirect_url)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo completar la autorización.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-[70vh] bg-canvas px-4 py-8 sm:px-6 sm:py-12" id="main-content">
      <section aria-labelledby="mcp-consent-title" className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3 text-sm font-semibold text-brand">
          <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path d="M12 3.5 19 6v5.1c0 4.4-2.8 7.5-7 9.4-4.2-1.9-7-5-7-9.4V6l7-2.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
            <path d="m9 12.2 2 2 4-4.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
          </svg>
          Karenda · Conexión segura
        </div>

        <div className="rounded-panel border border-border bg-surface p-5 shadow-overlay sm:p-8">
          <h1 className="text-2xl font-bold text-ink sm:text-3xl" id="mcp-consent-title">
            Autorizar una conexión MCP
          </h1>
          <p className="mt-3 max-w-[68ch] text-sm leading-6 text-ink-muted">
            Revisa qué podrá hacer esta herramienta con tu cuenta de Karenda. Puedes elegir permisos parciales y revocar la conexión desde Organización y conexiones.
          </p>

          {isLoading && (
            <div aria-busy="true" aria-live="polite" className="mt-8 space-y-4">
              <div className="h-20 animate-pulse rounded-control bg-surface-subtle" />
              <div className="h-44 animate-pulse rounded-control bg-surface-subtle" />
            </div>
          )}

          {!isLoading && error && (
            <div aria-live="assertive" className="mt-6 rounded-control border border-danger/40 bg-danger-soft p-4 text-sm text-danger">
              <p>{error}</p>
              <Link className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:ring-4 focus-visible:ring-brand-soft" to="/login">
                Iniciar sesión en Karenda
              </Link>
            </div>
          )}

          {!isLoading && request && (
            <>
              <dl className="mt-7 grid gap-4 border-y border-border py-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Aplicación solicitante</dt>
                  <dd className="mt-1 break-words text-base font-semibold text-ink">{request.client_name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Dirección de retorno</dt>
                  <dd className="mt-1 break-all font-mono text-sm text-ink">{request.redirect_host}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Sesión activa</dt>
                  <dd className="mt-1 text-sm text-ink">Tu cuenta de Karenda</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Solicitud válida hasta</dt>
                  <dd className="mt-1 text-sm text-ink">{formatExpiry(request.expires_at)}</dd>
                </div>
              </dl>

              <fieldset className="mt-7" disabled={isSubmitting || redirecting}>
                <legend className="text-lg font-semibold text-ink">Permisos solicitados</legend>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-ink-muted">Los permisos sensibles empiezan desactivados. Revisa las descripciones antes de concederlos.</p>
                  <button
                    aria-label={allVisibleScopesSelected ? 'Quitar selección de todos los permisos' : 'Seleccionar todos los permisos'}
                    className="min-h-11 shrink-0 self-start rounded-control border border-border bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
                    disabled={visibleScopes.length === 0}
                    onClick={toggleAllScopes}
                    type="button"
                  >
                    {allVisibleScopesSelected ? 'Quitar selección' : 'Seleccionar todos los permisos'}
                  </button>
                </div>
                <p aria-live="polite" className="mt-3 text-sm text-ink-muted">
                  {selectedVisibleScopeCount} de {visibleScopes.length} permisos seleccionados.
                </p>
                <div className="mt-4 divide-y divide-border border-y border-border">
                  {visibleScopes.map((definition) => {
                    const selected = selectedScopes.includes(definition.scope)
                    return (
                      <label className="flex min-h-16 cursor-pointer items-start gap-3 py-4 focus-within:outline-none" key={definition.scope}>
                        <input
                          checked={selected}
                          className="mt-1 h-5 w-5 shrink-0 rounded border-border text-brand accent-brand focus-visible:ring-4 focus-visible:ring-brand-soft"
                          onChange={() => toggleScope(definition.scope)}
                          type="checkbox"
                          value={definition.scope}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-ink">
                            {definition.label}
                            {definition.elevated && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">Permiso sensible</span>}
                          </span>
                          <span className="mt-1 block max-w-[68ch] text-sm leading-5 text-ink-muted">{definition.description}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                {!hasSelectedScope && <p className="mt-3 text-sm text-danger">Selecciona al menos un permiso para autorizar la conexión.</p>}
              </fieldset>

              <p className="mt-5 text-sm leading-6 text-ink-muted">
                Puedes revocar el acceso en cualquier momento. La herramienta no recibirá tu contraseña ni los tokens de sesión de Karenda.
              </p>

              {error && <p aria-live="assertive" className="mt-4 rounded-control bg-danger-soft p-3 text-sm text-danger">{error}</p>}
              {redirecting && <p aria-live="polite" className="mt-4 text-sm font-semibold text-brand">Abriendo la herramienta MCP…</p>}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  className="min-h-11 rounded-control border border-border bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSubmitting || redirecting}
                  onClick={() => void decide('deny')}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="min-h-11 rounded-control bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!hasSelectedScope || isSubmitting || redirecting}
                  onClick={() => void decide('approve')}
                  type="button"
                >
                  {isSubmitting ? 'Guardando permiso…' : 'Autorizar Karenda'}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
