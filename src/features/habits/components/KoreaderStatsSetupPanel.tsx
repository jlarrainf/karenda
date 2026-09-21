import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { EmptyState } from '../../../components/ui/EmptyState.tsx'
import { SelectField, TextField } from '../../../components/ui/FormField.tsx'
import { toAppError } from '../../../services/errors.ts'
import {
  getKoreaderIntegration,
  setupKoreaderHabitLinks,
  setKoreaderLinkStatus,
} from '../../../services/koreaderStatsService.ts'
import type { DeviceTokenMetadata } from '../../../types/deviceToken.ts'
import type {
  Habit,
  KoreaderHabitLink,
  KoreaderMetricKey,
} from '../../../types/domain.ts'
import {
  KOREADER_METRICS,
  type KoreaderMetricDefinition,
} from '../../../types/koreaderStats.ts'

interface KoreaderStatsSetupPanelProps {
  habits: Habit[]
  onConfigured?: () => void
}

interface NewMetricConfig {
  habitId: string
  name: string
  goalValue: string
  targetUnit: string
  conversionFactor: number
}

const DATE_FORMATTER = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function getTodayDate(): string {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim()
}

function formatLastSync(value: string | null): string {
  if (!value) return 'Aún no sincronizado'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : DATE_FORMATTER.format(date)
}

function inferConversion(
  metric: KoreaderMetricDefinition,
  unit: string | null,
): number {
  const normalizedUnit = normalize(unit)
  if (metric.sourceUnit !== 'minutes') return 1
  if (normalizedUnit.includes('hora') || normalizedUnit === 'h') return 1 / 60
  return 1
}

function isCompatibleHabit(metric: KoreaderMetricDefinition, habit: Habit): boolean {
  if (
    habit.trackingType !== metric.trackingType ||
    habit.lifecycleStatus === 'archived'
  ) {
    return false
  }

  const unit = normalize(habit.unit)
  if (metric.sourceUnit === 'minutes') {
    return unit.includes('min') || unit.includes('hora') || unit === 'h'
  }
  if (metric.sourceUnit === 'pages')
    return unit.includes('pagina') || unit.includes('page')
  if (metric.sourceUnit === 'books')
    return unit.includes('libro') || unit.includes('book')
  return (
    unit.includes('carta') ||
    unit.includes('tarjeta') ||
    unit.includes('card') ||
    unit.includes('anki')
  )
}

function createDefaultConfig(metric: KoreaderMetricDefinition): NewMetricConfig {
  return {
    conversionFactor: metric.sourceUnit === 'minutes' ? 1 / 60 : 1,
    goalValue: '1',
    habitId: '',
    name: metric.defaultName,
    targetUnit: metric.defaultUnit,
  }
}

function createInitialConfigs(habits: Habit[]) {
  return Object.fromEntries(
    KOREADER_METRICS.map((metric) => {
      const compatibleHabit = habits.find((habit) => isCompatibleHabit(metric, habit))
      const config = createDefaultConfig(metric)
      if (!compatibleHabit) return [metric.key, config]

      return [
        metric.key,
        {
          ...config,
          conversionFactor: inferConversion(metric, compatibleHabit.unit),
          habitId: compatibleHabit.id,
          targetUnit: compatibleHabit.unit ?? metric.defaultUnit,
        },
      ]
    }),
  ) as Record<KoreaderMetricKey, NewMetricConfig>
}

function deviceHasStatsScope(device: DeviceTokenMetadata): boolean {
  return (
    device.revoked_at === null &&
    (!device.expires_at || new Date(device.expires_at).getTime() > Date.now()) &&
    device.scopes.includes('write:habit_logs')
  )
}

function linkForMetric(
  links: KoreaderHabitLink[],
  metricKey: KoreaderMetricKey,
): KoreaderHabitLink | undefined {
  return links.find((link) => link.metricKey === metricKey && link.status !== 'revoked')
}

function metricHabitLabel(habit: Habit | undefined): string {
  return habit
    ? `${habit.name} · meta ${habit.goalValue} ${habit.unit ?? ''}`.trim()
    : ''
}

export function KoreaderStatsSetupPanel({
  habits,
  onConfigured,
}: KoreaderStatsSetupPanelProps) {
  const [devices, setDevices] = useState<DeviceTokenMetadata[]>([])
  const [links, setLinks] = useState<KoreaderHabitLink[]>([])
  const [configs, setConfigs] = useState<Record<KoreaderMetricKey, NewMetricConfig>>(
    () => createInitialConfigs(habits),
  )
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadIntegration = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getKoreaderIntegration()
      setDevices(result.devices)
      setLinks(result.links)
      setSelectedDeviceId((current) =>
        current &&
        result.devices.some(
          (device) => device.id === current && deviceHasStatsScope(device),
        )
          ? current
          : (result.devices.find(deviceHasStatsScope)?.id ?? ''),
      )
    } catch (value) {
      setError(
        toAppError(value, 'No se pudo cargar la configuración de KOReader.').message,
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void getKoreaderIntegration()
      .then((result) => {
        if (!active) return
        setDevices(result.devices)
        setLinks(result.links)
        setConfigs(createInitialConfigs(result.habits))
        setSelectedDeviceId((current) =>
          current &&
          result.devices.some(
            (device) => device.id === current && deviceHasStatsScope(device),
          )
            ? current
            : (result.devices.find(deviceHasStatsScope)?.id ?? ''),
        )
      })
      .catch((value) => {
        if (active) {
          setError(
            toAppError(value, 'No se pudo cargar la configuración de KOReader.')
              .message,
          )
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const statsDevices = useMemo(() => devices.filter(deviceHasStatsScope), [devices])
  const availableMetrics = useMemo(
    () => KOREADER_METRICS.filter((metric) => !linkForMetric(links, metric.key)),
    [links],
  )

  const updateConfig = (
    metricKey: KoreaderMetricKey,
    patch: Partial<NewMetricConfig>,
  ) => {
    setConfigs((current) => ({
      ...current,
      [metricKey]: { ...current[metricKey], ...patch },
    }))
  }

  const handleHabitChange = (metric: KoreaderMetricDefinition, habitId: string) => {
    const habit = habits.find((item) => item.id === habitId)
    if (!habit) {
      updateConfig(metric.key, {
        conversionFactor: metric.sourceUnit === 'minutes' ? 1 / 60 : 1,
        habitId: '',
        targetUnit: metric.defaultUnit,
      })
      return
    }

    updateConfig(metric.key, {
      conversionFactor: inferConversion(metric, habit.unit),
      habitId,
      targetUnit: habit.unit ?? metric.defaultUnit,
    })
  }

  const handleStatusChange = async (
    link: KoreaderHabitLink,
    status: 'active' | 'paused' | 'revoked',
  ) => {
    setError(null)
    try {
      await setKoreaderLinkStatus(link.id, status)
      setMessage(
        status === 'paused'
          ? 'La métrica quedó pausada.'
          : status === 'revoked'
            ? 'La métrica quedó desvinculada. Puedes asociarla a otro dispositivo.'
            : 'La métrica quedó activa.',
      )
      await loadIntegration()
    } catch (value) {
      setError(toAppError(value, 'No se pudo actualizar la métrica.').message)
    }
  }

  const handleSubmit = async () => {
    if (!selectedDeviceId || availableMetrics.length === 0) return
    const invalidMetric = availableMetrics.find((metric) => {
      const config = configs[metric.key]
      return (
        !config.habitId &&
        (!config.name.trim() ||
          !Number.isFinite(Number(config.goalValue)) ||
          Number(config.goalValue) <= 0)
      )
    })
    if (invalidMetric) {
      setError(
        `Completa el nombre y la meta de ${invalidMetric.label.toLocaleLowerCase('es')}.`,
      )
      return
    }

    setIsSaving(true)
    setError(null)
    setMessage(null)
    try {
      const result = await setupKoreaderHabitLinks({
        deviceTokenId: selectedDeviceId,
        timezone: getTimezone(),
        links: availableMetrics.map((metric) => {
          const config = configs[metric.key]
          return {
            conversionFactor: config.conversionFactor,
            goalValue: config.habitId ? undefined : Number(config.goalValue),
            habitId: config.habitId || undefined,
            metricKey: metric.key,
            name: config.habitId ? undefined : config.name.trim(),
            startDate: config.habitId ? undefined : getTodayDate(),
            targetUnit: config.targetUnit,
          }
        }),
      })
      setLinks((current) => [...current, ...result])
      setMessage(
        'Las estadísticas quedaron vinculadas. KOReader sincronizará el día actual al conectarse.',
      )
      onConfigured?.()
    } catch (value) {
      setError(
        toAppError(value, 'No se pudo guardar la configuración de estadísticas.')
          .message,
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <section
        aria-busy="true"
        className="rounded-panel border border-border bg-surface p-5"
        role="status"
      >
        <p className="text-sm text-ink-muted">Cargando integración con KOReader…</p>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="koreader-stats-title"
      className="space-y-5 rounded-panel border border-border bg-surface p-5"
    >
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand">
          Integración diaria
        </p>
        <h2 className="mt-2 text-xl font-bold text-ink" id="koreader-stats-title">
          Estadísticas de KOReader y Anki
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
          Las páginas, horas, libros terminados y cartas revisadas se guardan como
          registros diarios y alimentan los hábitos asociados. El mes y el año se
          calculan a partir de esos registros.
        </p>
      </div>

      {error ? (
        <p
          aria-live="assertive"
          className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          aria-live="polite"
          className="rounded-control bg-success-soft px-3 py-2 text-sm text-success"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {statsDevices.length === 0 ? (
        <EmptyState
          action={
            <a className="font-semibold text-brand underline" href="/devices">
              Ir a Dispositivos para habilitar estadísticas
            </a>
          }
          description="Necesitas un dispositivo vinculado con permiso de escritura de hábitos. El permiso solo permite enviar estadísticas diarias, no leer tus datos personales."
          title="No hay un Kindle preparado"
        />
      ) : (
        <>
          <SelectField
            id="koreader-stats-device"
            label="Dispositivo que enviará las estadísticas"
            onChange={(event) => setSelectedDeviceId(event.target.value)}
            value={selectedDeviceId}
          >
            {statsDevices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.label}
              </option>
            ))}
          </SelectField>

          {availableMetrics.length > 0 ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-ink">Métricas pendientes</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  Elige un hábito compatible o crea uno nuevo. La creación es opcional
                  por métrica.
                </p>
              </div>
              {availableMetrics.map((metric) => {
                const config = configs[metric.key]
                const compatibleHabits = habits.filter((habit) =>
                  isCompatibleHabit(metric, habit),
                )
                return (
                  <div
                    className="grid gap-4 rounded-control border border-border p-4 lg:grid-cols-[1.3fr_1fr]"
                    key={metric.key}
                  >
                    <div>
                      <h3 className="font-semibold text-ink">{metric.label}</h3>
                      <p className="mt-1 text-sm leading-6 text-ink-muted">
                        {metric.description}
                      </p>
                    </div>
                    <div className="space-y-4">
                      <SelectField
                        id={`koreader-habit-${metric.key}`}
                        label="Hábito"
                        onChange={(event) =>
                          handleHabitChange(metric, event.target.value)
                        }
                        value={config.habitId}
                      >
                        <option value="">Crear un hábito nuevo</option>
                        {compatibleHabits.map((habit) => (
                          <option key={habit.id} value={habit.id}>
                            {metricHabitLabel(habit)}
                          </option>
                        ))}
                      </SelectField>
                      {!config.habitId ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <TextField
                            id={`koreader-name-${metric.key}`}
                            label="Nombre"
                            onChange={(event) =>
                              updateConfig(metric.key, { name: event.target.value })
                            }
                            required
                            value={config.name}
                          />
                          <TextField
                            id={`koreader-goal-${metric.key}`}
                            label={`Meta diaria (${config.targetUnit})`}
                            min="0.01"
                            onChange={(event) =>
                              updateConfig(metric.key, {
                                goalValue: event.target.value,
                              })
                            }
                            required
                            step="any"
                            type="number"
                            value={config.goalValue}
                          />
                        </div>
                      ) : (
                        <p className="text-xs leading-5 text-ink-muted">
                          Se usará la unidad «{config.targetUnit}» del hábito existente.
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
              <Button
                isLoading={isSaving}
                loadingLabel="Guardando vínculos…"
                onClick={() => void handleSubmit()}
              >
                Vincular métricas pendientes
              </Button>
            </div>
          ) : null}

          {links.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-ink">Métricas vinculadas</h3>
              <ul className="divide-y divide-border rounded-control border border-border">
                {links.map((link) => {
                  const metric = KOREADER_METRICS.find(
                    (item) => item.key === link.metricKey,
                  )
                  const habit = habits.find((item) => item.id === link.habitId)
                  return (
                    <li
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                      key={link.id}
                    >
                      <div>
                        <p className="font-semibold text-ink">
                          {metric?.label ?? link.metricKey}
                        </p>
                        <p className="text-sm text-ink-muted">
                          {habit?.name ?? 'Hábito no disponible'} · Último envío:{' '}
                          {formatLastSync(link.lastSyncedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${link.status === 'active' ? 'bg-success-soft text-success' : link.status === 'revoked' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`}
                        >
                          {link.status === 'active'
                            ? 'Activa'
                            : link.status === 'revoked'
                              ? 'Revocada'
                              : 'Pausada'}
                        </span>
                        {link.status !== 'revoked' ? (
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() =>
                                void handleStatusChange(
                                  link,
                                  link.status === 'active' ? 'paused' : 'active',
                                )
                              }
                              variant="ghost"
                            >
                              {link.status === 'active' ? 'Pausar' : 'Reanudar'}
                            </Button>
                            <Button
                              onClick={() => void handleStatusChange(link, 'revoked')}
                              variant="ghost"
                            >
                              Desvincular
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
