import { useState } from 'react'
import type { PersonalGroup, RecurringTask, Subject } from '../../../types/domain.ts'
import { Button } from '../../../components/ui/Button.tsx'
import {
  ColorField,
  SelectField,
  TextAreaField,
  TextField,
} from '../../../components/ui/FormField.tsx'
import { getLocalDateKey, shiftDateKey } from '../../../lib/dates/dateUtils.ts'
import {
  recurringTaskInputSchema,
  recurringTaskScheduleVersionInputSchema,
  type RecurringTaskInput,
  type RecurringTaskScheduleVersionInput,
} from '../../../services/habitValidation.ts'
import { describeSchedule } from '../utils/habitRecurrence.ts'

interface RecurringTaskFormProps {
  task?: RecurringTask | null
  isLoading: boolean
  personalGroups: Pick<PersonalGroup, 'id' | 'name'>[]
  subjects: Pick<Subject, 'id' | 'name'>[]
  onCancel: () => void
  onSubmit: (input: RecurringTaskInput) => Promise<void>
  onSubmitFuture?: (input: RecurringTaskScheduleVersionInput) => Promise<void>
  mode?: 'task' | 'future'
}

type FrequencyPreset = 'daily' | 'selected' | 'weekly' | 'monthly' | 'every-n-days'

const WEEKDAYS = [
  [1, 'Lunes'],
  [2, 'Martes'],
  [3, 'Miércoles'],
  [4, 'Jueves'],
  [5, 'Viernes'],
  [6, 'Sábado'],
  [7, 'Domingo'],
] as const

function defaultInput(task?: RecurringTask | null): RecurringTaskInput {
  if (task) {
    return {
      calendarEnabled: task.calendarEnabled,
      color: task.color,
      description: task.description,
      dueTime: task.dueTime,
      durationMinutes: task.durationMinutes,
      endDate: task.endDate,
      nextDueDate: task.nextDueDate,
      personalGroupId: task.personalGroupId,
      schedule: task.schedule,
      startDate: task.startDate,
      status: task.status,
      subjectId: task.subjectId,
      title: task.title,
    }
  }

  const today = getLocalDateKey(new Date().toISOString())
  return {
    calendarEnabled: false,
    color: null,
    description: null,
    dueTime: null,
    durationMinutes: null,
    endDate: null,
    nextDueDate: today,
    personalGroupId: null,
    schedule: {
      anchorDate: null,
      dayOfMonth: null,
      interval: 1,
      unit: 'day',
      weekdays: [],
    },
    startDate: today,
    status: 'active',
    subjectId: null,
    title: '',
  }
}

function getPreset(input: RecurringTaskInput): FrequencyPreset {
  if (input.schedule.unit === 'month') return 'monthly'
  if (input.schedule.unit === 'week') {
    return (input.schedule.weekdays ?? []).length === 1 ? 'weekly' : 'selected'
  }
  return input.schedule.interval === 1 ? 'daily' : 'every-n-days'
}

function getFieldErrors(input: RecurringTaskInput): Record<string, string> {
  const result = recurringTaskInputSchema.safeParse(input)
  if (result.success) return {}
  return result.error.issues.reduce<Record<string, string>>((errors, issue) => {
    const field = issue.path[0]
    if (typeof field === 'string' && !errors[field]) errors[field] = issue.message
    return errors
  }, {})
}

function getVersionFieldErrors(
  input: RecurringTaskScheduleVersionInput,
): Record<string, string> {
  const result = recurringTaskScheduleVersionInputSchema.safeParse(input)
  if (result.success) return {}
  return result.error.issues.reduce<Record<string, string>>((errors, issue) => {
    const field = issue.path[0]
    if (typeof field === 'string' && !errors[field]) errors[field] = issue.message
    return errors
  }, {})
}

export function RecurringTaskForm({
  task,
  isLoading,
  personalGroups,
  subjects,
  onCancel,
  onSubmit,
  onSubmitFuture,
  mode = 'task',
}: RecurringTaskFormProps) {
  const [draft, setDraft] = useState<RecurringTaskInput>(() => defaultInput(task))
  const [frequencyPreset, setFrequencyPreset] = useState<FrequencyPreset>(() =>
    getPreset(defaultInput(task)),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const minimumFutureDate = (() => {
    const tomorrow = shiftDateKey(getLocalDateKey(new Date().toISOString()), 1)
    return task?.startDate && task.startDate > tomorrow ? task.startDate : tomorrow
  })()
  const [effectiveFrom, setEffectiveFrom] = useState(() => {
    return minimumFutureDate
  })

  const update = <K extends keyof RecurringTaskInput>(
    field: K,
    value: RecurringTaskInput[K],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[field as string]
      return next
    })
  }

  const updateSchedule = (patch: Partial<RecurringTaskInput['schedule']>) => {
    setDraft((current) => ({
      ...current,
      schedule: { ...current.schedule, ...patch },
    }))
    setErrors((current) => {
      const next = { ...current }
      delete next.schedule
      return next
    })
  }

  const handlePresetChange = (preset: FrequencyPreset) => {
    setFrequencyPreset(preset)
    if (preset === 'daily') {
      updateSchedule({
        anchorDate: null,
        dayOfMonth: null,
        interval: 1,
        unit: 'day',
        weekdays: [],
      })
    }
    if (preset === 'every-n-days') {
      updateSchedule({
        anchorDate: draft.schedule.anchorDate ?? draft.startDate,
        dayOfMonth: null,
        interval: Math.max(2, draft.schedule.interval),
        unit: 'day',
        weekdays: [],
      })
    }
    if (preset === 'weekly') {
      updateSchedule({
        anchorDate: null,
        dayOfMonth: null,
        interval: 1,
        unit: 'week',
        weekdays: [1],
      })
    }
    if (preset === 'selected') {
      const weekdays = draft.schedule.weekdays ?? []
      updateSchedule({
        anchorDate: null,
        dayOfMonth: null,
        interval: 1,
        unit: 'week',
        weekdays: weekdays.length > 0 ? weekdays : [1, 3, 5],
      })
    }
    if (preset === 'monthly') {
      updateSchedule({
        anchorDate: null,
        dayOfMonth: draft.schedule.dayOfMonth ?? 1,
        interval: 1,
        unit: 'month',
        weekdays: [],
      })
    }
  }

  const save = async () => {
    if (mode === 'future') {
      const futureInput: RecurringTaskScheduleVersionInput = {
        effectiveFrom,
        recurringTaskId: task?.id ?? '',
        schedule: draft.schedule,
      }
      const nextErrors = getVersionFieldErrors(futureInput)
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors)
        return
      }
      await onSubmitFuture?.(futureInput)
      return
    }

    const nextErrors = getFieldErrors(draft)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    await onSubmit(draft)
  }

  const weekdays = draft.schedule.weekdays ?? []

  return (
    <section
      aria-labelledby="task-form-title"
      className="rounded-panel border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">
            Tarea recurrente
          </p>
          <h2
            className="mt-2 text-xl font-bold tracking-tight text-ink"
            id="task-form-title"
          >
            {mode === 'future'
              ? 'Nueva regla futura'
              : task
                ? 'Editar tarea'
                : 'Nueva tarea'}
          </h2>
        </div>
        <Button onClick={onCancel} variant="ghost">
          Cancelar
        </Button>
      </div>
      <p
        className="mt-5 rounded-control bg-brand-soft px-3 py-2 text-sm font-semibold text-brand"
        role="status"
      >
        {draft.title.trim() || 'Nueva tarea'} ·{' '}
        {describeSchedule(draft.schedule as RecurringTask['schedule'])}
      </p>
      {mode === 'future' ? (
        <div className="mt-5 space-y-3">
          <TextField
            error={errors.effectiveFrom}
            id="task-effective-from"
            label="Aplicar desde"
            min={minimumFutureDate}
            onChange={(event) => setEffectiveFrom(event.target.value)}
            required
            type="date"
            value={effectiveFrom}
          />
          <p className="rounded-control bg-brand-soft px-3 py-2 text-sm leading-6 text-brand">
            La próxima fecha y el historial anterior se mantienen; esta regla se
            evaluará desde la fecha indicada.
          </p>
        </div>
      ) : null}
      {mode !== 'future' ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <TextField
            error={errors.title}
            id="task-title"
            label="Título"
            onChange={(event) => update('title', event.target.value)}
            required
            value={draft.title}
          />
          <ColorField
            error={errors.color}
            id="task-color"
            label="Color opcional"
            onChange={(event) => update('color', event.target.value)}
            value={draft.color ?? '#5E6B65'}
          />
          <TextAreaField
            error={errors.description}
            id="task-description"
            label="Descripción"
            onChange={(event) => update('description', event.target.value || null)}
            rows={3}
            value={draft.description ?? ''}
          />
          <SelectField
            id="task-relation"
            label="Relación opcional"
            onChange={(event) => {
              const value = event.target.value || null
              update('subjectId', value?.startsWith('subject:') ? value.slice(8) : null)
              update(
                'personalGroupId',
                value?.startsWith('group:') ? value.slice(6) : null,
              )
            }}
            value={
              draft.subjectId
                ? `subject:${draft.subjectId}`
                : draft.personalGroupId
                  ? `group:${draft.personalGroupId}`
                  : ''
            }
          >
            <option value="">Sin relación</option>
            <optgroup label="Asignaturas">
              {subjects.map((subject) => (
                <option key={subject.id} value={`subject:${subject.id}`}>
                  {subject.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Grupos personales">
              {personalGroups.map((group) => (
                <option key={group.id} value={`group:${group.id}`}>
                  {group.name}
                </option>
              ))}
            </optgroup>
          </SelectField>
          <TextField
            error={errors.startDate}
            id="task-start-date"
            label="Fecha de inicio"
            onChange={(event) => update('startDate', event.target.value)}
            required
            type="date"
            value={draft.startDate}
          />
          <TextField
            error={errors.nextDueDate}
            id="task-next-date"
            label="Próxima fecha"
            onChange={(event) => update('nextDueDate', event.target.value)}
            required
            type="date"
            value={draft.nextDueDate}
          />
          <TextField
            error={errors.endDate}
            id="task-end-date"
            label="Fecha final opcional"
            onChange={(event) => update('endDate', event.target.value || null)}
            type="date"
            value={draft.endDate ?? ''}
          />
          <TextField
            error={errors.durationMinutes}
            id="task-duration"
            label="Duración opcional (minutos)"
            min="1"
            onChange={(event) =>
              update(
                'durationMinutes',
                event.target.value ? Number(event.target.value) : null,
              )
            }
            type="number"
            value={draft.durationMinutes ?? ''}
          />
          <TextField
            id="task-due-time"
            label="Hora opcional"
            onChange={(event) => update('dueTime', event.target.value || null)}
            type="time"
            value={draft.dueTime ?? ''}
          />
        </div>
      ) : null}
      <div className="mt-5 space-y-4">
        <SelectField
          error={errors.schedule}
          id="task-frequency"
          label="Frecuencia"
          onChange={(event) =>
            handlePresetChange(event.target.value as FrequencyPreset)
          }
          value={frequencyPreset}
        >
          <option value="daily">Todos los días</option>
          <option value="selected">Días seleccionados</option>
          <option value="weekly">Cada semana</option>
          <option value="monthly">Cada mes</option>
          <option value="every-n-days">Cada N días</option>
        </SelectField>
        {frequencyPreset === 'selected' || frequencyPreset === 'weekly' ? (
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Días activos</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {WEEKDAYS.map(([value, label]) => (
                <label
                  className="flex min-h-11 items-center gap-2 rounded-control border border-border px-3 text-sm text-ink focus-within:border-focus focus-within:ring-4 focus-within:ring-brand-soft"
                  key={value}
                >
                  <input
                    checked={weekdays.includes(value)}
                    className="size-4 accent-brand"
                    onChange={(event) => {
                      const weekdays = event.target.checked
                        ? [...(draft.schedule.weekdays ?? []), value]
                        : (draft.schedule.weekdays ?? []).filter((day) => day !== value)
                      updateSchedule({ weekdays })
                    }}
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        {frequencyPreset === 'every-n-days' ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              error={errors.schedule}
              id="task-interval"
              label="Cada cuántos días"
              min="2"
              onChange={(event) =>
                updateSchedule({ interval: Number(event.target.value) })
              }
              type="number"
              value={draft.schedule.interval}
            />
            <TextField
              error={errors.schedule}
              id="task-anchor-date"
              label="Fecha ancla"
              onChange={(event) => updateSchedule({ anchorDate: event.target.value })}
              type="date"
              value={draft.schedule.anchorDate ?? draft.startDate}
            />
          </div>
        ) : null}
        {frequencyPreset === 'monthly' ? (
          <TextField
            error={errors.schedule}
            hint="Los días 29, 30 y 31 usan el último día disponible cuando el mes es más corto."
            id="task-day-of-month"
            label="Día del mes"
            max="31"
            min="1"
            onChange={(event) =>
              updateSchedule({ dayOfMonth: Number(event.target.value) })
            }
            type="number"
            value={draft.schedule.dayOfMonth ?? 1}
          />
        ) : null}
      </div>
      {mode !== 'future' ? (
        <div className="mt-5 flex flex-wrap gap-4">
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-ink">
            <input
              checked={draft.calendarEnabled}
              className="size-4 accent-brand"
              onChange={(event) => update('calendarEnabled', event.target.checked)}
              type="checkbox"
            />
            Mostrar en Calendario
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-ink">
            <input
              checked={draft.status === 'paused'}
              className="size-4 accent-brand"
              onChange={(event) =>
                update('status', event.target.checked ? 'paused' : 'active')
              }
              type="checkbox"
            />
            Pausar tarea
          </label>
        </div>
      ) : null}
      <div className="mt-6 flex justify-end border-t border-border pt-5">
        <Button
          isLoading={isLoading}
          loadingLabel={mode === 'future' ? 'Guardando regla…' : 'Guardando…'}
          onClick={() => void save()}
        >
          {mode === 'future' ? 'Guardar regla futura' : 'Guardar tarea'}
        </Button>
      </div>
    </section>
  )
}
