import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/insforge/client.ts', () => ({
  isInsForgeConfigured: false,
}))

import App from './App.tsx'

describe('App', () => {
  it('shows the official brand icon on the configuration screen', () => {
    render(<App />)

    expect(screen.getByText('Karenda')).toBeVisible()
    expect(document.querySelector('img[src="/karenda-app-icon.png"]')).toBeInTheDocument()
  })
})
