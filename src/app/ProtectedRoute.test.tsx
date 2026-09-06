import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute.tsx'

const sessionState = {
  error: 'No se pudo conectar con Karenda. Revisa tu conexión e inténtalo nuevamente.',
  initialize: vi.fn(),
  isInitialized: true,
  isLoading: false,
  retry: vi.fn(),
  startLogin: vi.fn(),
  user: null,
}

vi.mock('./../stores/sessionStore.ts', () => ({
  useSessionStore: (selector?: (state: typeof sessionState) => unknown) => (
    selector ? selector(sessionState) : sessionState
  ),
}))

function LocationLabel() {
  const location = useLocation()
  return <p>Ruta actual: {location.pathname}</p>
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('offers a login recovery action and preserves the protected destination', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/canvas']}>
        <Routes>
          <Route element={<ProtectedRoute />} path="*">
            <Route element={<LocationLabel />} path="canvas" />
          </Route>
          <Route element={<LocationLabel />} path="/login" />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Iniciar sesión nuevamente' }))

    expect(sessionState.startLogin).toHaveBeenCalledOnce()
    expect(screen.getByText('Ruta actual: /login')).toBeVisible()
  })
})
