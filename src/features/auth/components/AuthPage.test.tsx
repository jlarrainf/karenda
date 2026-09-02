import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage.tsx'

const mocks = vi.hoisted(() => ({
  clearError: vi.fn(),
  error: null as string | null,
  isLoading: false,
  register: vi.fn(),
  signIn: vi.fn(),
  verifyEmail: vi.fn(),
}))

vi.mock('../../../stores/sessionStore.ts', () => ({
  useSessionStore: (selector: (state: typeof mocks) => unknown) => selector(mocks),
}))

function renderAuthPage(mode: 'login' | 'register') {
  return render(
    <MemoryRouter>
      <AuthPage mode={mode} />
    </MemoryRouter>,
  )
}

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.error = null
    mocks.isLoading = false
  })

  it('shows Spanish login validation without calling the session store', async () => {
    const user = userEvent.setup()
    renderAuthPage('login')

    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('Ingresa tu correo electrónico.')).toBeVisible()
    expect(screen.getByText('Ingresa tu contraseña.')).toBeVisible()
    expect(mocks.signIn).not.toHaveBeenCalled()
  })

  it('rejects mismatched registration passwords before calling InsForge', async () => {
    const user = userEvent.setup()
    renderAuthPage('register')

    await user.type(screen.getByLabelText('Correo electrónico'), 'student@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'secret-password')
    await user.type(screen.getByLabelText('Repite tu contraseña'), 'different-password')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText('Las contraseñas deben coincidir.')).toBeVisible()
    expect(mocks.register).not.toHaveBeenCalled()
  })

  it('passes valid login credentials to the session store', async () => {
    const user = userEvent.setup()
    mocks.signIn.mockResolvedValue({
      accessToken: 'token',
      user: { email: 'student@example.com', id: 'user-1' },
    })
    renderAuthPage('login')

    await user.type(screen.getByLabelText('Correo electrónico'), 'student@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'secret-password')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    await vi.waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce())
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: 'student@example.com',
      password: 'secret-password',
    })
  })
})
