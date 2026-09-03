import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NetworkStatus } from './NetworkStatus.tsx'

function setOnlineStatus(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  })
}

describe('NetworkStatus', () => {
  beforeEach(() => {
    setOnlineStatus(true)
  })

  afterEach(() => {
    setOnlineStatus(true)
  })

  it('does not render a banner while the device is online', () => {
    render(<NetworkStatus />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('announces when the connection is lost and recovered', async () => {
    render(<NetworkStatus />)

    await act(async () => {
      setOnlineStatus(false)
      window.dispatchEvent(new Event('offline'))
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Sin conexión. Comprueba tu conexión antes de guardar cambios.',
    )

    await act(async () => {
      setOnlineStatus(true)
      window.dispatchEvent(new Event('online'))
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
