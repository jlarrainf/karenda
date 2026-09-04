import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.overflow = ''
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
    })
  })

  it('follows scroll direction continuously and settles the header smoothly', () => {
    vi.useFakeTimers()

    render(
      <MemoryRouter>
        <ProtectedLayout />
      </MemoryRouter>,
    )

    const header = screen.getByRole('banner')
    Object.defineProperty(header, 'offsetHeight', {
      configurable: true,
      value: 100,
    })

    expect(header).not.toHaveStyle({ transform: 'translate3d(0, -100px, 0)' })

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 30 })
    fireEvent.scroll(window)
    expect(header).toHaveStyle({ transform: 'translate3d(0, -30px, 0)' })

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 60 })
    fireEvent.scroll(window)
    expect(header).toHaveStyle({ transform: 'translate3d(0, -60px, 0)' })

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 20 })
    fireEvent.scroll(window)

    expect(header).toHaveStyle({ transform: 'translate3d(0, -20px, 0)' })

    vi.advanceTimersByTime(140)

    expect(header).toHaveStyle({ transform: 'translate3d(0, 0px, 0)' })
    expect(header.style.transition).toContain('220ms')
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

  it('keeps calendar, habits, and notes available as primary destinations', () => {
    render(
      <MemoryRouter>
        <ProtectedLayout />
      </MemoryRouter>,
    )

    expect(
      screen.getAllByRole('navigation', { name: 'Áreas principales' }),
    ).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Calendario' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Hábitos' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Notas' })).toHaveLength(2)
    expect(screen.getByText('Organización y conexiones')).toBeVisible()
    expect(document.querySelectorAll('img[src="/karenda-app-icon.png"]')).toHaveLength(2)
  })
})
