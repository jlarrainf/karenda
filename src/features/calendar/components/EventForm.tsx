import { useForm, useWatch, type FieldErrors } from 'react-hook-form'
import type {
  CalendarEvent,
  AcademicActivityType,
  EventKind,
  EventStatus,
  PersonalGroup,
  Subject,
} from '../../../types/domain.ts'
import { eventInputSchema, type EventInput } from '../../../services/validation.ts'
import { Button } from '../../../components/ui/Button.tsx'
import {
  SelectField,
  TextAreaField,
  TextField,
} from '../../../components/ui/FormField.tsx'

interface EventFormProps {
  event?: CalendarEvent | null
  heading?: string
  initialInput?: EventInput | null
  isLoading: boolean
  kind: EventKind
  onCancel: () => void
  onKindChange?: (kind: EventKind) => void
  onSubmit: (input: EventInput) => Promise<void>
  personalGroups: Pick<PersonalGroup, 'id' | 'name'>[]
  subjects: Pick<Subject, 'abbreviation' | 'id' | 'name'>[]
  submitLabel?: string
}

interface EventFormValues {
  academicActivityType: AcademicActivityType | ''
  description: string
  endDate: string
  endTime: string
  isAllDay: boolean
  location: string
  personalGroupId: string
  startDate: string
  startTime: string
  status: EventStatus
  subjectId: string
  title: string
}

const eventFieldOrder: (keyof EventFormValues)[] = [
  'title',
  'subjectId',
  'academicActivityType',
  'startDate',
  'startTime',
  'endDate',
  'endTime',
  'status',
  'location',
  'description',
]

function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

function getDateTimeParts(
  value: string | null,
  isAllDay: boolean,
): { date: string; time: string } {
  if (!value) {
    return { date: '', time: '' }
  }

  if (isAllDay) {
    return { date: value.slice(0, 10), time: '' }
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return { date: value.slice(0, 10), time: '' }
  }

  return {
    date: `${parsed.getFullYear()}-${padDatePart(parsed.getMonth() + 1)}-${padDatePart(parsed.getDate())}`,
    time: `${padDatePart(parsed.getHours())}:${padDatePart(parsed.getMinutes())}`,
  }
}

function getDefaultValues(
  event?: CalendarEvent | null,
  initialInput?: EventInput | null,
): EventFormValues {
  const source = event ?? initialInput

  if (!source) {
    return {
      academicActivityType: '',
      description: '',
      endDate: '',
      endTime: '',
      isAllDay: false,
      location: '',
      personalGroupId: '',
      startDate: '',
      startTime: '',
      status: 'pending',
      subjectId: '',
      title: '',
    }
  }

  const isAllDay = source.isAllDay ?? false
  const start = getDateTimeParts(source.startAt, isAllDay)
  const end = getDateTimeParts(source.endAt ?? null, isAllDay)

  return {
    academicActivityType: source.academicActivityType ?? '',
    description: source.description ?? '',
    endDate: end.date,
    endTime: end.time,
    isAllDay,
    location: source.location ?? '',
    personalGroupId: source.personalGroupId ?? '',
    startDate: start.date,
    startTime: start.time,
    status: source.status ?? 'pending',
    subjectId: source.subjectId ?? '',
    title: source.title,
  }
}

function focusFirstEventError(
  errors: FieldErrors<EventFormValues>,
  setFocus: (name: keyof EventFormValues) => void,
) {
  const firstField = eventFieldOrder.find((field) => errors[field])

  if (firstField) {
    setFocus(firstField)
  }
}

function combineDateTime(date: string, time: string): string {
  if (!date) {
    return ''
  }

  return time ? `${date}T${time}` : date
}

function getInputFieldForIssue(
  path: PropertyKey[],
  values: EventFormValues,
): keyof EventFormValues | null {
  const field = path[0]

  if (
    field === 'title' ||
    field === 'subjectId' ||
    field === 'status' ||
    field === 'location' ||
    field === 'description'
    || field === 'academicActivityType'
  ) {
    return field
  }

  if (field === 'startAt') {
    return values.isAllDay || !values.startDate ? 'startDate' : 'startTime'
  }

  if (field === 'endAt') {
    return values.isAllDay || !values.endDate ? 'endDate' : 'endTime'
  }

  return null
}

function getEventInput(values: EventFormValues, kind: EventKind): EventInput {
  const isAcademic = kind === 'academic'
  const hasEndValue = Boolean(values.endDate || values.endTime)

  return {
    academicActivityType: isAcademic ? values.academicActivityType || null : null,
    description: values.description || null,
    endAt: hasEndValue
      ? values.isAllDay
        ? values.endDate
        : combineDateTime(values.endDate, values.endTime)
      : null,
    isAllDay: values.isAllDay,
    kind,
    location: values.location || null,
    personalGroupId: isAcademic ? null : values.personalGroupId || null,
    startAt: values.isAllDay
      ? values.startDate
      : combineDateTime(values.startDate, values.startTime),
    status: values.status,
    subjectId: isAcademic ? values.subjectId || null : null,
    title: values.title,
  }
}

export function EventForm({
  event = null,
  heading,
  initialInput = null,
  isLoading,
  kind,
  onCancel,
  onKindChange,
  onSubmit,
  personalGroups,
  subjects,
  submitLabel,
}: EventFormProps) {
  const isAcademic = kind === 'academic'
  const isCreating = !event && !initialInput
  const eventLabel = isAcademic ? 'evento académico' : 'evento personal'
  const {
    control,
    register: registerField,
    handleSubmit,
    clearErrors,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<EventFormValues>({
    defaultValues: getDefaultValues(event, initialInput),
    mode: 'onBlur',
  })
  const isAllDay = useWatch({ control, name: 'isAllDay' })

  const handleFormSubmit = async (values: EventFormValues) => {
    clearErrors()

    if (!values.isAllDay && Boolean(values.endDate) !== Boolean(values.endTime)) {
      const field = values.endDate ? 'endTime' : 'endDate'
      setError(field, {
        message: 'Completa la fecha y la hora de término, o deja ambas vacías.',
        type: 'manual',
      })
      return
    }

    const parsed = eventInputSchema.safeParse(getEventInput(values, kind))

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = getInputFieldForIssue(issue.path, values)

        if (field) {
          setError(field, { message: issue.message, type: 'manual' })
        }
      }
      return
    }

    await onSubmit(parsed.data)
  }

  return (
    <form
      aria-busy={isLoading}
      className="space-y-5"
      noValidate
      onSubmit={(event) =>
        void handleSubmit(handleFormSubmit, (formErrors) =>
          focusFirstEventError(formErrors, setFocus),
        )(event)
      }
    >
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink">
          {heading ?? (event ? `Editar ${eventLabel}` : `Nuevo ${eventLabel}`)}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Completa la información esencial y podrás editarla más adelante.
        </p>
      </div>

      {isCreating && onKindChange ? (
        <SelectField
          id="event-kind"
          label="Tipo de evento"
          onChange={(event) => onKindChange(event.target.value as EventKind)}
          value={kind}
        >
          <option value="academic">Académico</option>
          <option value="personal">Personal</option>
        </SelectField>
      ) : null}

      <TextField
        autoComplete="off"
        error={errors.title?.message}
        id="event-title"
        label="Título"
        maxLength={240}
        required
        {...registerField('title')}
      />

      {isAcademic ? (
        <>
          <SelectField
            disabled={subjects.length === 0}
            error={errors.subjectId?.message}
            hint={
              subjects.length === 0
                ? 'Crea una asignatura antes de registrar un evento académico.'
                : undefined
            }
            id="event-subject"
            label="Asignatura"
            required
            {...registerField('subjectId')}
          >
            <option value="">Selecciona una asignatura</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name} ({subject.abbreviation})
              </option>
            ))}
          </SelectField>
          <SelectField
            hint="Opcional para eventos creados manualmente. Canvas te pedirá confirmarla al importar."
            id="event-academic-activity-type"
            label="Tipo de actividad académica"
            {...registerField('academicActivityType')}
          >
            <option value="">Sin categoría</option>
            <option value="assignment">Tarea</option>
            <option value="graded_discussion">Discusión evaluada</option>
            <option value="quiz">Quiz</option>
            <option value="oral_assessment">Interrogación oral</option>
            <option value="test">Control o prueba</option>
            <option value="exam">Examen</option>
            <option value="other">Otra actividad</option>
          </SelectField>
        </>
      ) : (
        <SelectField
          error={errors.personalGroupId?.message}
          hint="Puedes dejar este evento sin grupo personal."
          id="event-personal-group"
          label="Grupo personal"
          {...registerField('personalGroupId')}
        >
          <option value="">Sin grupo personal</option>
          {personalGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </SelectField>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          error={errors.startDate?.message}
          id="event-start-date"
          label="Fecha de inicio"
          required
          type="date"
          {...registerField('startDate')}
        />
        {!isAllDay ? (
          <TextField
            error={errors.startTime?.message}
            id="event-start-time"
            label="Hora de inicio"
            required
            type="time"
            {...registerField('startTime')}
          />
        ) : null}
      </div>

      <label className="flex min-h-11 items-start gap-3 rounded-control border border-border bg-surface-subtle px-3.5 py-3 text-sm text-ink">
        <input
          className="mt-0.5 size-4 accent-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft"
          type="checkbox"
          {...registerField('isAllDay')}
        />
        <span>
          <span className="block font-semibold">Evento de todo el día</span>
          <span className="mt-1 block text-xs leading-5 text-ink-muted">
            Usa fechas locales sin exigir horarios.
          </span>
        </span>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          error={errors.endDate?.message}
          hint="Opcional para un evento puntual."
          id="event-end-date"
          label="Fecha de término"
          type="date"
          {...registerField('endDate')}
        />
        {!isAllDay ? (
          <TextField
            error={errors.endTime?.message}
            hint="Completa también la fecha si usas una hora."
            id="event-end-time"
            label="Hora de término"
            type="time"
            {...registerField('endTime')}
          />
        ) : null}
      </div>

      <SelectField id="event-status" label="Estado" {...registerField('status')}>
        <option value="pending">Pendiente</option>
        <option value="completed">Completado</option>
      </SelectField>

      <TextField
        autoComplete="off"
        error={errors.location?.message}
        id="event-location"
        label="Lugar"
        maxLength={240}
        {...registerField('location')}
      />

      <TextAreaField
        error={errors.description?.message}
        hint={isAcademic ? 'Puedes añadir el temario o instrucciones.' : undefined}
        id="event-description"
        label="Descripción"
        maxLength={5000}
        {...registerField('description')}
      />

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button disabled={isLoading} onClick={onCancel} variant="ghost">
          Cancelar
        </Button>
        <Button isLoading={isLoading} loadingLabel="Guardando…" type="submit">
          {submitLabel ?? (event ? 'Guardar cambios' : 'Guardar evento')}
        </Button>
      </div>
    </form>
  )
}
