import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceTokensPage } from './DeviceTokensPage.tsx'

const mocks = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn(),
  createDevicePairingCode: vi.fn(),
  createDeviceToken: vi.fn(),
  disableDeviceEventStatus: vi.fn(),
  enableDeviceEventStatus: vi.fn(),
  listDeviceTokens: vi.fn(),
  regenerateDeviceToken: vi.fn(),
  revokeDeviceToken: vi.fn(),
}))

vi.mock('../../../services/deviceTokenService.ts', () => mocks)
vi.mock('../../../lib/browser/clipboard.ts', () => mocks)

const activeToken = {
  created_at: '2026-08-30T20:00:00.000Z',
  expires_at: null,
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Kindle de estudio',
  last_used_at: null,
  revoked_at: null,
  scopes: ['read:snapshot'] as const,
  updated_at: '2026-08-30T20:00:00.000Z',
}

const eventStatusToken = {
  ...activeToken,
  scopes: ['read:snapshot', 'write:habit_logs', 'write:event_status'] as const,
}

const createdToken = {
  message: 'Copia este token ahora.',
  token: 'one-time-device-secret',
  token_metadata: activeToken,
}

const createdPairingCode = {
  expires_at: '2026-08-30T20:10:00.000Z',
  message: 'El código vence en 10 minutos y solo puede usarse una vez.',
  pairing_code: '042731',
}

describe('DeviceTokensPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listDeviceTokens.mockResolvedValue([activeToken])
    mocks.createDevicePairingCode.mockResolvedValue(createdPairingCode)
    mocks.createDeviceToken.mockResolvedValue(createdToken)
    mocks.disableDeviceEventStatus.mockResolvedValue(undefined)
    mocks.enableDeviceEventStatus.mockResolvedValue(undefined)
    mocks.regenerateDeviceToken.mockResolvedValue(createdToken)
    mocks.revokeDeviceToken.mockResolvedValue(undefined)
    mocks.copyTextToClipboard.mockResolvedValue(undefined)
  })

  it('loads metadata and shows a one-time pairing code', async () => {
    const user = userEvent.setup()

    render(<DeviceTokensPage />)

    expect(await screen.findByText('Kindle de estudio')).toBeInTheDocument()
    expect(screen.queryByText('one-time-device-secret')).not.toBeInTheDocument()

    const label = screen.getByLabelText('Nombre del dispositivo')
    await user.clear(label)
    await user.type(label, 'Kindle biblioteca')
    await user.click(screen.getByRole('button', { name: 'Generar código' }))

    expect(mocks.createDevicePairingCode).toHaveBeenCalledWith('Kindle biblioteca', [
      'read:snapshot',
    ])
    expect(await screen.findByText('042731')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copiar código' }))

    expect(mocks.copyTextToClipboard).toHaveBeenCalledWith('042731')
    expect(screen.getByText('Código copiado al portapapeles.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ocultar código' }))
    expect(screen.queryByText('042731')).not.toBeInTheDocument()
  })

  it('requires confirmation before revoking an active device', async () => {
    const user = userEvent.setup()

    render(<DeviceTokensPage />)

    await screen.findByText('Kindle de estudio')
    await user.click(screen.getByRole('button', { name: 'Revocar token' }))

    const dialog = screen.getByRole('alertdialog', { name: '¿Revocar token?' })
    expect(dialog).toBeVisible()
    expect(mocks.revokeDeviceToken).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Revocar token' }))

    await waitFor(() => {
      expect(mocks.revokeDeviceToken).toHaveBeenCalledWith(activeToken.id)
    })
  })

  it('grants event status only after confirmation without rotating the token', async () => {
    const user = userEvent.setup()

    render(<DeviceTokensPage />)

    await screen.findByText('Kindle de estudio')
    await user.click(screen.getByRole('button', { name: 'Permitir cambios de estado' }))

    const dialog = screen.getByRole('alertdialog', { name: '¿Permitir cambios de estado?' })
    expect(dialog).toBeVisible()
    expect(dialog).toHaveTextContent('eventos de tu cuenta como pendientes o completados')
    expect(mocks.enableDeviceEventStatus).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Permitir cambios de estado' }))

    await waitFor(() => {
      expect(mocks.enableDeviceEventStatus).toHaveBeenCalledWith(activeToken.id)
    })
    expect(mocks.regenerateDeviceToken).not.toHaveBeenCalled()
  })

  it('retires only the event status permission from an active device', async () => {
    const user = userEvent.setup()
    mocks.listDeviceTokens.mockResolvedValue([eventStatusToken])

    render(<DeviceTokensPage />)

    await screen.findByText('Kindle de estudio')
    expect(screen.getByText('Lectura del calendario, Escritura de hábitos desde KOReader, Cambiar estado de eventos desde InkDesk')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retirar permiso' }))

    const dialog = screen.getByRole('alertdialog', { name: '¿Retirar el permiso de cambio de estado?' })
    expect(dialog).toHaveTextContent('conservará el permiso de lectura y su token actual')
    await user.click(within(dialog).getByRole('button', { name: 'Retirar permiso' }))

    await waitFor(() => {
      expect(mocks.disableDeviceEventStatus).toHaveBeenCalledWith(activeToken.id)
    })
    expect(mocks.regenerateDeviceToken).not.toHaveBeenCalled()
  })

  it('hides event status permission actions for revoked devices', async () => {
    mocks.listDeviceTokens.mockResolvedValue([{
      ...eventStatusToken,
      revoked_at: '2026-09-01T00:00:00.000Z',
    }])

    render(<DeviceTokensPage />)

    await screen.findByText('Kindle de estudio')
    expect(screen.queryByRole('button', { name: 'Permitir cambios de estado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retirar permiso' })).not.toBeInTheDocument()
  })
})
