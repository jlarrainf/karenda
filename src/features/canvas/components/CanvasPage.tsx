import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.tsx'
import { EmptyState } from '../../../components/ui/EmptyState.tsx'
import {
  applyCanvasReview,
  connectCanvas,
  disconnectCanvas,
  getCanvasConnection,
  listCandidateEvents,
  listCanvasCourseLinks,
  listCanvasReviews,
  listCanvasSyncRuns,
  synchronizeCanvas,
} from '../../../services/canvasService.ts'
import { listSubjects } from '../../../services/subjectService.ts'
import type { AcademicActivityType, CalendarEvent, Subject } from '../../../types/domain.ts'
import type {
  CanvasConnection,
  CanvasCourseLink,
  CanvasReviewItem,
  CanvasSyncRun,
} from '../../../types/canvas.ts'
import { appendUniqueCanvasText } from '../../../lib/canvas/reconciliation.ts'

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const activityLabels: Record<AcademicActivityType, string> = {
  assignment: 'Tarea',
  graded_discussion: 'Discusión evaluada',
  quiz: 'Quiz',
  oral_assessment: 'Interrogación oral',
  test: 'Control o prueba',
  exam: 'Examen',
  other: 'Otra actividad',
}

const reviewLabels: Record<CanvasReviewItem['reviewKind'], string> = {
  course_mapping: 'Vincular asignatura',
  event_create: 'Actividad nueva',
  event_update: 'Información de anuncio o página',
  conflict: 'Conflicto de cambios',
  source_removed: 'Elemento retirado de Canvas',
  undated: 'Sin fecha',
}

function formatDate(value: string | null): string {
  if (!value) return 'No disponible'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'No disponible' : dateFormatter.format(date)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function proposedEvent(review: CanvasReviewItem): Record<string, unknown> {
  const changes = object(review.proposedData.changes)
  const remote = object(review.proposedData.remote)
  return Object.keys(changes).length > 0 ? changes : Object.keys(remote).length > 0 ? remote : review.proposedData
}

function statusMeta(connection: CanvasConnection): { label: string; className: string } {
  if (connection.status === 'connected') return { label: 'Conectado', className: 'bg-success-soft text-success' }
  if (connection.status === 'expired') return { label: 'Requiere reconexión', className: 'bg-warning-soft text-warning' }
  if (connection.status === 'error') return { label: 'Con atención pendiente', className: 'bg-danger-soft text-danger' }
  return { label: 'Desconectado', className: 'bg-surface-strong text-ink-muted' }
}

function defaultExpiry(): string {
  const date = new Date(Date.now() + 89 * 86_400_000)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function fieldClassName() {
  return 'min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand-soft'
}

function CourseMappingCard({
  review,
  subjects,
  isBusy,
  onApply,
}: {
  review: CanvasReviewItem
  subjects: Subject[]
  isBusy: boolean
  onApply: (review: CanvasReviewItem, decision: 'link_existing' | 'create_subject' | 'ignore', eventId?: string, overrides?: Record<string, unknown>) => Promise<void>
}) {
  const proposal = review.proposedData
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const [name, setName] = useState(text(proposal.name) || review.title)
  const [code, setCode] = useState(text(proposal.code))
  const [abbreviation, setAbbreviation] = useState(text(proposal.abbreviation))
  const [color, setColor] = useState(text(proposal.color) || '#2F625A')

  return (
    <article className="rounded-panel border border-border bg-surface p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">Curso de Canvas</p>
      <h3 className="mt-2 text-lg font-bold text-ink">{review.title}</h3>
      {text(proposal.term_name) ? <p className="mt-1 text-sm text-ink-muted">{text(proposal.term_name)}</p> : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <fieldset className="space-y-3 rounded-control border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-ink">Vincular con una asignatura existente</legend>
          <label className="block text-sm font-medium text-ink-muted" htmlFor={`subject-${review.id}`}>
            Asignatura
          </label>
          <select className={fieldClassName()} id={`subject-${review.id}`} onChange={(event) => setSubjectId(event.target.value)} value={subjectId}>
            {subjects.length === 0 ? <option value="">No hay asignaturas creadas</option> : null}
            {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} · {subject.code}</option>)}
          </select>
          <Button disabled={!subjectId || isBusy} onClick={() => void onApply(review, 'link_existing', subjectId)} variant="secondary">
            Vincular con existente
          </Button>
        </fieldset>

        <fieldset className="space-y-3 rounded-control border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-ink">Crear una asignatura</legend>
          <label className="block text-sm text-ink-muted">Nombre<input className={`${fieldClassName()} mt-1`} maxLength={160} onChange={(event) => setName(event.target.value)} value={name} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-ink-muted">Código<input className={`${fieldClassName()} mt-1`} maxLength={40} onChange={(event) => setCode(event.target.value)} value={code} /></label>
            <label className="block text-sm text-ink-muted">Abreviación<input className={`${fieldClassName()} mt-1`} maxLength={40} onChange={(event) => setAbbreviation(event.target.value)} value={abbreviation} /></label>
          </div>
          <label className="flex items-center gap-3 text-sm text-ink-muted">Color<input aria-label="Color de la asignatura" className="size-11 rounded-control border border-border bg-surface p-1" onChange={(event) => setColor(event.target.value)} type="color" value={color} /></label>
          <Button disabled={!name.trim() || !code.trim() || !abbreviation.trim() || isBusy} onClick={() => void onApply(review, 'create_subject', undefined, { name, code, abbreviation, color })}>
            Crear y vincular
          </Button>
        </fieldset>
      </div>
      <div className="mt-4 flex justify-end"><Button disabled={isBusy} onClick={() => void onApply(review, 'ignore')} variant="ghost">Ignorar curso</Button></div>
    </article>
  )
}

function EventSummary({ event }: { event: CalendarEvent }) {
  return (
    <div className="rounded-control border border-border bg-surface-subtle p-3 text-sm">
      <p className="font-semibold text-ink">{event.title}</p>
      <p className="mt-1 text-ink-muted">{formatDate(event.startAt)}{event.location ? ` · ${event.location}` : ''}</p>
      {event.description ? <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-ink-muted">{event.description}</p> : null}
    </div>
  )
}

function ReviewCard({
  review,
  candidates,
  isBusy,
  onApply,
}: {
  review: CanvasReviewItem
  candidates: CalendarEvent[]
  isBusy: boolean
  onApply: (review: CanvasReviewItem, decision: 'link_existing' | 'create_event' | 'apply_update' | 'ignore', eventId?: string, overrides?: Record<string, unknown>) => Promise<void>
}) {
  const proposed = proposedEvent(review)
  const [eventId, setEventId] = useState(candidates[0]?.id ?? '')
  const [activityType, setActivityType] = useState<AcademicActivityType>(review.academicActivityType ?? 'other')
  const [manualStart, setManualStart] = useState('')
  const selected = candidates.find((candidate) => candidate.id === eventId)
  const proposedStart = text(proposed.start_at)
  const canCreate = Boolean(proposedStart || manualStart)
  const proposedDescription = text(proposed.description)
  const mergedDescription = selected && proposedDescription
    ? appendUniqueCanvasText(selected.description, proposedDescription)
    : proposedDescription
  const overrides: Record<string, unknown> = {
    academic_activity_type: activityType,
    ...(manualStart ? { start_at: new Date(manualStart).toISOString() } : {}),
    ...(review.reviewKind === 'event_update' && mergedDescription
      ? { description: mergedDescription }
      : {}),
  }

  return (
    <article className="rounded-panel border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">{reviewLabels[review.reviewKind]}</p>
          <h3 className="mt-2 text-lg font-bold text-ink">{review.title}</h3>
        </div>
        {review.sourceUrl ? <a className="text-sm font-semibold text-brand underline-offset-4 hover:underline" href={review.sourceUrl} rel="noreferrer" target="_blank">Abrir en Canvas</a> : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section aria-label="Información de Canvas" className="rounded-control border border-brand/25 bg-brand-soft p-4">
          <h4 className="font-semibold text-ink">Información de Canvas</h4>
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="font-medium text-ink-muted">Fecha propuesta</dt><dd className="text-ink">{formatDate(proposedStart || null)}</dd></div>
            <div><dt className="font-medium text-ink-muted">Lugar</dt><dd className="text-ink">{text(proposed.location) || 'No informado'}</dd></div>
            {review.sourceExcerpt ? <div><dt className="font-medium text-ink-muted">Extracto sanitizado</dt><dd className="mt-1 whitespace-pre-wrap break-words text-ink">{review.sourceExcerpt}</dd></div> : null}
          </dl>
        </section>
        <section aria-label="Evento de Karenda" className="rounded-control border border-border p-4">
          <h4 className="font-semibold text-ink">Posible evento en Karenda</h4>
          <label className="mt-3 block text-sm text-ink-muted" htmlFor={`candidate-${review.id}`}>Evento equivalente</label>
          <select className={`${fieldClassName()} mt-1`} id={`candidate-${review.id}`} onChange={(event) => setEventId(event.target.value)} value={eventId}>
            <option value="">Ninguno seleccionado</option>
            {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title} · {formatDate(candidate.startAt)}</option>)}
          </select>
          {selected ? <div className="mt-3"><EventSummary event={selected} /></div> : <p className="mt-3 text-sm text-ink-muted">No encontramos un candidato inequívoco. Revísalo antes de crear.</p>}
        </section>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink-muted" htmlFor={`category-${review.id}`}>
          Categoría confirmada
          <select className={`${fieldClassName()} mt-1`} id={`category-${review.id}`} onChange={(event) => setActivityType(event.target.value as AcademicActivityType)} value={activityType}>
            {Object.entries(activityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {!proposedStart ? (
          <label className="block text-sm font-medium text-ink-muted" htmlFor={`date-${review.id}`}>
            Fecha que debes confirmar
            <input className={`${fieldClassName()} mt-1`} id={`date-${review.id}`} onChange={(event) => setManualStart(event.target.value)} type="datetime-local" value={manualStart} />
          </label>
        ) : null}
      </div>

      {review.reviewKind === 'conflict' ? (
        <p className="mt-4 rounded-control border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
          Canvas y Karenda cambiaron desde la última sincronización. Se conservará lo local hasta que confirmes esta propuesta.
        </p>
      ) : null}
      {review.reviewKind === 'source_removed' ? (
        <p className="mt-4 rounded-control border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
          El evento se conservará en Karenda. Ignorar sólo cierra este aviso.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
        {eventId && review.reviewKind !== 'source_removed' ? (
          <Button disabled={isBusy} onClick={() => void onApply(review, review.reviewKind === 'event_create' || review.reviewKind === 'undated' ? 'link_existing' : 'apply_update', eventId, overrides)} variant="secondary">
            {review.reviewKind === 'event_create' || review.reviewKind === 'undated' ? 'Vincular con existente' : 'Aplicar al evento elegido'}
          </Button>
        ) : null}
        {(review.reviewKind === 'event_create' || review.reviewKind === 'undated') ? (
          <Button disabled={!canCreate || isBusy} onClick={() => void onApply(review, 'create_event', undefined, overrides)}>Crear evento</Button>
        ) : null}
        <Button disabled={isBusy} onClick={() => void onApply(review, 'ignore')} variant="ghost">Ignorar</Button>
      </div>
    </article>
  )
}

export function CanvasPage() {
  const [connection, setConnection] = useState<CanvasConnection | null>(null)
  const [courseLinks, setCourseLinks] = useState<CanvasCourseLink[]>([])
  const [reviews, setReviews] = useState<CanvasReviewItem[]>([])
  const [runs, setRuns] = useState<CanvasSyncRun[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [candidateEvents, setCandidateEvents] = useState<CalendarEvent[]>([])
  const [token, setToken] = useState('')
  const [expiry, setExpiry] = useState(defaultExpiry)
  const [isLoading, setIsLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [referenceTime] = useState(() => Date.now())

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextConnection, nextLinks, nextReviews, nextRuns, nextSubjects] = await Promise.all([
        getCanvasConnection(), listCanvasCourseLinks(), listCanvasReviews(), listCanvasSyncRuns(), listSubjects(),
      ])
      const ids = [...new Set(nextReviews.flatMap((review) => review.candidateEventIds))]
      const events = await listCandidateEvents(ids)
      setConnection(nextConnection)
      setCourseLinks(nextLinks)
      setReviews(nextReviews)
      setRuns(nextRuns)
      setSubjects(nextSubjects)
      setCandidateEvents(events)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar Canvas.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  const mappingReviews = reviews.filter((review) => review.reviewKind === 'course_mapping')
  const activityReviews = reviews.filter((review) => review.reviewKind !== 'course_mapping')
  const expirySoon = connection?.status === 'connected' && Date.parse(connection.tokenExpiresAt) - referenceTime <= 7 * 86_400_000
  const connectionMeta = connection ? statusMeta(connection) : null
  const eventsById = useMemo(() => new Map(candidateEvents.map((event) => [event.id, event])), [candidateEvents])

  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusyAction('connect')
    setError(null)
    setMessage(null)
    try {
      setConnection(await connectCanvas(token, new Date(expiry).toISOString()))
      setToken('')
      setMessage('Canvas quedó conectado. Ejecuta la primera sincronización para importar los cursos.')
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'No se pudo conectar Canvas.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleSync = async () => {
    setBusyAction('sync')
    setError(null)
    setMessage(null)
    try {
      const result = await synchronizeCanvas()
      setMessage(result.status === 'partial' ? 'La sincronización terminó con avisos. Revisa la bandeja.' : 'Canvas se sincronizó y la bandeja fue actualizada.')
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'No se pudo sincronizar Canvas.')
      await load()
    } finally {
      setBusyAction(null)
    }
  }

  const handleReview = async (
    review: CanvasReviewItem,
    decision: 'link_existing' | 'create_subject' | 'create_event' | 'apply_update' | 'ignore',
    eventId?: string,
    overrides: Record<string, unknown> = {},
  ) => {
    setBusyAction(review.id)
    setError(null)
    try {
      await applyCanvasReview(review.id, decision, eventId, overrides)
      setMessage('La decisión quedó aplicada.')
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'No se pudo aplicar la decisión.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleDisconnect = async () => {
    setBusyAction('disconnect')
    setError(null)
    try {
      setConnection(await disconnectCanvas())
      setDisconnectOpen(false)
      setMessage('Canvas fue desconectado. Se conservaron tus asignaturas, eventos y relaciones históricas.')
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'No se pudo desconectar Canvas.')
    } finally {
      setBusyAction(null)
    }
  }

  if (isLoading) return <p aria-live="polite" className="py-12 text-center text-sm text-ink-muted">Cargando conexión con Canvas…</p>

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-brand">Organización y conexiones</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Canvas</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
          Importa cursos y actividades desde Canvas UC. Karenda siempre te mostrará los eventos equivalentes antes de crear algo nuevo.
        </p>
      </header>

      {error ? <p className="rounded-control border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{error}</p> : null}
      {message ? <p aria-live="polite" className="rounded-control border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">{message}</p> : null}

      {!connection || connection.status !== 'connected' ? (
        <section aria-labelledby="canvas-connect-title" className="rounded-panel border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-xl font-bold text-ink" id="canvas-connect-title">{connection ? 'Volver a conectar Canvas' : 'Conectar Canvas UC'}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            Genera un token nuevo directamente en Canvas con el propósito “Karenda — sincronización personal”. El token se cifra al enviarlo y nunca vuelve a mostrarse.
          </p>
          <form className="mt-5 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)_auto] md:items-end" onSubmit={(event) => void handleConnect(event)}>
            <label className="block text-sm font-medium text-ink-muted" htmlFor="canvas-token">Token personal<input autoComplete="off" className={`${fieldClassName()} mt-1`} id="canvas-token" onChange={(event) => setToken(event.target.value)} required type="password" value={token} /></label>
            <label className="block text-sm font-medium text-ink-muted" htmlFor="canvas-expiry">Vencimiento informado por Canvas<input className={`${fieldClassName()} mt-1`} id="canvas-expiry" onChange={(event) => setExpiry(event.target.value)} required type="datetime-local" value={expiry} /></label>
            <Button isLoading={busyAction === 'connect'} loadingLabel="Validando…" type="submit">Conectar</Button>
          </form>
        </section>
      ) : null}

      {connection ? (
        <section aria-labelledby="canvas-status-title" className="rounded-panel border border-border bg-surface p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold text-ink" id="canvas-status-title">Estado de la conexión</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${connectionMeta?.className}`}>{connectionMeta?.label}</span>
              </div>
              <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="font-semibold text-ink-muted">Vencimiento</dt><dd className="mt-1 text-ink">{formatDate(connection.tokenExpiresAt)}</dd></div>
                <div><dt className="font-semibold text-ink-muted">Última sincronización</dt><dd className="mt-1 text-ink">{formatDate(connection.lastSyncAt)}</dd></div>
                <div><dt className="font-semibold text-ink-muted">Próxima ejecución</dt><dd className="mt-1 text-ink">{formatDate(connection.nextSyncAt)}</dd></div>
                <div><dt className="font-semibold text-ink-muted">Horario</dt><dd className="mt-1 text-ink">06:00 · Santiago</dd></div>
              </dl>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {connection.status === 'connected' ? <Button isLoading={busyAction === 'sync'} loadingLabel="Sincronizando…" onClick={() => void handleSync()}>Sincronizar ahora</Button> : null}
              <Button disabled={busyAction !== null} onClick={() => setDisconnectOpen(true)} variant="ghost">Desconectar</Button>
            </div>
          </div>
          {expirySoon ? <p className="mt-5 rounded-control border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">El token vence dentro de siete días. Reemplázalo antes de esa fecha para no interrumpir la sincronización.</p> : null}
          {connection.lastErrorMessage ? <p className="mt-5 text-sm text-danger">{connection.lastErrorMessage}</p> : null}
        </section>
      ) : null}

      <section aria-labelledby="canvas-courses-title" className="space-y-4">
        <div><h2 className="text-2xl font-bold text-ink" id="canvas-courses-title">Asignaturas de Canvas</h2><p className="mt-1 text-sm text-ink-muted">Cada curso debe vincularse antes de revisar sus actividades.</p></div>
        {mappingReviews.map((review) => <CourseMappingCard isBusy={busyAction !== null} key={review.id} onApply={handleReview} review={review} subjects={subjects} />)}
        {mappingReviews.length === 0 ? (
          <div className="rounded-panel border border-border bg-surface">
            <EmptyState description={courseLinks.length > 0 ? `${courseLinks.length} curso${courseLinks.length === 1 ? '' : 's'} vinculado${courseLinks.length === 1 ? '' : 's'} y sin decisiones pendientes.` : 'Sincroniza Canvas para encontrar y vincular tus cursos activos.'} title={courseLinks.length > 0 ? 'Asignaturas al día' : 'Aún no hay cursos importados'} />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="canvas-review-title" className="space-y-4">
        <div><h2 className="text-2xl font-bold text-ink" id="canvas-review-title">Bandeja de revisión</h2><p className="mt-1 text-sm text-ink-muted">Compara Canvas con Karenda y confirma cada decisión por separado.</p></div>
        {activityReviews.map((review) => (
          <ReviewCard candidates={review.candidateEventIds.map((id) => eventsById.get(id)).filter((event): event is CalendarEvent => Boolean(event))} isBusy={busyAction !== null} key={review.id} onApply={handleReview} review={review} />
        ))}
        {activityReviews.length === 0 ? <div className="rounded-panel border border-border bg-surface"><EmptyState description="No hay actividades, conflictos ni avisos pendientes de confirmación." title="Bandeja vacía" /></div> : null}
      </section>

      <section aria-labelledby="canvas-history-title" className="rounded-panel border border-border bg-surface">
        <div className="border-b border-border px-5 py-4 sm:px-6"><h2 className="text-lg font-bold text-ink" id="canvas-history-title">Historial reciente</h2></div>
        {runs.length === 0 ? <EmptyState description="Las ejecuciones manuales y programadas aparecerán aquí." title="Sin sincronizaciones" /> : (
          <ul className="divide-y divide-border">{runs.map((run) => <li className="flex flex-col gap-2 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6" key={run.id}><div><p className="font-semibold text-ink">{run.triggerType === 'manual' ? 'Sincronización manual' : 'Sincronización programada'}</p><p className="mt-1 text-ink-muted">{formatDate(run.startedAt)}{run.errorMessage ? ` · ${run.errorMessage}` : ''}</p></div><span className="font-semibold text-ink-muted">{run.status === 'completed' ? 'Completada' : run.status === 'partial' ? 'Con avisos' : run.status === 'running' ? 'En curso' : 'Fallida'}</span></li>)}</ul>
        )}
      </section>

      <ConfirmDialog confirmLabel="Desconectar Canvas" description="Se eliminará la credencial cifrada y se detendrán las sincronizaciones. Tus asignaturas, eventos y relaciones históricas se conservarán." error={null} isLoading={busyAction === 'disconnect'} onCancel={() => setDisconnectOpen(false)} onConfirm={handleDisconnect} open={disconnectOpen} title="¿Desconectar Canvas?" />
    </div>
  )
}
