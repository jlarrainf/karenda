import { useEffect, useState } from 'react'
import type { CalendarEvent, PersonalGroup, Subject } from '../../../types/domain.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.tsx'
import { getCanvasEventSource } from '../../../services/canvasService.ts'
import type { CanvasEventSource } from '../../../types/canvas.ts'

interface EventDetailProps {
  accentColor: string
  event: CalendarEvent
  isLoading?: boolean
  onClose: () => void
  onDelete?: (event: CalendarEvent) => Promise<void>
  onEdit?: (event: CalendarEvent) => void
  onToggleStatus?: (event: CalendarEvent) => Promise<void>
  personalGroups: Pick<PersonalGroup, 'id' | 'name'>[]
  subjects: Pick<Subject, 'id' | 'name'>[]
}

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'long',
})
const dateTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const activityLabels = {
  assignment: 'Tarea',
  graded_discussion: 'Discusión evaluada',
  quiz: 'Quiz',
  oral_assessment: 'Interrogación oral',
  test: 'Control o prueba',
  exam: 'Examen',
  other: 'Otra actividad',
} as const

function formatLocalDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return dateFormatter.format(new Date(year, month - 1, day))
}

function formatDateTime(value: string): string {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function formatSchedule(event: CalendarEvent): string {
  if (event.isAllDay) {
    const start = formatLocalDate(event.startAt)
    const end = event.endAt ? ` a ${formatLocalDate(event.endAt)}` : ''

    return `${start}${end} · Todo el día`
  }

  const start = formatDateTime(event.startAt)
  const end = event.endAt ? ` a ${formatDateTime(event.endAt)}` : ''

  return `${start}${end}`
}

function getActionError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'No se pudo completar la acción. Inténtalo nuevamente.'
}

export function EventDetail({
  accentColor,
  event,
  isLoading = false,
  onClose,
  onDelete,
  onEdit,
  onToggleStatus,
  personalGroups,
  subjects,
}: EventDetailProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [canvasSourceState, setCanvasSourceState] = useState<{
    eventId: string
    source: CanvasEventSource | null
  } | null>(null)
  const isAcademic = event.kind === 'academic'
  const subjectName = subjects.find((subject) => subject.id === event.subjectId)?.name
  const groupName = personalGroups.find(
    (personalGroup) => personalGroup.id === event.personalGroupId,
  )?.name
  const statusLabel = event.status === 'completed' ? 'Completado' : 'Pendiente'
  const nextStatusLabel = event.status === 'completed' ? 'Pendiente' : 'Completado'
  const canvasSource = canvasSourceState?.eventId === event.id
    ? canvasSourceState.source
    : null

  useEffect(() => {
    let active = true
    void getCanvasEventSource(event.id)
      .then((source) => {
        if (active) setCanvasSourceState({ eventId: event.id, source })
      })
      .catch(() => {
        if (active) setCanvasSourceState({ eventId: event.id, source: null })
      })
    return () => {
      active = false
    }
  }, [event.id])

  const handleToggleStatus = async () => {
    if (!onToggleStatus) {
      return
    }

    setActionError(null)

    try {
      await onToggleStatus(event)
    } catch (error) {
      setActionError(getActionError(error))
    }
  }

  const handleDelete = async () => {
    if (!onDelete) {
      return
    }

    setActionError(null)

    try {
      await onDelete(event)
      setIsDeleteDialogOpen(false)
      onClose()
    } catch (error) {
      setActionError(getActionError(error))
    }
  }

  return (
    <>
      <aside
        aria-labelledby="event-detail-title"
        className="rounded-panel border border-border bg-surface p-5 sm:p-6"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-1.5 size-3 shrink-0 rounded-full ring-4 ring-surface-strong"
              style={{ backgroundColor: accentColor }}
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {isAcademic ? 'Evento académico' : 'Evento personal'}
              </p>
              <h2
                className="mt-1 break-words text-xl font-bold tracking-tight text-ink"
                id="event-detail-title"
              >
                {event.title}
              </h2>
            </div>
          </div>
          <Button
            aria-label="Cerrar detalle del evento"
            onClick={onClose}
            variant="ghost"
          >
            Cerrar
          </Button>
        </header>

        <dl className="space-y-4 py-5 text-sm">
          <div>
            <dt className="font-semibold text-ink-muted">
              {isAcademic ? 'Asignatura' : 'Grupo personal'}
            </dt>
            <dd className="mt-1 text-ink">
              {isAcademic
                ? (subjectName ?? 'Asignatura no disponible')
                : (groupName ?? 'Sin grupo personal')}
            </dd>
          </div>
          {isAcademic && event.academicActivityType ? (
            <div>
              <dt className="font-semibold text-ink-muted">Tipo de actividad</dt>
              <dd className="mt-1 text-ink">
                {activityLabels[event.academicActivityType]}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="font-semibold text-ink-muted">Cuándo</dt>
            <dd className="mt-1 text-ink">{formatSchedule(event)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-muted">Estado</dt>
            <dd className="mt-1">
              <span
                className={
                  event.status === 'completed'
                    ? 'inline-flex rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success'
                    : 'inline-flex rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning'
                }
              >
                {statusLabel}
              </span>
            </dd>
          </div>
          {event.location ? (
            <div>
              <dt className="font-semibold text-ink-muted">Lugar</dt>
              <dd className="mt-1 break-words text-ink">{event.location}</dd>
            </div>
          ) : null}
          {event.description ? (
            <div>
              <dt className="font-semibold text-ink-muted">Descripción</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words leading-6 text-ink">
                {event.description}
              </dd>
            </div>
          ) : null}
          {canvasSource ? (
            <div>
              <dt className="font-semibold text-ink-muted">Procedencia</dt>
              <dd className="mt-1 text-ink">
                Canvas UC
                {canvasSource.sourceUrl ? (
                  <>
                    {' · '}
                    <a
                      className="font-semibold text-brand underline-offset-4 hover:underline"
                      href={canvasSource.sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Abrir elemento original
                    </a>
                  </>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>

        {actionError ? (
          <p
            aria-live="assertive"
            className="mb-5 rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-sm leading-6 text-danger"
            role="alert"
          >
            {actionError}
          </p>
        ) : null}

        {onToggleStatus || onEdit || onDelete ? (
          <div className="flex flex-col gap-3 border-t border-border pt-5">
            {onToggleStatus ? (
              <Button
                disabled={isLoading}
                onClick={() => void handleToggleStatus()}
                variant="secondary"
              >
                Marcar como {nextStatusLabel.toLowerCase()}
              </Button>
            ) : null}
            {onEdit ? (
              <Button
                disabled={isLoading}
                onClick={() => {
                  onEdit(event)
                  onClose()
                }}
                variant="ghost"
              >
                Editar evento
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                disabled={isLoading}
                onClick={() => {
                  setActionError(null)
                  setIsDeleteDialogOpen(true)
                }}
                variant="danger"
              >
                Eliminar evento
              </Button>
            ) : null}
          </div>
        ) : null}
      </aside>

      {onDelete ? (
        <ConfirmDialog
          confirmLabel="Eliminar evento"
          description="Esta acción eliminará únicamente este evento y no se puede deshacer."
          error={actionError}
          isLoading={isLoading}
          onCancel={() => setIsDeleteDialogOpen(false)}
          onConfirm={handleDelete}
          open={isDeleteDialogOpen}
          title={`¿Eliminar ${event.title}?`}
        />
      ) : null}
    </>
  )
}
