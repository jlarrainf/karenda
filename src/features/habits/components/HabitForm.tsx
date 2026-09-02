import { useMemo, useState } from 'react'
import type { Habit, PersonalGroup, Subject } from '../../../types/domain.ts'
import { Button } from '../../../components/ui/Button.tsx'
import {
  ColorField,
  SelectField,
  TextAreaField,
  TextField,
} from '../../../components/ui/FormField.tsx'
import { getLocalDateKey, shiftDateKey } from '../../../lib/dates/dateUtils.ts'
import {
  habitInputSchema,
  habitScheduleVersionInputSchema,
  type HabitInput,
  type HabitScheduleVersionInput,
} from '../../../services/habitValidation.ts'
import { describeSchedule, formatHabitGoal } from '../utils/habitRecurrence.ts'

interface HabitFormProps {
  habit?: Habit | null
  isLoading: boolean
  personalGroups: Pick<PersonalGroup, 'id' | 'name'>[]
  subjects: Pick<Subject, 'id' | 'name'>[]
  onCancel: () => void
  onSubmit: (input: HabitInput) => Promise<void>
  onSubmitFuture?: (input: HabitScheduleVersionInput) => Promise<void>
  mode?: 'habit' | 'future'
}

type FormStep = 1 | 2 | 3 | 4 | 5
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

function defaultDraft(habit?: Habit | null): HabitInput {
  if (habit) {
    return {
      calendarEnabled: habit.calendarEnabled,
      calendarSchedule: habit.calendarSchedule,
      color: habit.color,
      description: habit.description,
      endDate: habit.endDate,
      evaluationMode: habit.evaluationMode,
      goalValue: habit.goalValue,
      lifecycleStatus: habit.lifecycleStatus,
      missPolicy: habit.missPolicy,
      name: habit.name,
      notePolicy: habit.notePolicy,
      personalGroupId: habit.personalGroupId,
      quotaPeriod: habit.quotaPeriod,
      schedule: habit.schedule,
      startDate: habit.startDate,
      statsEnabled: habit.statsEnabled,
      subjectId: habit.subjectId,
      trackingType: habit.trackingType,
      unit: habit.unit,
    }
  }

  return {
    calendarEnabled: false,
    calendarSchedule: null,
    color: null,
    description: null,
    endDate: null,
    evaluationMode: 'scheduled_occurrence',
    goalValue: 1,
    lifecycleStatus: 'active',
    missPolicy: 'mark_missed',
    name: '',
    notePolicy: 'none',
    personalGroupId: null,
    quotaPeriod: null,
    schedule: {
      anchorDate: null,
      dayOfMonth: null,
      interval: 1,
      unit: 'day',
      weekdays: [],
    },
    startDate: getLocalDateKey(new Date().toISOString()),
    statsEnabled: true,
    subjectId: null,
    trackingType: 'boolean',
    unit: null,
  }
}

function getFieldErrors(draft: HabitInput): Record<string, string> {
  const result = habitInputSchema.safeParse(draft)

  if (result.success) return {}

  return result.error.issues.reduce<Record<string, string>>((errors, issue) => {
    const field = issue.path[0]
    if (typeof field === 'string' && !errors[field]) errors[field] = issue.message
    return errors
  }, {})
}

function getVersionFieldErrors(
  input: HabitScheduleVersionInput,
): Record<string, string> {
  const result = habitScheduleVersionInputSchema.safeParse(input)

  if (result.success) return {}

  return result.error.issues.reduce<Record<string, string>>((errors, issue) => {
    const field = issue.path[0]
    if (typeof field === 'string' && !errors[field]) errors[field] = issue.message
    return errors
  }, {})
}

function getPreset(draft: HabitInput): FrequencyPreset {
  if (draft.schedule.unit === 'month') return 'monthly'
  if (draft.schedule.unit === 'week') {
    return (draft.schedule.weekdays ?? []).length === 1 ? 'weekly' : 'selected'
  }
  return draft.schedule.interval === 1 ? 'daily' : 'every-n-days'
}

export function HabitForm({
  habit,
  isLoading,
  personalGroups,
  subjects,
  onCancel,
  onSubmit,
  onSubmitFuture,
  mode = 'habit',
}: HabitFormProps) {
  const [draft, setDraft] = useState<HabitInput>(() => defaultDraft(habit))
  const [step, setStep] = useState<FormStep>(1)
  const [frequencyPreset, setFrequencyPreset] = useState<FrequencyPreset>(() =>
    getPreset(defaultDraft(habit)),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => habit?.startDate ?? getLocalDateKey(new Date().toISOString()),
  )
  const calendarSchedule = draft.calendarSchedule ?? {
    dates: [],
    mode: 'rule' as const,
    weekdays: [],
  }
  const minimumFutureDate = (() => {
    const tomorrow = shiftDateKey(getLocalDateKey(new Date().toISOString()), 1)
    return habit?.startDate && habit.startDate > tomorrow ? habit.startDate : tomorrow
  })()

  const updateDraft = <K extends keyof HabitInput>(field: K, value: HabitInput[K]) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[field as string]
      return next
    })
  }

  const updateSchedule = (patch: Partial<HabitInput['schedule']>) => {
    setDraft((current) => ({ ...current, schedule: { ...current.schedule, ...patch } }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.schedule
      return next
    })
  }

  const updateCalendarSchedule = (
    patch: Partial<NonNullable<HabitInput['calendarSchedule']>>,
  ) => {
    updateDraft('calendarSchedule', { ...calendarSchedule, ...patch })
  }

  const handlePresetChange = (preset: FrequencyPreset) => {
    setFrequencyPreset(preset)
    if (preset === 'daily')
      updateSchedule({
        unit: 'day',
        interval: 1,
        weekdays: [],
        dayOfMonth: null,
        anchorDate: null,
      })
    if (preset === 'every-n-days')
      updateSchedule({
        unit: 'day',
        interval: 2,
        weekdays: [],
        dayOfMonth: null,
        anchorDate: draft.startDate ?? getLocalDateKey(new Date().toISOString()),
      })
    if (preset === 'weekly')
      updateSchedule({
        unit: 'week',
        interval: 1,
        weekdays: [1],
        dayOfMonth: null,
        anchorDate: null,
      })
    if (preset === 'selected')
      updateSchedule({
        unit: 'week',
        interval: 1,
        weekdays: [1, 3, 5],
        dayOfMonth: null,
        anchorDate: null,
      })
    if (preset === 'monthly')
      updateSchedule({
        unit: 'month',
        interval: 1,
        weekdays: [],
        dayOfMonth: 1,
        anchorDate: null,
      })
  }

  const summary = useMemo(() => {
    const goal = formatHabitGoal(
      draft.trackingType,
      draft.goalValue,
      draft.unit ?? null,
    )
    return `${draft.name.trim() || 'Nuevo hábito'}: ${goal} · ${describeSchedule(draft.schedule as Habit['schedule'])}`
  }, [draft])

  const handleSubmit = async () => {
    if (mode === 'future') {
      const futureInput: HabitScheduleVersionInput = {
        effectiveFrom,
        evaluationMode: draft.evaluationMode ?? 'scheduled_occurrence',
        goalValue: draft.goalValue,
        habitId: habit?.id ?? '',
        missPolicy: draft.missPolicy ?? 'mark_missed',
        quotaPeriod: draft.quotaPeriod ?? null,
        schedule: draft.schedule,
      }
      const errors = getVersionFieldErrors(futureInput)

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
        setStep(3)
        return
      }

      await onSubmitFuture?.(futureInput)
      return
    }

    const errors = getFieldErrors(draft)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setStep(1)
      return
    }
    await onSubmit(draft)
  }

  return (
    <section
      aria-labelledby="habit-form-title"
      className="rounded-panel border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">
            Paso {step} de 5
          </p>
          <h2
            className="mt-2 text-xl font-bold tracking-tight text-ink"
            id="habit-form-title"
          >
            {mode === 'future'
              ? 'Nueva regla futura'
              : habit
                ? 'Editar hábito'
                : 'Nuevo hábito'}
          </h2>
        </div>
        <Button onClick={onCancel} variant="ghost">
          Cancelar
        </Button>
      </div>

      <p
        className="mt-5 rounded-control bg-brand-soft px-3 py-2 text-sm font-semibold leading-6 text-brand"
        role="status"
      >
        {summary}
      </p>

      <div className="mt-5 flex flex-wrap gap-2" aria-label="Pasos del formulario">
        {[1, 2, 3, 4, 5].map((item) => (
          <button
            aria-current={step === item ? 'step' : undefined}
            className={[
              'min-h-11 rounded-control border px-3 text-sm font-semibold transition-colors duration-state focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft',
              step === item
                ? 'border-brand bg-brand text-surface'
                : 'border-border text-ink-muted hover:bg-surface-subtle',
            ].join(' ')}
            key={item}
            onClick={() => setStep(item as FormStep)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-5">
        {step === 1 ? (
          <div className="space-y-5">
            <TextField
              autoComplete="off"
              error={fieldErrors.name}
              id="habit-name"
              label="Nombre"
              onChange={(event) => updateDraft('name', event.target.value)}
              required
              value={draft.name}
            />
            <TextAreaField
              error={fieldErrors.description}
              id="habit-description"
              label="Descripción"
              onChange={(event) =>
                updateDraft('description', event.target.value || null)
              }
              rows={3}
              value={draft.description ?? ''}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <ColorField
                error={fieldErrors.color}
                id="habit-color"
                label="Color opcional"
                onChange={(event) => updateDraft('color', event.target.value)}
                value={draft.color ?? '#5E6B65'}
              />
              <SelectField
                error={fieldErrors.subjectId || fieldErrors.personalGroupId}
                id="habit-relation"
                label="Relación opcional"
                onChange={(event) => {
                  const value = event.target.value || null
                  if (value?.startsWith('subject:')) {
                    updateDraft('subjectId', value.slice(8))
                    updateDraft('personalGroupId', null)
                  } else if (value?.startsWith('group:')) {
                    updateDraft('personalGroupId', value.slice(6))
                    updateDraft('subjectId', null)
                  } else {
                    updateDraft('subjectId', null)
                    updateDraft('personalGroupId', null)
                  }
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
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              error={fieldErrors.trackingType}
              id="habit-tracking-type"
              disabled={mode === 'future'}
              label="Tipo de seguimiento"
              onChange={(event) => {
                const trackingType = event.target.value as HabitInput['trackingType']
                updateDraft('trackingType', trackingType)
                updateDraft(
                  'unit',
                  trackingType === 'boolean'
                    ? null
                    : trackingType === 'duration'
                      ? 'minutos'
                      : 'unidades',
                )
                updateDraft('goalValue', trackingType === 'boolean' ? 1 : 1)
              }}
              value={draft.trackingType}
            >
              <option value="boolean">Casilla de cumplimiento</option>
              <option value="count">Cantidad</option>
              <option value="duration">Duración</option>
            </SelectField>
            {draft.trackingType !== 'boolean' ? (
              <TextField
                disabled={mode === 'future'}
                error={fieldErrors.unit}
                id="habit-unit"
                label="Unidad"
                onChange={(event) => updateDraft('unit', event.target.value)}
                required
                value={draft.unit ?? ''}
              />
            ) : null}
            <TextField
              error={fieldErrors.goalValue}
              id="habit-goal"
              label="Meta por ocurrencia o periodo"
              min="1"
              onChange={(event) => updateDraft('goalValue', Number(event.target.value))}
              required
              type="number"
              value={draft.goalValue}
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <SelectField
              id="habit-frequency"
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
                      className="flex min-h-11 items-center gap-2 rounded-control border border-border px-3 text-sm text-ink"
                      key={value}
                    >
                      <input
                        checked={(draft.schedule.weekdays ?? []).includes(value)}
                        className="size-4 accent-brand"
                        onChange={(event) => {
                          const weekdays = event.target.checked
                            ? [...(draft.schedule.weekdays ?? []), value]
                            : (draft.schedule.weekdays ?? []).filter(
                                (day) => day !== value,
                              )
                          updateSchedule({
                            weekdays: weekdays as HabitInput['schedule']['weekdays'],
                          })
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
                  id="habit-interval"
                  label="Cada cuántos días"
                  min="2"
                  onChange={(event) =>
                    updateSchedule({ interval: Number(event.target.value) })
                  }
                  type="number"
                  value={draft.schedule.interval}
                />
                <TextField
                  id="habit-anchor-date"
                  label="Fecha ancla"
                  onChange={(event) =>
                    updateSchedule({ anchorDate: event.target.value })
                  }
                  type="date"
                  value={draft.schedule.anchorDate ?? draft.startDate}
                />
              </div>
            ) : null}
            {frequencyPreset === 'monthly' ? (
              <TextField
                id="habit-day-of-month"
                hint="Los días 29, 30 y 31 usan el último día disponible cuando el mes es más corto."
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
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                error={fieldErrors.startDate}
                id="habit-start-date"
                label="Fecha de inicio"
                onChange={(event) => updateDraft('startDate', event.target.value)}
                required
                type="date"
                value={draft.startDate}
              />
              <TextField
                error={fieldErrors.endDate}
                id="habit-end-date"
                label="Fecha final opcional"
                onChange={(event) => updateDraft('endDate', event.target.value || null)}
                type="date"
                value={draft.endDate ?? ''}
              />
              {mode === 'future' ? (
                <TextField
                  error={fieldErrors.effectiveFrom}
                  id="habit-effective-from"
                  label="Fecha efectiva"
                  min={minimumFutureDate}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                  required
                  type="date"
                  value={effectiveFrom}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              error={fieldErrors.evaluationMode}
              id="habit-evaluation-mode"
              label="Forma de evaluación"
              onChange={(event) => {
                const evaluationMode = event.target
                  .value as HabitInput['evaluationMode']
                updateDraft('evaluationMode', evaluationMode)
                updateDraft(
                  'quotaPeriod',
                  evaluationMode === 'period_quota' ? 'week' : null,
                )
              }}
              value={draft.evaluationMode}
            >
              <option value="scheduled_occurrence">Por ocurrencia programada</option>
              <option value="period_quota">Por cuota acumulada</option>
            </SelectField>
            {draft.evaluationMode === 'period_quota' ? (
              <SelectField
                error={fieldErrors.quotaPeriod}
                id="habit-quota-period"
                label="Periodo de cuota"
                onChange={(event) =>
                  updateDraft(
                    'quotaPeriod',
                    event.target.value as HabitInput['quotaPeriod'],
                  )
                }
                value={draft.quotaPeriod ?? 'week'}
              >
                <option value="day">Día</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
              </SelectField>
            ) : null}
            <SelectField
              id="habit-miss-policy"
              label="Qué ocurre si no se registra"
              onChange={(event) =>
                updateDraft(
                  'missPolicy',
                  event.target.value as HabitInput['missPolicy'],
                )
              }
              value={draft.missPolicy}
            >
              <option value="mark_missed">Marcar como Incumplido</option>
              <option value="keep_pending">Mantener Pendiente</option>
            </SelectField>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-5">
            {mode === 'future' ? (
              <p className="rounded-control bg-brand-soft px-3 py-2 text-sm leading-6 text-brand">
                Esta regla se aplicará desde la fecha efectiva y no cambia los registros
                anteriores.
              </p>
            ) : null}
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-ink">
              <input
                checked={draft.statsEnabled}
                className="size-4 accent-brand"
                onChange={(event) => updateDraft('statsEnabled', event.target.checked)}
                type="checkbox"
              />
              Activar estadísticas y rachas
            </label>
            <SelectField
              id="habit-note-policy"
              label="Notas del hábito"
              onChange={(event) =>
                updateDraft(
                  'notePolicy',
                  event.target.value as HabitInput['notePolicy'],
                )
              }
              value={draft.notePolicy}
            >
              <option value="none">Sin notas</option>
              <option value="general">Una nota general</option>
              <option value="daily">Notas diarias</option>
              <option value="both">Nota general y notas diarias</option>
            </SelectField>
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-ink">
              <input
                checked={draft.calendarEnabled}
                className="size-4 accent-brand"
                onChange={(event) => {
                  const enabled = event.target.checked
                  updateDraft('calendarEnabled', enabled)
                  updateDraft(
                    'calendarSchedule',
                    enabled ? { mode: 'rule', weekdays: [], dates: [] } : null,
                  )
                }}
                type="checkbox"
              />
              Mostrar proyección de solo lectura en Calendario
            </label>
            {draft.calendarEnabled ? (
              <div className="space-y-4 rounded-control border border-border bg-surface-subtle p-4">
                <SelectField
                  id="habit-calendar-mode"
                  label="Días de la proyección"
                  onChange={(event) =>
                    updateCalendarSchedule({
                      mode: event.target.value as NonNullable<
                        HabitInput['calendarSchedule']
                      >['mode'],
                    })
                  }
                  value={calendarSchedule.mode}
                >
                  <option value="rule">Días de la regla del hábito</option>
                  <option value="active_days">Todos los días activos</option>
                  <option value="custom">Selección personalizada</option>
                </SelectField>
                {calendarSchedule.mode === 'active_days' ? (
                  <fieldset>
                    <legend className="text-sm font-semibold text-ink">
                      Días activos opcionales
                    </legend>
                    <p className="mt-1 text-sm leading-6 text-ink-muted">
                      Si no seleccionas días, se usarán los días de la regla.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {WEEKDAYS.map(([value, label]) => (
                        <label
                          className="flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-3 text-sm text-ink"
                          key={`calendar-${value}`}
                        >
                          <input
                            checked={(calendarSchedule.weekdays ?? []).includes(value)}
                            className="size-4 accent-brand"
                            onChange={(event) => {
                              const weekdays = event.target.checked
                                ? [...(calendarSchedule.weekdays ?? []), value]
                                : (calendarSchedule.weekdays ?? []).filter(
                                    (day) => day !== value,
                                  )
                              updateCalendarSchedule({
                                weekdays: weekdays as NonNullable<
                                  HabitInput['calendarSchedule']
                                >['weekdays'],
                              })
                            }}
                            type="checkbox"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                {calendarSchedule.mode === 'custom' ? (
                  <TextField
                    error={fieldErrors.calendarSchedule}
                    hint="Usa formato AAAA-MM-DD y separa varias fechas con comas."
                    id="habit-calendar-dates"
                    label="Fechas personalizadas"
                    onChange={(event) =>
                      updateCalendarSchedule({
                        dates: event.target.value
                          .split(',')
                          .map((date) => date.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="2026-09-10, 2026-09-15"
                    type="text"
                    value={(calendarSchedule.dates ?? []).join(', ')}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        {step > 1 ? (
          <Button
            onClick={() => setStep((current) => (current - 1) as FormStep)}
            variant="ghost"
          >
            Anterior
          </Button>
        ) : null}
        {step < 5 ? (
          <Button
            onClick={() => setStep((current) => (current + 1) as FormStep)}
            variant="secondary"
          >
            Siguiente
          </Button>
        ) : null}
        {step === 5 ? (
          <Button
            isLoading={isLoading}
            loadingLabel="Guardando…"
            onClick={() => void handleSubmit()}
          >
            Guardar hábito
          </Button>
        ) : null}
      </div>
    </section>
  )
}
