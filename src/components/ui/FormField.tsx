import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

interface FormFieldProps {
  children: ReactNode
  error?: string
  hint?: string
  id: string
  label: string
  required?: boolean
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  error?: string
  hint?: string
  id: string
  label: string
}

interface ColorFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type'
> {
  error?: string
  hint?: string
  id: string
  label: string
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  children: ReactNode
  error?: string
  hint?: string
  id: string
  label: string
}

interface TextAreaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id'
> {
  error?: string
  hint?: string
  id: string
  label: string
}

function getDescribedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(
    (value): value is string => value !== null,
  )

  return ids.length > 0 ? ids.join(' ') : undefined
}

function FormField({ children, error, hint, id, label, required }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-ink" htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p className="text-xs leading-5 text-ink-muted" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm leading-6 text-danger" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function TextField({
  className,
  error,
  hint,
  id,
  label,
  ...inputProps
}: TextFieldProps) {
  return (
    <FormField
      error={error}
      hint={hint}
      id={id}
      label={label}
      required={inputProps.required}
    >
      <input
        {...inputProps}
        aria-describedby={getDescribedBy(id, hint, error)}
        aria-invalid={error ? true : undefined}
        className={[
          'min-h-11 w-full rounded-control border bg-surface px-3.5 text-sm text-ink transition-colors duration-state placeholder:text-ink-subtle hover:border-border-strong focus:border-focus focus:ring-4 focus:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-subtle',
          error ? 'border-danger' : 'border-border',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        id={id}
      />
    </FormField>
  )
}

export function ColorField({
  className,
  error,
  hint,
  id,
  label,
  ...inputProps
}: ColorFieldProps) {
  return (
    <FormField
      error={error}
      hint={hint}
      id={id}
      label={label}
      required={inputProps.required}
    >
      <input
        {...inputProps}
        aria-describedby={getDescribedBy(id, hint, error)}
        aria-invalid={error ? true : undefined}
        className={[
          'block h-11 w-full cursor-pointer rounded-control border bg-surface p-1 transition-colors duration-state hover:border-border-strong focus:border-focus focus:ring-4 focus:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-subtle',
          error ? 'border-danger' : 'border-border',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        id={id}
        type="color"
      />
    </FormField>
  )
}

export function SelectField({
  children,
  className,
  error,
  hint,
  id,
  label,
  ...selectProps
}: SelectFieldProps) {
  return (
    <FormField
      error={error}
      hint={hint}
      id={id}
      label={label}
      required={selectProps.required}
    >
      <select
        {...selectProps}
        aria-describedby={getDescribedBy(id, hint, error)}
        aria-invalid={error ? true : undefined}
        className={[
          'min-h-11 w-full rounded-control border bg-surface px-3.5 text-sm text-ink transition-colors duration-state hover:border-border-strong focus:border-focus focus:ring-4 focus:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-subtle',
          error ? 'border-danger' : 'border-border',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        id={id}
      >
        {children}
      </select>
    </FormField>
  )
}

export function TextAreaField({
  className,
  error,
  hint,
  id,
  label,
  ...textareaProps
}: TextAreaFieldProps) {
  return (
    <FormField
      error={error}
      hint={hint}
      id={id}
      label={label}
      required={textareaProps.required}
    >
      <textarea
        {...textareaProps}
        aria-describedby={getDescribedBy(id, hint, error)}
        aria-invalid={error ? true : undefined}
        className={[
          'min-h-28 w-full resize-y rounded-control border bg-surface px-3.5 py-3 text-sm leading-6 text-ink transition-colors duration-state placeholder:text-ink-subtle hover:border-border-strong focus:border-focus focus:ring-4 focus:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-subtle',
          error ? 'border-danger' : 'border-border',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        id={id}
      />
    </FormField>
  )
}
