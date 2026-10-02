import { z } from 'zod'
import { insforge } from '../lib/insforge/client.ts'
import type { Database } from '../lib/insforge/database.types.ts'
import type { KoreaderHabitLink, KoreaderMetricKey } from '../types/domain.ts'
import {
  KOREADER_METRICS,
  type KoreaderIntegrationResponse,
  type KoreaderSetupInput,
} from '../types/koreaderStats.ts'
import type { DeviceTokenMetadata } from '../types/deviceToken.ts'
import { runInsForge, runInsForgeAction } from './errors.ts'
import { requireCurrentUserId } from './authService.ts'
import { listHabits } from './habitService.ts'

const FUNCTION_NAME = 'karenda-koreader-habit-links'

const setupSchema = z.object({
  deviceTokenId: z.string().uuid('El dispositivo no es válido.'),
  timezone: z.string().trim().min(1, 'La zona horaria es obligatoria.'),
  links: z
    .array(
      z.object({
        metricKey: z.enum([
          'reading_pages',
          'reading_minutes',
          'books_completed',
          'anki_cards_reviewed',
        ]),
        habitId: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(160).optional(),
        description: z.string().max(2000).optional(),
        goalValue: z.number().finite().positive().optional(),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        targetUnit: z.string().trim().min(1).max(80),
        conversionFactor: z.number().finite().positive().optional(),
      }),
    )
    .min(1)
    .max(4),
})

type LinkRow = Database['public']['Tables']['koreader_habit_links']['Row']

interface IntegrationPayload {
  metrics: typeof KOREADER_METRICS
  devices: DeviceTokenMetadata[]
  links: LinkRow[]
}

interface SetupResponse {
  links: LinkRow[]
}

function mapLink(row: LinkRow): KoreaderHabitLink {
  return {
    autoCreated: row.auto_created,
    conversionFactor: row.conversion_factor,
    createdAt: row.created_at,
    deviceTokenId: row.device_token_id,
    habitId: row.habit_id,
    id: row.id,
    lastSyncedAt: row.last_synced_at,
    metricKey: row.metric_key,
    ownerId: row.owner_id,
    revokedAt: row.revoked_at,
    sourceUnit: row.source_unit,
    status: row.status,
    targetUnit: row.target_unit,
    timezone: row.timezone,
    updatedAt: row.updated_at,
  }
}

function invoke<T>(method: 'GET' | 'POST', body?: Record<string, unknown>) {
  return runInsForge(
    () =>
      insforge.functions.invoke<T>(FUNCTION_NAME, {
        method,
        ...(body ? { body } : {}),
      }),
    'No se pudo cargar la integración con KOReader.',
  )
}

export async function getKoreaderIntegration(): Promise<KoreaderIntegrationResponse> {
  await requireCurrentUserId()
  const [response, habits] = await Promise.all([
    invoke<IntegrationPayload>('GET'),
    listHabits(true),
  ])

  return {
    devices: response.devices,
    habits,
    links: response.links.map(mapLink),
    metrics: response.metrics ?? KOREADER_METRICS,
  }
}

export async function setupKoreaderHabitLinks(
  input: KoreaderSetupInput,
): Promise<KoreaderHabitLink[]> {
  await requireCurrentUserId()
  const parsed = setupSchema.parse(input)
  const response = await invoke<SetupResponse>('POST', {
    action: 'setup',
    device_token_id: parsed.deviceTokenId,
    timezone: parsed.timezone,
    links: parsed.links.map((link) => ({
      conversion_factor: link.conversionFactor ?? 1,
      description: link.description ?? null,
      goal_value: link.goalValue ?? null,
      habit_id: link.habitId ?? null,
      metric_key: link.metricKey,
      name: link.name ?? null,
      source_unit: KOREADER_METRICS.find((metric) => metric.key === link.metricKey)!
        .sourceUnit,
      start_date: link.startDate ?? null,
      target_unit: link.targetUnit,
    })),
  })

  return response.links.map(mapLink)
}

export async function setKoreaderLinkStatus(
  linkId: string,
  status: 'active' | 'paused' | 'revoked',
): Promise<void> {
  await requireCurrentUserId()
  await runInsForgeAction(
    () =>
      insforge.functions.invoke(FUNCTION_NAME, {
        method: 'POST',
        body: { action: 'status', link_id: linkId, status },
      }),
    'No se pudo actualizar el vínculo de KOReader.',
  )
}

export function getMetricDefinition(metricKey: KoreaderMetricKey) {
  return KOREADER_METRICS.find((metric) => metric.key === metricKey) ?? null
}
