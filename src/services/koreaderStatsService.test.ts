import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '../lib/insforge/database.types.ts'
import {
  getKoreaderIntegration,
  setupKoreaderHabitLinks,
} from './koreaderStatsService.ts'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listHabits: vi.fn(),
  requireCurrentUserId: vi.fn(),
}))

vi.mock('../lib/insforge/client.ts', () => ({
  insforge: { functions: { invoke: mocks.invoke } },
}))
vi.mock('./authService.ts', () => ({
  requireCurrentUserId: mocks.requireCurrentUserId,
}))
vi.mock('./habitService.ts', () => ({ listHabits: mocks.listHabits }))

type LinkRow = Database['public']['Tables']['koreader_habit_links']['Row']

const ownerId = '22222222-2222-4222-8222-222222222222'
const deviceId = '11111111-1111-4111-8111-111111111111'
const habitId = '33333333-3333-4333-8333-333333333333'
const timestamp = '2026-09-01T10:00:00.000Z'

const linkRow: LinkRow = {
  auto_created: true,
  conversion_factor: 1,
  created_at: timestamp,
  device_token_id: deviceId,
  habit_id: habitId,
  id: '44444444-4444-4444-8444-444444444444',
  last_synced_at: null,
  metric_key: 'reading_pages',
  owner_id: ownerId,
  revoked_at: null,
  source_unit: 'pages',
  status: 'active',
  target_unit: 'páginas',
  timezone: 'America/Santiago',
  updated_at: timestamp,
}

describe('koreaderStatsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireCurrentUserId.mockResolvedValue(ownerId)
    mocks.listHabits.mockResolvedValue([])
  })

  it('loads device metadata and maps link rows to the domain contract', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        devices: [],
        links: [linkRow],
        metrics: [],
      },
      error: null,
    })

    const result = await getKoreaderIntegration()

    expect(result.links[0]).toMatchObject({
      autoCreated: true,
      habitId,
      metricKey: 'reading_pages',
      sourceUnit: 'pages',
    })
    expect(mocks.invoke).toHaveBeenCalledWith('karenda-koreader-habit-links', {
      method: 'GET',
    })
  })

  it('sends an explicit setup payload with safe defaults', async () => {
    mocks.invoke.mockResolvedValue({ data: { links: [linkRow] }, error: null })

    await setupKoreaderHabitLinks({
      deviceTokenId: deviceId,
      links: [
        {
          metricKey: 'reading_minutes',
          targetUnit: 'horas',
          conversionFactor: 1 / 60,
          goalValue: 1,
          name: 'Leer',
          startDate: '2026-09-01',
        },
      ],
      timezone: 'America/Santiago',
    })

    expect(mocks.invoke).toHaveBeenCalledWith('karenda-koreader-habit-links', {
      body: {
        action: 'setup',
        device_token_id: deviceId,
        links: [
          expect.objectContaining({
            conversion_factor: 1 / 60,
            metric_key: 'reading_minutes',
            source_unit: 'minutes',
            target_unit: 'horas',
          }),
        ],
        timezone: 'America/Santiago',
      },
      method: 'POST',
    })
  })
})
