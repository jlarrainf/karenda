import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSessionStore } from '../../stores/sessionStore.ts'

interface AccountPanelProps {
  email: string
  error: string | null
  isLoading: boolean
  onSignOut: () => Promise<void>
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
        width="17"
        x="3.5"
        y="5"
      />
      <path
        d="M7.5 3.5V7M16.5 3.5V7M3.5 9.5H20.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M8 13H8.01M12 13H12.01M16 13H16.01M8 17H8.01M12 17H12.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
    </svg>
  )
}

function HabitIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 20.5C12 14.5 10.5 10 6 7.5C5.5 12 7.5 16.5 12 20.5ZM12 20.5C12 14.5 13.5 10 18 7.5C18.5 12 16.5 16.5 12 20.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 20.5V5.5M12 9C10.5 6 8.5 4.5 6 3.5M12 9C13.5 6 15.5 4.5 18 3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5V5.5ZM5 5.5V19"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9 7H15M9 11H15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 3.5H15L19 7.5V20.5H6A2 2 0 0 1 4 18.5V5.5A2 2 0 0 1 6 3.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M14.5 3.5V8H19M8 12H15M8 16H15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.5 6.5A1.5 1.5 0 0 1 5 5h5l2 2h7A1.5 1.5 0 0 1 20.5 8.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-11Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M3.5 9H20.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 7H20M4 12H20M4 17H20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 6L18 18M18 6L6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M13 8L17 12L13 16M9 12H17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function DeviceIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        height="17"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
        width="12"
        x="6"
        y="3.5"
      />
      <path
        d="M10 17.5H14M9 6.5H15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-control bg-brand text-sm font-bold text-surface"
    >
      K
    </span>
  )
}

function navigationClassName({ isActive }: { isActive: boolean }) {
  return [
    'group flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-semibold transition-colors duration-state focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft touch-manipulation',
    isActive
      ? 'bg-brand-soft text-brand'
      : 'text-ink-muted hover:bg-surface-strong hover:text-ink',
  ].join(' ')
}

function primaryNavigationClassName({ isActive }: { isActive: boolean }) {
  return [
    'group flex min-h-12 items-center gap-3 rounded-control px-3 text-base font-semibold transition-colors duration-state focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft touch-manipulation',
    isActive
      ? 'bg-brand-soft text-brand'
      : 'text-ink-muted hover:bg-surface-strong hover:text-ink',
  ].join(' ')
}

function compactPrimaryNavigationClassName({ isActive }: { isActive: boolean }) {
  return [
    'group flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold transition-colors duration-state focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft touch-manipulation',
    isActive
      ? 'bg-brand-soft text-brand'
      : 'text-ink-muted hover:bg-surface-strong hover:text-ink',
  ].join(' ')
}

function PrimaryNavigation({
  compact = false,
  onNavigate,
}: {
  compact?: boolean
  onNavigate?: () => void
}) {
  const className = compact
    ? compactPrimaryNavigationClassName
    : primaryNavigationClassName

  return (
    <nav
      aria-label="Áreas principales"
      className={compact ? 'flex w-full gap-2 lg:hidden' : 'mt-3 space-y-1'}
    >
      <NavLink className={className} onClick={onNavigate} to="/calendar">
        <CalendarIcon className="size-5 shrink-0" />
        <span>Calendario</span>
      </NavLink>
      <NavLink className={className} onClick={onNavigate} to="/habits">
        <HabitIcon className="size-5 shrink-0" />
        <span>Hábitos</span>
      </NavLink>
      <NavLink className={className} onClick={onNavigate} to="/notes">
        <NoteIcon className="size-5 shrink-0" />
        <span>Notas</span>
      </NavLink>
    </nav>
  )
}

function SecondaryNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Organización y conexiones" className="mt-3 space-y-1">
      <NavLink className={navigationClassName} onClick={onNavigate} to="/subjects">
        <BookIcon className="size-5 shrink-0" />
        <span>Asignaturas</span>
      </NavLink>
      <NavLink
        className={navigationClassName}
        onClick={onNavigate}
        to="/personal-groups"
      >
        <FolderIcon className="size-5 shrink-0" />
        <span>Grupos personales</span>
      </NavLink>
      <NavLink className={navigationClassName} onClick={onNavigate} to="/devices">
        <DeviceIcon className="size-5 shrink-0" />
        <span>Dispositivos</span>
      </NavLink>
    </nav>
  )
}

function WorkspaceNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="space-y-7">
      <section aria-label="Accesos principales">
        <p className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          Accesos principales
        </p>
        <PrimaryNavigation onNavigate={onNavigate} />
      </section>

      <section
        aria-label="Organización y conexiones"
        className="border-t border-border pt-6"
      >
        <p className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          Organización y conexiones
        </p>
        <SecondaryNavigation onNavigate={onNavigate} />
      </section>
    </div>
  )
}

function getPageMeta(pathname: string) {
  if (pathname.startsWith('/habits')) {
    return {
      title: 'Hábitos',
      description: 'Registra tus avances y conserva tu historial',
    }
  }

  if (pathname.startsWith('/notes')) {
    return {
      title: 'Notas Markdown',
      description: 'Conserva tus apuntes junto a cada destino',
    }
  }

  if (pathname.startsWith('/subjects')) {
    return {
      title: 'Asignaturas',
      description: 'Organiza tus ramos y sus colores',
    }
  }

  if (pathname.startsWith('/personal-groups')) {
    return {
      title: 'Grupos personales',
      description: 'Agrupa tus compromisos fuera de clases',
    }
  }

  if (pathname.startsWith('/devices')) {
    return {
      title: 'Dispositivos',
      description: 'Administra el acceso de tus dispositivos',
    }
  }

  return {
    title: 'Calendario',
    description: 'Organiza tus compromisos con claridad',
  }
}

function AccountPanel({ email, error, isLoading, onSignOut }: AccountPanelProps) {
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="min-w-0 px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          Sesión activa
        </p>
        <p className="mt-1 truncate text-sm font-medium text-ink" title={email}>
          {email}
        </p>
      </div>
      {error ? (
        <p className="break-words px-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left text-sm font-semibold text-ink-muted transition-colors duration-state focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-danger-soft hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading}
        onClick={() => void onSignOut()}
        type="button"
      >
        <LogOutIcon className="size-5 shrink-0" />
        <span>{isLoading ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
      </button>
    </div>
  )
}

export function ProtectedLayout() {
  const location = useLocation()
  const user = useSessionStore((state) => state.user)
  const sessionError = useSessionStore((state) => state.error)
  const isLoading = useSessionStore((state) => state.isLoading)
  const signOut = useSessionStore((state) => state.signOut)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const appContentRef = useRef<HTMLDivElement>(null)
  const email = user?.email ?? 'Cuenta personal'
  const userInitial = email.charAt(0).toUpperCase()
  const pageMeta = getPageMeta(location.pathname)

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    window.requestAnimationFrame(() => menuButtonRef.current?.focus())
  }

  useEffect(() => {
    const appContent = appContentRef.current
    const previousOverflow = document.body.style.overflow

    if (appContent) {
      appContent.inert = isDrawerOpen
    }

    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden'
    }

    return () => {
      if (appContent) {
        appContent.inert = false
      }

      document.body.style.overflow = previousOverflow
    }
  }, [isDrawerOpen])

  useEffect(() => {
    if (!isDrawerOpen) {
      return
    }

    const previousFocus = document.activeElement as HTMLElement | null
    const focusableElements = Array.from(
      drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      ) ?? [],
    )

    focusableElements[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsDrawerOpen(false)
        window.requestAnimationFrame(() => menuButtonRef.current?.focus())
        return
      }

      if (event.key !== 'Tab' || focusableElements.length === 0) {
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocus && document.body.contains(previousFocus)) {
        previousFocus.focus()
      }
    }
  }, [isDrawerOpen])

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside
        aria-label="Barra lateral"
        className="hidden min-h-screen flex-col border-r border-border bg-surface-subtle px-4 py-5 lg:flex"
      >
        <Link
          className="flex items-center gap-3 rounded-control px-2 py-1 text-ink focus-visible:outline-offset-4"
          to="/calendar"
          translate="no"
        >
          <BrandMark />
          <span className="text-lg font-bold tracking-tight">Karenda</span>
        </Link>

        <div className="mt-10 flex-1">
          <WorkspaceNavigation />
        </div>

        <AccountPanel
          email={email}
          error={sessionError}
          isLoading={isLoading}
          onSignOut={signOut}
        />
      </aside>

      <div
        aria-hidden={isDrawerOpen || undefined}
        className="min-w-0"
        ref={appContentRef}
      >
        <header className="sticky top-0 z-30 border-b border-border bg-canvas px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                ref={menuButtonRef}
                aria-controls="mobile-navigation"
                aria-expanded={isDrawerOpen}
                aria-label="Abrir menú"
                className="grid size-11 place-items-center rounded-control text-ink-muted transition-colors duration-state focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft hover:bg-surface-strong hover:text-ink lg:hidden"
                onClick={() => setIsDrawerOpen(true)}
                type="button"
              >
                <MenuIcon className="size-5" />
              </button>
              <Link
                className="flex items-center gap-3 lg:hidden"
                to="/calendar"
                translate="no"
              >
                <BrandMark />
                <span className="font-bold tracking-tight text-ink">Karenda</span>
              </Link>
              <div className="hidden lg:block">
                <p className="text-sm font-semibold text-ink">{pageMeta.title}</p>
                <p className="text-xs text-ink-muted">{pageMeta.description}</p>
              </div>
            </div>

            <div
              aria-label={`Sesión de ${email}`}
              className="grid size-9 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand"
              title={email}
            >
              {userInitial}
            </div>
          </div>

          <div className="py-2">
            <PrimaryNavigation compact />
          </div>
        </header>

        <main
          className="min-h-[calc(100vh-7.5rem)] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:min-h-[calc(100vh-4rem)] lg:px-8 lg:py-8"
          id="main-content"
        >
          <div className="mx-auto w-full max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-ink/40"
            onClick={closeDrawer}
            type="button"
          />
          <aside
            aria-labelledby="mobile-navigation-title"
            aria-modal="true"
            className="relative z-10 flex h-full w-[min(20rem,calc(100%-3rem))] flex-col overflow-y-auto overscroll-contain bg-surface px-4 py-5 shadow-overlay"
            id="mobile-navigation"
            ref={drawerRef}
            role="dialog"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <BrandMark />
                <p className="font-bold text-ink" id="mobile-navigation-title">
                  Navegación
                </p>
              </div>
              <button
                aria-label="Cerrar menú"
                className="grid size-11 place-items-center rounded-control text-ink-muted transition-colors duration-state focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft hover:bg-surface-strong hover:text-ink"
                onClick={closeDrawer}
                type="button"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>

            <div className="mt-10">
              <WorkspaceNavigation onNavigate={closeDrawer} />
            </div>

            <div className="mt-auto pt-8">
              <AccountPanel
                email={email}
                error={sessionError}
                isLoading={isLoading}
                onSignOut={signOut}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
