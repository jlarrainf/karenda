import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button.tsx'
import type { CalendarDisplayItem } from '../../../types/domain.ts'

interface CalendarDisplayDetailProps {
  item: CalendarDisplayItem
  onClose: () => void
}

const sourceLabels: Record<CalendarDisplayItem['source'], string> = {
  event: 'Proyección',
  habit_occurrence: 'Hábito · solo lectura',
  recurring_task_occurrence: 'Tarea recurrente · solo lectura',
}

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'long',
})

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) return value
  return dateFormatter.format(new Date(year, month - 1, day))
}

export function CalendarDisplayDetail({ item, onClose }: CalendarDisplayDetailProps) {
  return (
    <aside
      aria-labelledby="calendar-display-detail-title"
      className="rounded-panel border border-border bg-surface p-5 sm:p-6"
    >
      <header className="flex items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-1.5 size-3 shrink-0 rounded-full ring-4 ring-surface-strong"
            style={{ backgroundColor: item.color }}
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {sourceLabels[item.source]}
            </p>
            <h2
              className="mt-1 break-words text-xl font-bold tracking-tight text-ink"
              id="calendar-display-detail-title"
            >
              {item.title}
            </h2>
          </div>
        </div>
        <Button aria-label="Cerrar detalle" onClick={onClose} variant="ghost">
          Cerrar
        </Button>
      </header>

      <dl className="space-y-4 py-5 text-sm">
        <div>
          <dt className="font-semibold text-ink-muted">Cuándo</dt>
          <dd className="mt-1 text-ink">{formatDate(item.startDate)} · Todo el día</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-muted">Estado</dt>
          <dd className="mt-1 text-ink">{item.statusLabel}</dd>
        </div>
        {item.description ? (
          <div>
            <dt className="font-semibold text-ink-muted">Descripción</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words leading-6 text-ink">
              {item.description}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="border-t border-border pt-5">
        <p className="text-sm leading-6 text-ink-muted">
          Esta proyección es informativa. Gestiona el hábito o la tarea desde Hábitos.
        </p>
        <Link
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-control bg-brand px-4 text-sm font-semibold text-surface transition-colors duration-state hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft"
          to="/habits"
        >
          Ir a Hábitos
        </Link>
      </div>
    </aside>
  )
}
