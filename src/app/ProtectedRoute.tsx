import { useEffect } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore.ts'

export function ProtectedRoute() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isInitialized, isLoading, error, initialize, retry, startLogin } = useSessionStore()

  useEffect(() => {
    void initialize()
  }, [initialize])

  if (!isInitialized || isLoading) {
    return (
      <section
        aria-busy="true"
        aria-live="polite"
        className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-6 py-12 text-center text-ink-muted"
        id="main-content"
      >
        Comprobando tu sesión…
      </section>
    )
  }

  if (error && !user) {
    return (
      <section
        aria-live="assertive"
        className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 py-12 text-center"
        id="main-content"
      >
        <h1 className="text-2xl font-bold text-ink">No pudimos comprobar tu sesión</h1>
        <p className="text-ink-muted">{error}</p>
        <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            className="min-h-11 flex-1 rounded-control bg-brand px-5 text-sm font-semibold text-surface transition-colors duration-state hover:bg-brand-strong focus-visible:ring-4 focus-visible:ring-brand-soft"
            onClick={() => {
              const from = `${location.pathname}${location.search}`
              startLogin()
              navigate('/login', { replace: true, state: { from } })
            }}
            type="button"
          >
            Iniciar sesión nuevamente
          </button>
          <button
            className="min-h-11 flex-1 rounded-control border border-border bg-surface px-5 text-sm font-semibold text-ink transition-colors duration-state hover:border-border-strong hover:bg-surface-subtle focus-visible:ring-4 focus-visible:ring-brand-soft"
            onClick={() => void retry()}
            type="button"
          >
            Intentar nuevamente
          </button>
        </div>
      </section>
    )
  }

  if (!user) {
    return (
      <Navigate
        replace
        state={{ from: `${location.pathname}${location.search}` }}
        to="/login"
      />
    )
  }

  return <Outlet />
}
