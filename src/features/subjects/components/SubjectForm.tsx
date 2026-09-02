import { useForm, type FieldErrors } from 'react-hook-form'
import type { Subject } from '../../../types/domain.ts'
import { subjectInputSchema, type SubjectInput } from '../../../services/validation.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { ColorField, TextField } from '../../../components/ui/FormField.tsx'

interface SubjectFormProps {
  isLoading: boolean
  onCancel: () => void
  onSubmit: (input: SubjectInput) => Promise<void>
  subject: Subject | null
}

interface SubjectFormValues {
  abbreviation: string
  code: string
  color: string
  name: string
}

const subjectFieldOrder: (keyof SubjectFormValues)[] = [
  'name',
  'code',
  'abbreviation',
  'color',
]

function focusFirstSubjectError(
  errors: FieldErrors<SubjectFormValues>,
  setFocus: (name: keyof SubjectFormValues) => void,
) {
  const firstField = subjectFieldOrder.find((field) => errors[field])

  if (firstField) {
    setFocus(firstField)
  }
}

export function SubjectForm({
  isLoading,
  onCancel,
  onSubmit,
  subject,
}: SubjectFormProps) {
  const {
    register: registerField,
    handleSubmit,
    clearErrors,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<SubjectFormValues>({
    defaultValues: {
      abbreviation: subject?.abbreviation ?? '',
      code: subject?.code ?? '',
      color: subject?.color ?? '#2F625A',
      name: subject?.name ?? '',
    },
    mode: 'onBlur',
  })

  const handleFormSubmit = async (values: SubjectFormValues) => {
    clearErrors()
    const parsed = subjectInputSchema.safeParse(values)

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]

        if (
          field === 'name' ||
          field === 'code' ||
          field === 'abbreviation' ||
          field === 'color'
        ) {
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
          focusFirstSubjectError(formErrors, setFocus),
        )(event)
      }
    >
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink">
          {subject ? 'Editar asignatura' : 'Nueva asignatura'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Define los datos que identificarán tus eventos académicos.
        </p>
      </div>

      <TextField
        autoComplete="off"
        error={errors.name?.message}
        id="subject-name"
        label="Nombre"
        maxLength={160}
        required
        {...registerField('name')}
      />
      <TextField
        autoComplete="off"
        error={errors.code?.message}
        id="subject-code"
        label="Sigla"
        maxLength={40}
        required
        {...registerField('code')}
      />
      <TextField
        autoComplete="off"
        error={errors.abbreviation?.message}
        id="subject-abbreviation"
        label="Abreviación"
        maxLength={40}
        required
        {...registerField('abbreviation')}
      />
      <ColorField
        error={errors.color?.message}
        hint="Este color resaltará tus eventos de esta asignatura."
        id="subject-color"
        label="Color"
        required
        {...registerField('color')}
      />

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button disabled={isLoading} onClick={onCancel} variant="ghost">
          Cancelar
        </Button>
        <Button isLoading={isLoading} loadingLabel="Guardando…" type="submit">
          {subject ? 'Guardar cambios' : 'Guardar asignatura'}
        </Button>
      </div>
    </form>
  )
}
