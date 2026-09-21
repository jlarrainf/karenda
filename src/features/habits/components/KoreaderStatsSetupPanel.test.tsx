import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { KoreaderStatsSetupPanel } from './KoreaderStatsSetupPanel.tsx'

const mocks = vi.hoisted(() => ({
  getKoreaderIntegration: vi.fn(),
  setKoreaderLinkStatus: vi.fn(),
  setupKoreaderHabitLinks: vi.fn(),
}))

vi.mock('../../../services/koreaderStatsService.ts', () => mocks)

const device = {
  created_at: '2026-09-01T10:00:00.000Z',
  expires_at: null,
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Kindle de estudio',
  last_used_at: null,
  revoked_at: null,
  scopes: ['read:snapshot', 'write:habit_logs'] as const,
  updated_at: '2026-09-01T10:00:00.000Z',
}

describe('KoreaderStatsSetupPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getKoreaderIntegration.mockResolvedValue({
      devices: [device],
      habits: [],
      links: [],
      metrics: [],
    })
    mocks.setupKoreaderHabitLinks.mockResolvedValue([
      {
        autoCreated: true,
        conversionFactor: 1,
        createdAt: '2026-09-01T10:00:00.000Z',
        deviceTokenId: device.id,
        habitId: '22222222-2222-4222-8222-222222222222',
        id: '33333333-3333-4333-8333-333333333333',
        lastSyncedAt: null,
        metricKey: 'reading_pages',
        ownerId: '44444444-4444-4444-8444-444444444444',
        revokedAt: null,
        sourceUnit: 'pages',
        status: 'active',
        targetUnit: 'páginas',
        timezone: 'America/Santiago',
        updatedAt: '2026-09-01T10:00:00.000Z',
      },
    ])
  })

  it('requires a stats-enabled device and sends explicit new-habit goals', async () => {
    const user = userEvent.setup()
    render(<KoreaderStatsSetupPanel habits={[]} />)

    expect(await screen.findByText('Kindle de estudio')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Vincular métricas pendientes' }),
    )

    await waitFor(() => expect(mocks.setupKoreaderHabitLinks).toHaveBeenCalledOnce())
    const request = mocks.setupKoreaderHabitLinks.mock.calls[0][0]
    expect(request.deviceTokenId).toBe(device.id)
    expect(request.links).toHaveLength(4)
    expect(request.links[0]).toMatchObject({
      goalValue: 1,
      metricKey: 'reading_pages',
      name: 'Leer páginas',
      targetUnit: 'páginas',
    })
  })
})
