import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProtectedLayout } from './ProtectedLayout.tsx'

const mocks = vi.hoisted(() => ({
  error: null as string | null,
  isLoading: false,
  signOut: vi.fn().mockResolvedValue(undefined),
  user: { email: 'student@example.com' },
}))

vi.mock('../../stores/sessionStore.ts', () => ({
  useSessionStore: (selector: (state: typeof mocks) => unknown) => selector(mocks),
}))

describe('ProtectedLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.overflow = ''
  })

  it('traps mobile drawer focus and makes the page content inert', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <ProtectedLayout />
      </MemoryRouter>,
    )

    const menuButton = screen.getByRole('button', { name: 'Abrir menú' })
    await user.click(menuButton)

    const dialog = screen.getByRole('dialog', { name: 'Navegación' })
    const appContent = document.querySelector('div[aria-hidden="true"]')

    expect(dialog).toBeVisible()
    expect(appContent).toHaveProperty('inert', true)
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Navegación' })).not.toBeInTheDocument()
    expect(menuButton).toHaveFocus()
    expect(appContent).toHaveProperty('inert', false)
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps calendar and notes available as primary destinations', () => {
    render(
      <MemoryRouter>
        <ProtectedLayout />
      </MemoryRouter>,
    )

    expect(
      screen.getAllByRole('navigation', { name: 'Áreas principales' }),
    ).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Calendario' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Notas' })).toHaveLength(2)
    expect(screen.getByText('Organización y conexiones')).toBeVisible()
  })
})
