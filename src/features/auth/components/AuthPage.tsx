import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm, type FieldErrors } from 'react-hook-form'
import {
  emailVerificationInputSchema,
  registerInputSchema,
  signInInputSchema,
} from '../../../services/validation.ts'
import { useSessionStore } from '../../../stores/sessionStore.ts'

interface AuthPageProps {
  mode: 'login' | 'register'
}

interface AuthFormValues {
  name: string
  email: string
  password: string
  confirmPassword: string
}

function getSafeRedirectPath(state: unknown): string {
  if (typeof state !== 'object' || state === null) {
    return '/calendar'
  }

  const from = (state as { from?: unknown }).from

  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) {
    return from
  }

  return '/calendar'
}

function inputClassName(hasError: boolean): string {
  return [
    'mt-2 min-h-11 w-full rounded-control border bg-surface px-3.5 text-sm text-ink transition-colors duration-state placeholder:text-ink-subtle hover:border-border-strong focus:border-focus focus:ring-4 focus:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-subtle',
    hasError ? 'border-danger' : 'border-border',
  ].join(' ')
}

function focusFirstError(
  errors: FieldErrors<AuthFormValues>,
  setFocus: (name: keyof AuthFormValues) => void,
) {
  const fieldOrder: (keyof AuthFormValues)[] = [
    'name',
    'email',
    'password',
    'confirmPassword',
  ]
  const firstField = fieldOrder.find((field) => errors[field])

  if (firstField) {
    setFocus(firstField)
  }
}

export function AuthPage({ mode }: AuthPageProps) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const location = useLocation()
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const [registrationEmail, setRegistrationEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const authError = useSessionStore((state) => state.error)
  const isLoading = useSessionStore((state) => state.isLoading)
  const clearError = useSessionStore((state) => state.clearError)
  const registerAccount = useSessionStore((state) => state.register)
  const verifyEmail = useSessionStore((state) => state.verifyEmail)
  const signIn = useSessionStore((state) => state.signIn)
  const {
    register: registerField,
    handleSubmit,
    clearErrors,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<AuthFormValues>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onBlur',
  })

  const onSubmit = async (values: AuthFormValues) => {
    clearError()
    clearErrors()

    if (isRegister) {
      const parsed = registerInputSchema.safeParse({
        email: values.email,
        name: values.name,
        password: values.password,
      })

      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = issue.path[0]

          if (field === 'name' || field === 'email' || field === 'password') {
            setError(field, { message: issue.message, type: 'manual' })
          }
        }
        return
      }

      if (values.password !== values.confirmPassword) {
        setError('confirmPassword', {
          message: 'Las contraseñas deben coincidir.',
          type: 'manual',
        })
        return
      }

      const result = await registerAccount({
        email: values.email,
        name: values.name,
        password: values.password,
      })

      if (!result) {
        return
      }

      if (result.requiresEmailVerification) {
        setRegistrationEmail(values.email.trim())
        setVerificationCode('')
        setVerificationError(null)
        setRegistrationComplete(true)
        return
      }

      navigate(getSafeRedirectPath(location.state), { replace: true })
      return
    }

    const parsed = signInInputSchema.safeParse({
      email: values.email,
      password: values.password,
    })

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]

        if (field === 'email' || field === 'password') {
          setError(field, { message: issue.message, type: 'manual' })
        }
      }
      return
    }

    const result = await signIn({
      email: values.email,
      password: values.password,
    })

    if (result) {
      navigate(getSafeRedirectPath(location.state), { replace: true })
    }
  }

  const handleVerificationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearError()
    setVerificationError(null)

    const parsed = emailVerificationInputSchema.safeParse({
      email: registrationEmail,
      otp: verificationCode,
    })

    if (!parsed.success) {
      setVerificationError(parsed.error.issues[0]?.message ?? 'El código no es válido.')
      return
    }

    const result = await verifyEmail(parsed.data)

    if (result) {
      navigate(getSafeRedirectPath(location.state), { replace: true })
    }
  }

  const title = isRegister ? 'Crear cuenta' : 'Iniciar sesión'
  const description = isRegister
    ? 'Guarda tu calendario académico y personal en un solo lugar.'
    : 'Vuelve a tu calendario y retoma lo que tienes por delante.'
  const alternatePath = isRegister ? '/login' : '/register'
  const alternateLabel = isRegister ? 'Inicia sesión' : 'Crea una cuenta'

  return (
    <main className="min-h-screen bg-canvas" id="main-content">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1fr)]">
        <section className="hidden flex-col justify-between bg-brand px-10 py-10 text-surface lg:flex xl:px-16">
          <div>
            <div className="flex items-center gap-3" translate="no">
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-control bg-surface text-sm font-bold text-brand"
              >
                K
              </span>
              <span className="text-xl font-bold tracking-tight">Karenda</span>
            </div>
            <div className="mt-24 max-w-md">
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-surface">
                Una vista tranquila para todo lo que importa.
              </h1>
              <p className="mt-5 max-w-sm text-base leading-7 text-brand-soft">
                Asignaturas, eventos y notas organizados para que puedas decidir qué
                hacer a continuación.
              </p>
            </div>
          </div>
          <p className="max-w-sm border-t border-brand-soft/30 pt-5 text-sm leading-6 text-brand-soft">
            Tus datos pertenecen a tu cuenta y se mantienen separados de otros
            calendarios.
          </p>
        </section>

        <section className="flex min-w-0 flex-col px-4 py-6 sm:px-8 sm:py-10 lg:px-16 lg:py-12">
          <div className="flex items-center justify-between gap-4 lg:justify-end">
            <div className="flex items-center gap-3 lg:hidden" translate="no">
              <span
                aria-hidden="true"
                className="grid size-9 place-items-center rounded-control bg-brand text-sm font-bold text-surface"
              >
                K
              </span>
              <span className="font-bold tracking-tight text-ink">Karenda</span>
            </div>
            <p className="text-right text-sm text-ink-muted">
              {isRegister ? '¿Ya tienes una cuenta?' : '¿Primera vez en Karenda?'}{' '}
              <Link
                className="font-semibold text-brand underline decoration-brand/40 underline-offset-4 transition-colors duration-state hover:text-brand-strong"
                to={alternatePath}
              >
                {alternateLabel}
              </Link>
            </p>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                {title}
              </h2>
              <p className="mt-3 max-w-md text-base leading-7 text-ink-muted">
                {description}
              </p>
            </div>

            {registrationComplete ? (
              <div
                aria-live="polite"
                className="mt-8 space-y-4 rounded-panel border border-success/30 bg-success-soft p-5"
                role="status"
              >
                <div>
                  <h3 className="font-semibold text-ink">
                    Revisa tu correo electrónico
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">
                    Te enviamos un código a <strong>{registrationEmail}</strong>.
                    Confirma tu cuenta para entrar a tu calendario.
                  </p>
                </div>
                <form
                  aria-busy={isLoading}
                  className="space-y-4"
                  noValidate
                  onSubmit={(event) => void handleVerificationSubmit(event)}
                >
                  <div>
                    <label
                      className="text-sm font-semibold text-ink"
                      htmlFor="verification-code"
                    >
                      Código de verificación
                    </label>
                    <input
                      aria-describedby={
                        verificationError ? 'verification-code-error' : undefined
                      }
                      aria-invalid={Boolean(verificationError)}
                      autoComplete="one-time-code"
                      className={inputClassName(Boolean(verificationError))}
                      id="verification-code"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(inputEvent) =>
                        setVerificationCode(
                          inputEvent.target.value.replace(/\D/g, '').slice(0, 6),
                        )
                      }
                      pattern="[0-9]{6}"
                      required
                      type="text"
                      value={verificationCode}
                    />
                    {verificationError ? (
                      <p
                        className="mt-2 text-sm text-danger"
                        id="verification-code-error"
                        role="alert"
                      >
                        {verificationError}
                      </p>
                    ) : null}
                  </div>
                  {authError ? (
                    <div
                      aria-live="assertive"
                      className="rounded-control border border-danger/30 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger"
                      role="alert"
                    >
                      {authError}
                    </div>
                  ) : null}
                  <button
                    className="flex min-h-11 w-full items-center justify-center rounded-control bg-brand px-4 text-sm font-semibold text-surface transition-colors duration-state hover:bg-brand-strong focus-visible:ring-4 focus-visible:ring-brand-soft disabled:cursor-wait disabled:opacity-60"
                    disabled={isLoading}
                    type="submit"
                  >
                    {isLoading ? 'Verificando…' : 'Verificar correo'}
                  </button>
                </form>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold text-brand transition-colors duration-state hover:bg-brand-soft focus-visible:ring-4 focus-visible:ring-brand-soft"
                  to="/login"
                >
                  Ir a iniciar sesión
                </Link>
              </div>
            ) : (
              <form
                aria-busy={isLoading}
                className="mt-8 space-y-5 rounded-panel border border-border bg-surface p-5 sm:p-6"
                noValidate
                onSubmit={(event) =>
                  void handleSubmit(onSubmit, (formErrors) =>
                    focusFirstError(formErrors, setFocus),
                  )(event)
                }
              >
                {isRegister ? (
                  <div>
                    <label className="text-sm font-semibold text-ink" htmlFor="name">
                      Nombre{' '}
                      <span className="font-normal text-ink-muted">(opcional)</span>
                    </label>
                    <input
                      autoComplete="name"
                      aria-describedby={errors.name ? 'name-error' : undefined}
                      aria-invalid={Boolean(errors.name)}
                      className={inputClassName(Boolean(errors.name))}
                      id="name"
                      type="text"
                      {...registerField('name')}
                    />
                    {errors.name ? (
                      <p
                        className="mt-2 text-sm text-danger"
                        id="name-error"
                        role="alert"
                      >
                        {errors.name.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <label className="text-sm font-semibold text-ink" htmlFor="email">
                    Correo electrónico
                  </label>
                  <input
                    autoComplete="email"
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    aria-invalid={Boolean(errors.email)}
                    className={inputClassName(Boolean(errors.email))}
                    id="email"
                    inputMode="email"
                    required
                    spellCheck={false}
                    type="email"
                    {...registerField('email')}
                  />
                  {errors.email ? (
                    <p
                      className="mt-2 text-sm text-danger"
                      id="email-error"
                      role="alert"
                    >
                      {errors.email.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="text-sm font-semibold text-ink" htmlFor="password">
                    Contraseña
                  </label>
                  <input
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    aria-describedby={
                      errors.password ? 'password-help password-error' : 'password-help'
                    }
                    aria-invalid={Boolean(errors.password)}
                    className={inputClassName(Boolean(errors.password))}
                    id="password"
                    required
                    spellCheck={false}
                    type="password"
                    {...registerField('password')}
                  />
                  <p
                    className="mt-2 text-xs leading-5 text-ink-muted"
                    id="password-help"
                  >
                    {isRegister
                      ? 'Debe tener al menos 6 caracteres.'
                      : 'Usa la contraseña de tu cuenta.'}
                  </p>
                  {errors.password ? (
                    <p
                      className="mt-2 text-sm text-danger"
                      id="password-error"
                      role="alert"
                    >
                      {errors.password.message}
                    </p>
                  ) : null}
                </div>

                {isRegister ? (
                  <div>
                    <label
                      className="text-sm font-semibold text-ink"
                      htmlFor="confirm-password"
                    >
                      Repite tu contraseña
                    </label>
                    <input
                      autoComplete="new-password"
                      aria-describedby={
                        errors.confirmPassword ? 'confirm-password-error' : undefined
                      }
                      aria-invalid={Boolean(errors.confirmPassword)}
                      className={inputClassName(Boolean(errors.confirmPassword))}
                      id="confirm-password"
                      required
                      spellCheck={false}
                      type="password"
                      {...registerField('confirmPassword')}
                    />
                    {errors.confirmPassword ? (
                      <p
                        className="mt-2 text-sm text-danger"
                        id="confirm-password-error"
                        role="alert"
                      >
                        {errors.confirmPassword.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {authError ? (
                  <div
                    aria-live="assertive"
                    className="rounded-control border border-danger/30 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger"
                    role="alert"
                  >
                    {authError}
                  </div>
                ) : null}

                <button
                  className="flex min-h-11 w-full items-center justify-center rounded-control bg-brand px-4 text-sm font-semibold text-surface transition-colors duration-state hover:bg-brand-strong focus-visible:ring-4 focus-visible:ring-brand-soft disabled:cursor-wait disabled:opacity-60"
                  disabled={isLoading}
                  type="submit"
                >
                  {isLoading
                    ? isRegister
                      ? 'Creando cuenta…'
                      : 'Iniciando sesión…'
                    : title}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
