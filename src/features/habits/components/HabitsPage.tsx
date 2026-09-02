import { useEffect, useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.tsx'
import { EmptyState } from '../../../components/ui/EmptyState.tsx'
import { SelectField, TextField } from '../../../components/ui/FormField.tsx'
import { useCatalogStore } from '../../../stores/catalogStore.ts'
import {
  getNextDate,
  getPreviousDate,
  useHabitStore,
} from '../../../stores/habitStore.ts'
import type { HabitView } from '../../../stores/habitStore.ts'
import { useRecurringTaskStore } from '../../../stores/recurringTaskStore.ts'
import type {
  Habit,
  HabitOccurrenceResult,
  HabitStatistics,
  RecurringTask,
} from '../../../types/domain.ts'
import type {
  HabitInput as HabitFormInput,
  HabitLogInput,
  HabitRange,
  HabitScheduleVersionInput,
  RecurringTaskInput,
  RecurringTaskScheduleVersionInput,
} from '../../../services/habitValidation.ts'
import {
  describeSchedule,
  formatHabitGoal,
  formatHabitSummary,
} from '../utils/habitRecurrence.ts'
import { HabitForm } from './HabitForm.tsx'
import { HabitNotesPanel } from './HabitNotesPanel.tsx'
import { RecurringTaskForm } from './RecurringTaskForm.tsx'

const DATE_FORMATTER = new Intl.DateTimeFormat('es-CL', { dateStyle: 'full' })
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' })

const STATUS_LABELS: Record<HabitOccurrenceResult['status'], string> = {
  completed: 'Completado',
  missed: 'Incumplido',
  partial: 'Parcial',
  pending: 'Pendiente',
  skipped: 'Omitido',
}

const STATUS_STYLES: Record<HabitOccurrenceResult['status'], string> = {
  completed: 'bg-success-soft text-success',
  missed: 'bg-danger-soft text-danger',
  partial: 'bg-warning-soft text-warning',
  pending: 'bg-surface-strong text-ink-muted',
  skipped: 'bg-brand-soft text-brand',
}

type HabitStatusFilter = 'all' | HabitOccurrenceResult['status']
type HabitRelationFilter = 'all' | 'none' | 'subject' | 'personal_group'
type HabitTrackingFilter = 'all' | Habit['trackingType']

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(value: string): string {
  return DATE_FORMATTER.format(parseLocalDate(value))
}

function formatShortDate(value: string): string {
  return SHORT_DATE_FORMATTER.format(parseLocalDate(value))
}

function statusLabel(status: HabitOccurrenceResult['status']): string {
  return STATUS_LABELS[status]
}

function getTodayDate(): string {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

interface HabitRowProps {
  habit: Habit
  isSaving: boolean
  occurrence: HabitOccurrenceResult
  onArchive: () => void
  onEdit: () => void
  onLog: (input: HabitLogInput) => Promise<void>
  onNote: () => void
  onPause: () => void
  onScheduleChange: () => void
}

function HabitRow({
  habit,
  isSaving,
  occurrence,
  onArchive,
  onEdit,
  onLog,
  onNote,
  onPause,
  onScheduleChange,
}: HabitRowProps) {
  const [value, setValue] = useState(occurrence.value ? String(occurrence.value) : '')
  const isQuantitative = habit.trackingType !== 'boolean'
  const relation = habit.subjectId
    ? 'Asignatura relacionada'
    : habit.personalGroupId
      ? 'Grupo personal relacionado'
      : 'Sin relación'

  return (
    <li className="border-b border-border px-4 py-4 last:border-b-0 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: habit.color ?? '#5E6B65' }}
            />
            <h3 className="break-words font-semibold text-ink">{habit.name}</h3>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {relation} · Meta:{' '}
            {formatHabitGoal(habit.trackingType, occurrence.goalValue, habit.unit)}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[occurrence.status]}`}
        >
          {statusLabel(occurrence.status)}
        </span>
      </div>
      {isQuantitative ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <TextField
            id={`habit-value-${habit.id}`}
            label={`Avance en ${habit.unit ?? 'unidades'}`}
            min="0"
            onChange={(event) => setValue(event.target.value)}
            type="number"
            value={value}
          />
          <Button
            disabled={!value || Number(value) < 0 || isSaving}
            onClick={() =>
              void onLog({
                habitId: habit.id,
                localDate: occurrence.localDate,
                status: 'completed',
                value: Number(value),
                source: 'manual',
                externalId: null,
              })
            }
          >
            Registrar
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            disabled={isSaving}
            onClick={() =>
              void onLog({
                habitId: habit.id,
                localDate: occurrence.localDate,
                status: 'completed',
                value: 1,
                source: 'manual',
                externalId: null,
              })
            }
          >
            Completar
          </Button>
          <Button
            disabled={isSaving}
            onClick={() =>
              void onLog({
                habitId: habit.id,
                localDate: occurrence.localDate,
                status: 'skipped',
                value: 0,
                source: 'manual',
                externalId: null,
              })
            }
            variant="secondary"
          >
            Omitir
          </Button>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
        {habit.notePolicy !== 'none' ? (
          <button
            className="font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft"
            onClick={onNote}
            type="button"
          >
            Notas
          </button>
        ) : null}
        <button
          className="font-semibold text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft"
          onClick={onEdit}
          type="button"
        >
          Editar
        </button>
        <button
          className="font-semibold text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft"
          onClick={onScheduleChange}
          type="button"
        >
          Cambiar regla futura
        </button>
        <button
          className="font-semibold text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft"
          onClick={onPause}
          type="button"
        >
          {habit.lifecycleStatus === 'paused' ? 'Reanudar' : 'Pausar'}
        </button>
        <button
          className="font-semibold text-danger hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-danger-soft"
          onClick={onArchive}
          type="button"
        >
          Archivar
        </button>
      </div>
    </li>
  )
}

function TodayView({
  date,
  habits,
  isSaving,
  occurrences,
  search,
  onArchive,
  onEdit,
  onLog,
  onNote,
  onPause,
  onScheduleChange,
  statusFilter = 'all',
}: {
  date: string
  habits: Habit[]
  isSaving: boolean
  occurrences: HabitOccurrenceResult[]
  search: string
  onArchive: (habit: Habit) => void
  onEdit: (habit: Habit) => void
  onLog: (input: HabitLogInput) => Promise<void>
  onNote: (habit: Habit) => void
  onPause: (habit: Habit) => void
  onScheduleChange: (habit: Habit) => void
  statusFilter?: HabitStatusFilter
}) {
  const visibleHabits = habits.filter((habit) =>
    habit.name.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')),
  )
  const visibleOccurrences = occurrences.filter(
    (occurrence) =>
      visibleHabits.some((habit) => habit.id === occurrence.habitId) &&
      (statusFilter === 'all' || occurrence.status === statusFilter),
  )
  const groups = (['pending', 'partial', 'completed', 'skipped', 'missed'] as const)
    .map((status) => ({
      items: visibleOccurrences.filter((occurrence) => occurrence.status === status),
      status,
    }))
    .filter((group) => group.items.length > 0)

  if (habits.length === 0) {
    return (
      <EmptyState
        description="Crea tu primer hábito para comenzar a registrar avances."
        title="Todavía no tienes hábitos"
      />
    )
  }

  if (visibleOccurrences.length === 0) {
    return (
      <EmptyState
        description={`No hay hábitos programados para ${formatShortDate(date)} con este filtro.`}
        title="Sin hábitos para hoy"
      />
    )
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section
          aria-labelledby={`habit-status-${group.status}`}
          className="overflow-hidden rounded-panel border border-border bg-surface"
          key={group.status}
        >
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <h2 className="font-semibold text-ink" id={`habit-status-${group.status}`}>
              {statusLabel(group.status)}
            </h2>
          </div>
          <ul>
            {group.items.map((occurrence) => {
              const habit = visibleHabits.find((item) => item.id === occurrence.habitId)
              if (!habit) return null
              return (
                <HabitRow
                  habit={habit}
                  isSaving={isSaving}
                  key={occurrence.id}
                  occurrence={occurrence}
                  onArchive={() => onArchive(habit)}
                  onEdit={() => onEdit(habit)}
                  onLog={onLog}
                  onNote={() => onNote(habit)}
                  onPause={() => onPause(habit)}
                  onScheduleChange={() => onScheduleChange(habit)}
                />
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function HistoryView({
  habits,
  occurrences,
  range,
  onDateChange,
  onLog,
}: {
  habits: Habit[]
  occurrences: HabitOccurrenceResult[]
  range: HabitRange
  onDateChange: (field: 'startDate' | 'endDate', value: string) => void
  onLog: (input: HabitLogInput) => Promise<void>
}) {
  const dates: string[] = []
  for (
    let date = range.startDate;
    date <= range.endDate && dates.length < 31;
    date = getNextDate(date)
  )
    dates.push(date)
  const getResult = (habitId: string, date: string) =>
    occurrences.find(
      (occurrence) => occurrence.habitId === habitId && occurrence.localDate === date,
    )

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="history-start"
          label="Desde"
          onChange={(event) => onDateChange('startDate', event.target.value)}
          type="date"
          value={range.startDate}
        />
        <TextField
          id="history-end"
          label="Hasta"
          onChange={(event) => onDateChange('endDate', event.target.value)}
          type="date"
          value={range.endDate}
        />
      </div>
      <section
        aria-label="Historial de hábitos"
        className="overflow-x-auto rounded-panel border border-border bg-surface"
      >
        {habits.length === 0 ? (
          <EmptyState
            description="Crea un hábito para consultar su historial."
            title="Historial vacío"
          />
        ) : (
          <table className="min-w-[44rem] w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-subtle">
              <tr>
                <th className="px-4 py-3 font-semibold text-ink">Hábito</th>
                {dates.map((date) => (
                  <th
                    className="px-3 py-3 text-center font-semibold text-ink"
                    key={date}
                  >
                    {date.slice(8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {habits.map((habit) => (
                <tr key={habit.id}>
                  <th className="max-w-48 px-4 py-3 font-semibold text-ink">
                    {habit.name}
                  </th>
                  {dates.map((date) => {
                    const result = getResult(habit.id, date)
                    return (
                      <td className="px-2 py-2 text-center" key={date}>
                        {result ? (
                          <button
                            aria-label={`${habit.name}, ${date}: ${statusLabel(result.status)}`}
                            className={`min-h-11 min-w-11 rounded-control px-2 text-xs font-semibold ${STATUS_STYLES[result.status]} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft`}
                            onClick={() =>
                              void onLog({
                                habitId: habit.id,
                                localDate: date,
                                status:
                                  result.status === 'completed'
                                    ? 'skipped'
                                    : 'completed',
                                value:
                                  result.status === 'completed'
                                    ? 0
                                    : habit.trackingType === 'boolean'
                                      ? 1
                                      : habit.goalValue,
                                source: 'manual',
                                externalId: null,
                              })
                            }
                            type="button"
                          >
                            {statusLabel(result.status)}
                          </button>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function StatisticsView({
  habits,
  statistics,
  range,
  onDateChange,
}: {
  habits: Habit[]
  statistics: HabitStatistics[]
  range: HabitRange
  onDateChange: (field: 'startDate' | 'endDate', value: string) => void
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="stats-start"
          label="Desde"
          onChange={(event) => onDateChange('startDate', event.target.value)}
          type="date"
          value={range.startDate}
        />
        <TextField
          id="stats-end"
          label="Hasta"
          onChange={(event) => onDateChange('endDate', event.target.value)}
          type="date"
          value={range.endDate}
        />
      </div>
      {statistics.length === 0 ? (
        <EmptyState
          description="Activa las estadísticas en un hábito para ver su evolución."
          title="Estadísticas desactivadas"
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {statistics.map((stat) => {
            const habit = habits.find((item) => item.id === stat.habitId)
            if (!habit) return null
            return (
              <section
                className="rounded-panel border border-border bg-surface p-5"
                key={stat.habitId}
              >
                <h2 className="text-lg font-bold text-ink">{habit.name}</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {formatHabitSummary(habit)}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-ink-muted">Racha actual</dt>
                    <dd className="mt-1 text-xl font-bold text-ink">
                      {stat.currentStreak}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Mejor racha</dt>
                    <dd className="mt-1 text-xl font-bold text-ink">
                      {stat.bestStreak}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Cumplimiento</dt>
                    <dd className="mt-1 text-xl font-bold text-ink">
                      {stat.completionPercentage === null
                        ? '—'
                        : `${Math.round(stat.completionPercentage)}%`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Total</dt>
                    <dd className="mt-1 text-xl font-bold text-ink">
                      {stat.totalValue}
                    </dd>
                  </div>
                </dl>
                <p className="mt-5 text-sm text-ink-muted">
                  {stat.completedCount} completados · {stat.partialCount} parciales ·{' '}
                  {stat.skippedCount} omitidos · {stat.missedCount} incumplidos
                </p>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function taskIsOverdue(task: RecurringTask, today: string): boolean {
  return task.nextDueDate < today
}

function RecurringTasksView({
  personalGroups,
  subjects,
}: {
  personalGroups: Pick<{ id: string; name: string }, 'id' | 'name'>[]
  subjects: Pick<{ id: string; name: string }, 'id' | 'name'>[]
}) {
  const tasks = useRecurringTaskStore((state) => state.tasks)
  const taskOccurrences = useRecurringTaskStore((state) => state.occurrences)
  const isLoading = useRecurringTaskStore((state) => state.isLoading)
  const isSaving = useRecurringTaskStore((state) => state.isSaving)
  const error = useRecurringTaskStore((state) => state.error)
  const includeArchived = useRecurringTaskStore((state) => state.includeArchived)
  const load = useRecurringTaskStore((state) => state.load)
  const completeTask = useRecurringTaskStore((state) => state.completeTask)
  const rescheduleTask = useRecurringTaskStore((state) => state.rescheduleTask)
  const createTask = useRecurringTaskStore((state) => state.createTask)
  const updateTask = useRecurringTaskStore((state) => state.updateTask)
  const updateScheduleVersion = useRecurringTaskStore(
    (state) => state.updateScheduleVersion,
  )
  const updateLifecycle = useRecurringTaskStore((state) => state.updateLifecycle)
  const setIncludeArchived = useRecurringTaskStore((state) => state.setIncludeArchived)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<RecurringTask | null>(null)
  const [futureTask, setFutureTask] = useState<RecurringTask | null>(null)
  const [rescheduling, setRescheduling] = useState<string | null>(null)
  const [rescheduledDate, setRescheduledDate] = useState('')
  const [taskToArchive, setTaskToArchive] = useState<RecurringTask | null>(null)
  const today = getTodayDate()

  useEffect(() => {
    void load()
  }, [load])

  const saveTask = async (input: RecurringTaskInput) => {
    const saved = editingTask
      ? await updateTask(editingTask.id, input)
      : await createTask(input)
    if (saved) {
      setFormOpen(false)
      setEditingTask(null)
    }
  }
  const saveFutureTaskRule = async (input: RecurringTaskScheduleVersionInput) => {
    const saved = await updateScheduleVersion(input)
    if (saved) {
      setFormOpen(false)
      setFutureTask(null)
    }
  }
  const confirmArchiveTask = async () => {
    if (!taskToArchive) return
    const archived = await updateLifecycle(taskToArchive.id, 'archived')
    if (archived) setTaskToArchive(null)
  }

  if (formOpen)
    return (
      <RecurringTaskForm
        isLoading={isSaving}
        onCancel={() => {
          setFormOpen(false)
          setEditingTask(null)
          setFutureTask(null)
        }}
        onSubmit={saveTask}
        onSubmitFuture={saveFutureTaskRule}
        mode={futureTask ? 'future' : 'task'}
        personalGroups={personalGroups}
        subjects={subjects}
        task={futureTask ?? editingTask}
      />
    )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">
            Compromisos que permanecen pendientes o vencidos hasta gestionarlos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink">
            <input
              checked={includeArchived}
              className="size-4 accent-brand"
              onChange={(event) => {
                setIncludeArchived(event.target.checked)
                void load(true)
              }}
              type="checkbox"
            />
            Incluir archivadas
          </label>
          <Button
            onClick={() => {
              setEditingTask(null)
              setFutureTask(null)
              setFormOpen(true)
            }}
          >
            Nueva tarea
          </Button>
        </div>
      </div>
      {error ? (
        <p
          className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {isLoading && tasks.length === 0 ? (
        <p
          className="rounded-panel border border-border bg-surface px-5 py-8 text-sm text-ink-muted"
          role="status"
        >
          Cargando tareas recurrentes…
        </p>
      ) : null}
      {!isLoading && tasks.length === 0 ? (
        <EmptyState
          description="Crea una tarea que vuelva a aparecer cuando la necesites."
          title="No hay tareas recurrentes"
        />
      ) : null}
      {tasks.length > 0 ? (
        <div className="overflow-hidden rounded-panel border border-border bg-surface">
          <ul className="divide-y divide-border">
            {tasks.map((task) => {
              const overdue = taskIsOverdue(task, today)
              return (
                <li className="px-4 py-4 sm:px-5" key={task.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-ink">{task.title}</h2>
                      <p className="mt-1 text-sm text-ink-muted">
                        {describeSchedule(task.schedule)} · Próxima fecha:{' '}
                        {formatShortDate(task.nextDueDate)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${overdue ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`}
                    >
                      {overdue ? 'Vencida' : 'Pendiente'}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      disabled={isSaving}
                      onClick={() => void completeTask(task.id, task.nextDueDate)}
                    >
                      Completar
                    </Button>
                    <Button
                      disabled={isSaving}
                      onClick={() => {
                        setRescheduling(task.id)
                        setRescheduledDate(getNextDate(task.nextDueDate))
                      }}
                      variant="secondary"
                    >
                      Reprogramar
                    </Button>
                    <Button
                      disabled={isSaving}
                      onClick={() => {
                        setFutureTask(null)
                        setEditingTask(task)
                        setFormOpen(true)
                      }}
                      variant="ghost"
                    >
                      Editar
                    </Button>
                    <Button
                      disabled={isSaving}
                      onClick={() => setTaskToArchive(task)}
                      variant="ghost"
                    >
                      Archivar
                    </Button>
                    <Button
                      disabled={isSaving}
                      onClick={() => {
                        setEditingTask(null)
                        setFutureTask(task)
                        setFormOpen(true)
                      }}
                      variant="ghost"
                    >
                      Cambiar regla futura
                    </Button>
                  </div>
                  {rescheduling === task.id ? (
                    <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
                      <TextField
                        id={`reschedule-${task.id}`}
                        label="Nueva fecha"
                        onChange={(event) => setRescheduledDate(event.target.value)}
                        type="date"
                        value={rescheduledDate}
                      />
                      <Button
                        disabled={!rescheduledDate || isSaving}
                        onClick={() =>
                          void rescheduleTask(
                            task.id,
                            task.nextDueDate,
                            rescheduledDate,
                          )
                        }
                      >
                        Guardar fecha
                      </Button>
                      <Button onClick={() => setRescheduling(null)} variant="ghost">
                        Cancelar
                      </Button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
      {taskOccurrences.length > 0 ? (
        <section
          aria-labelledby="recurring-task-history-title"
          className="rounded-panel border border-border bg-surface"
        >
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <h2 className="font-semibold text-ink" id="recurring-task-history-title">
              Historial de tareas
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {taskOccurrences.slice(0, 30).map((occurrence) => {
              const task = tasks.find((item) => item.id === occurrence.recurringTaskId)
              return (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5"
                  key={occurrence.id}
                >
                  <span className="text-ink">
                    {task?.title ?? 'Tarea no disponible'} · {occurrence.dueDate}
                  </span>
                  <span className="font-semibold text-ink-muted">
                    {occurrence.status === 'completed'
                      ? 'Completada'
                      : `Reprogramada para ${occurrence.rescheduledTo ?? 'otra fecha'}`}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
      <ConfirmDialog
        confirmLabel="Archivar tarea"
        description="La tarea dejará de aparecer en la lista activa, pero conservará su historial."
        error={error}
        isLoading={isSaving}
        loadingLabel="Archivando…"
        onCancel={() => setTaskToArchive(null)}
        onConfirm={confirmArchiveTask}
        open={taskToArchive !== null}
        title={`¿Archivar ${taskToArchive?.title ?? 'esta tarea'}?`}
      />
    </div>
  )
}

export function HabitsPage() {
  const habits = useHabitStore((state) => state.habits)
  const occurrences = useHabitStore((state) => state.occurrences)
  const statistics = useHabitStore((state) => state.statistics)
  const range = useHabitStore((state) => state.range)
  const selectedDate = useHabitStore((state) => state.selectedDate)
  const view = useHabitStore((state) => state.view)
  const isLoaded = useHabitStore((state) => state.isLoaded)
  const isLoading = useHabitStore((state) => state.isLoading)
  const isSaving = useHabitStore((state) => state.isSaving)
  const error = useHabitStore((state) => state.error)
  const search = useHabitStore((state) => state.search)
  const includeArchived = useHabitStore((state) => state.includeArchived)
  const load = useHabitStore((state) => state.load)
  const loadRange = useHabitStore((state) => state.loadRange)
  const createHabit = useHabitStore((state) => state.createHabit)
  const updateHabit = useHabitStore((state) => state.updateHabit)
  const updateLifecycle = useHabitStore((state) => state.updateLifecycle)
  const updateScheduleVersion = useHabitStore((state) => state.updateScheduleVersion)
  const saveLog = useHabitStore((state) => state.saveLog)
  const setView = useHabitStore((state) => state.setView)
  const setRange = useHabitStore((state) => state.setRange)
  const setSearch = useHabitStore((state) => state.setSearch)
  const setIncludeArchived = useHabitStore((state) => state.setIncludeArchived)
  const clearError = useHabitStore((state) => state.clearError)
  const catalogLoaded = useCatalogStore((state) => state.isLoaded)
  const catalogError = useCatalogStore((state) => state.error)
  const subjects = useCatalogStore((state) => state.subjects)
  const personalGroups = useCatalogStore((state) => state.personalGroups)
  const loadCatalog = useCatalogStore((state) => state.load)
  const [formOpen, setFormOpen] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [futureHabit, setFutureHabit] = useState<Habit | null>(null)
  const [notesHabit, setNotesHabit] = useState<Habit | null>(null)
  const [habitToArchive, setHabitToArchive] = useState<Habit | null>(null)
  const [statusFilter, setStatusFilter] = useState<HabitStatusFilter>('all')
  const [relationFilter, setRelationFilter] = useState<HabitRelationFilter>('all')
  const [trackingFilter, setTrackingFilter] = useState<HabitTrackingFilter>('all')

  useEffect(() => {
    void loadCatalog()
    void load()
  }, [load, loadCatalog])

  useEffect(() => {
    if (view === 'history' && range.startDate === range.endDate) {
      void loadRange(
        { startDate: getPreviousDate(selectedDate), endDate: selectedDate },
        true,
      )
    }
    if (view === 'statistics' && range.startDate === range.endDate) {
      void loadRange(
        {
          startDate: getPreviousDate(getPreviousDate(selectedDate)),
          endDate: selectedDate,
        },
        true,
      )
    }
  }, [loadRange, range.endDate, range.startDate, selectedDate, view])

  const selectedOccurrenceDate = occurrences.filter(
    (occurrence) => occurrence.localDate === selectedDate,
  )
  const visibleHabits = habits.filter((habit) => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es')
    const relation = habit.subjectId
      ? 'subject'
      : habit.personalGroupId
        ? 'personal_group'
        : 'none'

    return (
      (!normalizedSearch ||
        habit.name.toLocaleLowerCase('es').includes(normalizedSearch)) &&
      (trackingFilter === 'all' || habit.trackingType === trackingFilter) &&
      (relationFilter === 'all' || relation === relationFilter)
    )
  })
  const currentDateLabel = formatDate(selectedDate)

  const navigateDate = (date: string) => {
    setRange({ startDate: date, endDate: date })
    void load(date, true)
  }
  const changeRange = (field: 'startDate' | 'endDate', value: string) => {
    const nextRange = { ...range, [field]: value }
    setRange(nextRange)
    if (value && nextRange.startDate <= nextRange.endDate)
      void loadRange(nextRange, true)
  }
  const toggleArchived = (nextValue: boolean) => {
    setIncludeArchived(nextValue)
    void load(selectedDate, true)
  }
  const saveHabit = async (input: HabitFormInput) => {
    const saved = editingHabit
      ? await updateHabit(editingHabit.id, input)
      : await createHabit(input)
    if (saved) {
      setFormOpen(false)
      setEditingHabit(null)
    }
  }
  const saveFutureRule = async (input: HabitScheduleVersionInput) => {
    const saved = await updateScheduleVersion(input)
    if (saved) {
      setFormOpen(false)
      setFutureHabit(null)
    }
  }
  const confirmArchiveHabit = async () => {
    if (!habitToArchive) return
    const archived = await updateLifecycle(habitToArchive.id, 'archived')
    if (archived) setHabitToArchive(null)
  }
  const saveHabitLog = async (input: HabitLogInput) => {
    await saveLog(input)
  }

  const title =
    view === 'today'
      ? 'Hoy'
      : view === 'history'
        ? 'Historial'
        : view === 'statistics'
          ? 'Estadísticas'
          : 'Tareas recurrentes'

  return (
    <section aria-labelledby="habits-page-title" className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand">
            Seguimiento personal
          </p>
          <h1
            className="mt-2 text-3xl font-bold tracking-tight text-ink"
            id="habits-page-title"
          >
            Hábitos
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            Registra tus avances, conserva tu historial y revisa tus objetivos con
            claridad.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              setEditingHabit(null)
              setFutureHabit(null)
              setFormOpen(true)
            }}
          >
            Nuevo hábito
          </Button>
        </div>
      </header>

      <nav
        aria-label="Vistas de hábitos"
        className="grid grid-cols-2 gap-2 rounded-panel border border-border bg-surface-subtle p-2 sm:grid-cols-4"
      >
        {(
          [
            ['today', 'Hoy'],
            ['history', 'Historial'],
            ['statistics', 'Estadísticas'],
            ['tasks', 'Tareas recurrentes'],
          ] as const
        ).map(([value, label]) => (
          <button
            aria-current={view === value ? 'page' : undefined}
            className={`min-h-11 rounded-control px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft ${view === value ? 'bg-brand text-surface' : 'text-ink-muted hover:bg-surface hover:text-ink'}`}
            key={value}
            onClick={() => setView(value as HabitView)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      {view !== 'tasks' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border bg-surface px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              aria-label="Día anterior"
              onClick={() => navigateDate(getPreviousDate(selectedDate))}
              variant="ghost"
            >
              Anterior
            </Button>
            <Button onClick={() => navigateDate(getTodayDate())} variant="secondary">
              Hoy
            </Button>
            <Button
              aria-label="Día siguiente"
              onClick={() => navigateDate(getNextDate(selectedDate))}
              variant="ghost"
            >
              Siguiente
            </Button>
          </div>
          <p className="text-sm font-semibold text-ink">
            {title}: {currentDateLabel}
          </p>
        </div>
      ) : null}
      {view !== 'tasks' ? (
        <div className="grid gap-4 rounded-panel border border-border bg-surface-subtle p-4 sm:grid-cols-2 xl:grid-cols-4">
          <TextField
            id="habit-search"
            label="Buscar hábito"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ej. lectura"
            value={search}
          />
          <SelectField
            id="habit-status-filter"
            label="Estado"
            onChange={(event) =>
              setStatusFilter(event.target.value as HabitStatusFilter)
            }
            value={statusFilter}
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="completed">Completado</option>
            <option value="partial">Parcial</option>
            <option value="skipped">Omitido</option>
            <option value="missed">Incumplido</option>
          </SelectField>
          <SelectField
            id="habit-tracking-filter"
            label="Tipo de seguimiento"
            onChange={(event) =>
              setTrackingFilter(event.target.value as HabitTrackingFilter)
            }
            value={trackingFilter}
          >
            <option value="all">Todos los tipos</option>
            <option value="boolean">Cumplimiento</option>
            <option value="count">Cantidad</option>
            <option value="duration">Duración</option>
          </SelectField>
          <SelectField
            id="habit-relation-filter"
            label="Relación"
            onChange={(event) =>
              setRelationFilter(event.target.value as HabitRelationFilter)
            }
            value={relationFilter}
          >
            <option value="all">Todas las relaciones</option>
            <option value="none">Sin relación</option>
            <option value="subject">Asignatura</option>
            <option value="personal_group">Grupo personal</option>
          </SelectField>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-ink sm:col-span-2 xl:col-span-4">
            <input
              checked={includeArchived}
              className="size-4 accent-brand"
              onChange={(event) => toggleArchived(event.target.checked)}
              type="checkbox"
            />
            Incluir hábitos archivados
          </label>
          {view === 'today' ? (
            <p className="text-sm text-ink-muted sm:col-span-2 xl:col-span-4">
              {selectedOccurrenceDate.length} programados para{' '}
              {formatShortDate(selectedDate)}
            </p>
          ) : null}
        </div>
      ) : null}
      {catalogError ? (
        <p
          className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {catalogError}
        </p>
      ) : null}
      {error ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          <span>{error}</span>
          <Button onClick={clearError} variant="ghost">
            Cerrar aviso
          </Button>
        </div>
      ) : null}
      {!catalogLoaded && !catalogError ? (
        <p className="text-sm text-ink-muted" role="status">
          Cargando relaciones…
        </p>
      ) : null}
      {isLoading && !isLoaded && view !== 'tasks' ? (
        <p
          className="rounded-panel border border-border bg-surface px-5 py-8 text-sm text-ink-muted"
          role="status"
        >
          Cargando hábitos…
        </p>
      ) : null}

      {formOpen ? (
        <HabitForm
          habit={futureHabit ?? editingHabit}
          isLoading={isSaving}
          mode={futureHabit ? 'future' : 'habit'}
          onCancel={() => {
            setFormOpen(false)
            setEditingHabit(null)
            setFutureHabit(null)
          }}
          onSubmit={saveHabit}
          onSubmitFuture={saveFutureRule}
          personalGroups={personalGroups}
          subjects={subjects}
        />
      ) : null}
      {!formOpen && view === 'today' ? (
        <TodayView
          date={selectedDate}
          habits={visibleHabits}
          isSaving={isSaving}
          occurrences={selectedOccurrenceDate}
          search=""
          statusFilter={statusFilter}
          onArchive={setHabitToArchive}
          onEdit={(habit) => {
            setFutureHabit(null)
            setEditingHabit(habit)
            setFormOpen(true)
          }}
          onLog={saveHabitLog}
          onNote={setNotesHabit}
          onPause={(habit) =>
            void updateLifecycle(
              habit.id,
              habit.lifecycleStatus === 'paused' ? 'active' : 'paused',
            )
          }
          onScheduleChange={(habit) => {
            setEditingHabit(null)
            setFutureHabit(habit)
            setFormOpen(true)
          }}
        />
      ) : null}
      {!formOpen && view === 'history' ? (
        <HistoryView
          habits={visibleHabits}
          occurrences={occurrences}
          range={range}
          onDateChange={changeRange}
          onLog={saveHabitLog}
        />
      ) : null}
      {!formOpen && view === 'statistics' ? (
        <StatisticsView
          habits={visibleHabits}
          range={range}
          statistics={statistics}
          onDateChange={changeRange}
        />
      ) : null}
      {!formOpen && view === 'tasks' ? (
        <RecurringTasksView personalGroups={personalGroups} subjects={subjects} />
      ) : null}
      {notesHabit ? (
        <HabitNotesPanel
          date={selectedDate}
          habit={notesHabit}
          onClose={() => setNotesHabit(null)}
        />
      ) : null}
      <ConfirmDialog
        confirmLabel="Archivar hábito"
        description="El hábito se ocultará de la lista activa, pero conservará sus registros, notas y estadísticas."
        error={error}
        isLoading={isSaving}
        loadingLabel="Archivando…"
        onCancel={() => setHabitToArchive(null)}
        onConfirm={confirmArchiveHabit}
        open={habitToArchive !== null}
        title={`¿Archivar ${habitToArchive?.name ?? 'este hábito'}?`}
      />
    </section>
  )
}
