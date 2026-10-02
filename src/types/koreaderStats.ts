import type { Habit, KoreaderHabitLink, KoreaderMetricKey } from './domain.ts'
import type { DeviceTokenMetadata } from './deviceToken.ts'

export interface KoreaderMetricDefinition {
  key: KoreaderMetricKey
  label: string
  description: string
  sourceUnit: 'pages' | 'minutes' | 'books' | 'cards'
  trackingType: 'count' | 'duration'
  defaultName: string
  defaultUnit: string
}

export const KOREADER_METRICS: KoreaderMetricDefinition[] = [
  {
    key: 'reading_pages',
    label: 'Páginas leídas',
    description: 'Páginas distintas registradas por KOReader.',
    sourceUnit: 'pages',
    trackingType: 'count',
    defaultName: 'Leer páginas',
    defaultUnit: 'páginas',
  },
  {
    key: 'reading_minutes',
    label: 'Tiempo de lectura',
    description: 'Tiempo acumulado de lectura, mostrado en horas.',
    sourceUnit: 'minutes',
    trackingType: 'duration',
    defaultName: 'Leer',
    defaultUnit: 'horas',
  },
  {
    key: 'books_completed',
    label: 'Libros terminados',
    description: 'Libros que KOReader pudo confirmar como terminados.',
    sourceUnit: 'books',
    trackingType: 'count',
    defaultName: 'Terminar libros',
    defaultUnit: 'libros',
  },
  {
    key: 'anki_cards_reviewed',
    label: 'Cartas revisadas de Anki',
    description: 'Cartas revisadas por día en el proveedor de Anki del Kindle.',
    sourceUnit: 'cards',
    trackingType: 'count',
    defaultName: 'Revisar Anki',
    defaultUnit: 'cartas',
  },
]

export interface KoreaderIntegrationResponse {
  metrics: KoreaderMetricDefinition[]
  devices: DeviceTokenMetadata[]
  habits: Habit[]
  links: KoreaderHabitLink[]
}

export interface KoreaderSetupInput {
  deviceTokenId: string
  timezone: string
  links: Array<{
    metricKey: KoreaderMetricKey
    habitId?: string
    name?: string
    description?: string
    goalValue?: number
    startDate?: string
    targetUnit: string
    conversionFactor?: number
  }>
}

export type KoreaderStatsPeriod = 'day' | 'month' | 'year'

export interface KoreaderStatsSummary {
  rangeStart: string
  rangeEnd: string
  total: number
  label: string
}
