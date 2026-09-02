import { Outlet } from 'react-router-dom'

export function AppShell() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        className="sr-only z-50 rounded-control bg-brand px-4 py-3 font-semibold text-surface focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4"
        href="#main-content"
      >
        Saltar al contenido principal
      </a>
      <Outlet />
    </div>
  )
}
