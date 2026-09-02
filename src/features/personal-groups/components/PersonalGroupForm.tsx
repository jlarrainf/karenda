import { useState } from 'react'
import { useForm, type FieldErrors } from 'react-hook-form'
import type { PersonalGroup } from '../../../types/domain.ts'
import {
  personalGroupInputSchema,
  type PersonalGroupInput,
} from '../../../services/validation.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { ColorField, TextField } from '../../../components/ui/FormField.tsx'

interface PersonalGroupFormProps {
  group: PersonalGroup | null
  isLoading: boolean
  onCancel: () => void
  onSubmit: (input: PersonalGroupInput) => Promise<void>
}

interface PersonalGroupFormValues {
  color: string
  name: string
}

function focusFirstGroupError(
  errors: FieldErrors<PersonalGroupFormValues>,
  setFocus: (name: keyof PersonalGroupFormValues) => void,
) {
  const firstField = errors.name ? 'name' : errors.color ? 'color' : undefined

  if (firstField) {
    setFocus(firstField)
  }
}

export function PersonalGroupForm({
  group,
  isLoading,
  onCancel,
  onSubmit,
}: PersonalGroupFormProps) {
  const [hasColor, setHasColor] = useState(Boolean(group?.color))
  const {
    register: registerField,
    handleSubmit,
    clearErrors,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<PersonalGroupFormValues>({
    defaultValues: {
      color: group?.color ?? '#2F625A',
      name: group?.name ?? '',
    },
    mode: 'onBlur',
  })

  const handleFormSubmit = async (values: PersonalGroupFormValues) => {
    clearErrors()
    const parsed = personalGroupInputSchema.safeParse({
      color: hasColor ? values.color : null,
      name: values.name,
    })

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]

        if (field === 'name' || field === 'color') {
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
          focusFirstGroupError(formErrors, setFocus),
        )(event)
      }
    >
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink">
          {group ? 'Editar grupo personal' : 'Nuevo grupo personal'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Agrupa tus eventos personales sin mezclarlos con tus asignaturas.
        </p>
      </div>

      <TextField
        autoComplete="off"
        error={errors.name?.message}
        id="personal-group-name"
        label="Nombre"
        maxLength={160}
        required
        {...registerField('name')}
      />

      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-ink">
        <input
          checked={hasColor}
          className="size-4 accent-brand focus-visible:ring-4 focus-visible:ring-brand-soft"
          onChange={(event) => setHasColor(event.target.checked)}
          type="checkbox"
        />
        <span>Asignar un color a este grupo</span>
      </label>

      <ColorField
        disabled={!hasColor}
        error={errors.color?.message}
        hint={
          hasColor
            ? 'El color ayuda a distinguir tus eventos personales.'
            : 'Se usará un color neutro.'
        }
        id="personal-group-color"
        label="Color (opcional)"
        {...registerField('color')}
      />

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button disabled={isLoading} onClick={onCancel} variant="ghost">
          Cancelar
        </Button>
        <Button isLoading={isLoading} loadingLabel="Guardando…" type="submit">
          {group ? 'Guardar cambios' : 'Guardar grupo'}
        </Button>
      </div>
    </form>
  )
}
