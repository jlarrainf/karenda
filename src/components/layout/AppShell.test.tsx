import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppShell } from './AppShell.tsx'

describe('AppShell', () => {
  it('reserves the injected top safe area for Android system bars', () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Saltar al contenido principal' }).parentElement).toHaveClass(
      'pt-[var(--safe-area-inset-top)]',
    )
  })
})
