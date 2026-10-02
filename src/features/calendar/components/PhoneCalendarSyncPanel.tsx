import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { useCalendarStore } from '../../../stores/calendarStore.ts'
import { useCatalogStore } from '../../../stores/catalogStore.ts'
import { toAppError } from '../../../services/errors.ts'
import {
  getPhoneCalendarSyncStatus,
  requestPhoneCalendarPermission,
  setPhoneCalendarSyncEnabled,
  syncPhoneCalendar,
  type PhoneCalendarSyncStatus,
} from '../../../services/phoneCalendarSyncService.ts'

interface SyncFeedback {
  kind: 'error' | 'success'
  message: string
}

function createUnavailableStatus(): PhoneCalendarSyncStatus {
  return {
    available: false,
    enabled: false,
    lastSyncedAt: null,
    eventCount: 0,
    calendarCount: 0,
  }
}

function formatLastSync(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'sin fecha disponible'

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function PhoneCalendarSyncPanel() {
  const events = useCalendarStore((state) => state.events)
  const eventMutationVersion = useCalendarStore((state) => state.eventMutationVersion)
  const calendarIsLoaded = useCalendarStore((state) => state.isLoaded)
  const subjects = useCatalogStore((state) => state.subjects)
  const personalGroups = useCatalogStore((state) => state.personalGroups)
  const catalogIsLoaded = useCatalogStore((state) => state.isLoaded)
  const [status, setStatus] = useState<PhoneCalendarSyncStatus | null>(null)
  const [feedback, setFeedback] = useState<SyncFeedback | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const syncLock = useRef(false)
  const syncPending = useRef(false)
  const lastAutomaticFingerprint = useRef<string | null>(null)
  const runSyncRef = useRef<(showSuccess: boolean) => Promise<void>>(
    async () => undefined,
  )

  const dataFingerprint = useMemo(
    () =>
      JSON.stringify({
        eventMutationVersion,
        events: events.map((event) => [event.id, event.updatedAt]),
        subjects: subjects.map((subject) => [subject.id, subject.updatedAt]),
        personalGroups: personalGroups.map((group) => [group.id, group.updatedAt]),
      }),
    [eventMutationVersion, events, personalGroups, subjects],
  )

  const runSync = useCallback(async (showSuccess: boolean) => {
    if (syncLock.current) {
      syncPending.current = true
      return
    }
    syncLock.current = true
    setIsSyncing(true)
    setFeedback(null)

    try {
      const nextStatus = await syncPhoneCalendar()
      setStatus(nextStatus)
      if (showSuccess) {
        setFeedback({
          kind: 'success',
          message: `Se sincronizaron ${nextStatus.eventCount} eventos en ${nextStatus.calendarCount} calendarios.`,
        })
      }
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: toAppError(error, 'No se pudo sincronizar el calendario del teléfono.')
          .message,
      })
    } finally {
      syncLock.current = false
      setIsSyncing(false)
      if (syncPending.current) {
        syncPending.current = false
        window.setTimeout(() => {
          void runSyncRef.current(false)
        }, 0)
      }
    }
  }, [])

  useEffect(() => {
    runSyncRef.current = runSync
  }, [runSync])

  useEffect(() => {
    let isMounted = true
    void getPhoneCalendarSyncStatus()
      .then((nextStatus) => {
        if (isMounted) setStatus(nextStatus)
      })
      .catch((error: unknown) => {
        if (!isMounted) return
        setStatus(createUnavailableStatus())
        setFeedback({
          kind: 'error',
          message: toAppError(error, 'No se pudo revisar el calendario del teléfono.')
            .message,
        })
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (
      !status?.available ||
      !status.enabled ||
      !calendarIsLoaded ||
      !catalogIsLoaded ||
      lastAutomaticFingerprint.current === dataFingerprint
    ) {
      return
    }

    lastAutomaticFingerprint.current = dataFingerprint
    void runSync(false)
  }, [
    calendarIsLoaded,
    catalogIsLoaded,
    dataFingerprint,
    runSync,
    status?.available,
    status?.enabled,
  ])

  useEffect(() => {
    if (!status?.available || !status.enabled) return

    const interval = window.setInterval(
      () => {
        void runSyncRef.current(false)
      },
      15 * 60 * 1000,
    )
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runSyncRef.current(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [status?.available, status?.enabled])

  const handleConnect = async () => {
    setIsConnecting(true)
    setFeedback(null)
    try {
      const permissionGranted = await requestPhoneCalendarPermission()
      if (!permissionGranted) {
        setFeedback({
          kind: 'error',
          message:
            'No se concedió el permiso. Actívalo en Ajustes > Aplicaciones > Karenda > Permisos > Calendario y vuelve a conectar.',
        })
        return
      }

      await setPhoneCalendarSyncEnabled(true)
      lastAutomaticFingerprint.current = dataFingerprint
      setStatus((current) => ({
        ...(current ?? createUnavailableStatus()),
        available: true,
        enabled: true,
      }))
      await runSync(true)
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: toAppError(error, 'No se pudo conectar el calendario del teléfono.')
          .message,
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const handlePause = async () => {
    try {
      await setPhoneCalendarSyncEnabled(false)
      setStatus((current) => (current ? { ...current, enabled: false } : current))
      setFeedback({
        kind: 'success',
        message:
          'La sincronización quedó pausada. Las copias que ya están en el teléfono se conservarán.',
      })
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: toAppError(error, 'No se pudo pausar la sincronización.').message,
      })
    }
  }

  return (
    <section
      aria-labelledby="phone-calendar-sync-title"
      className="rounded-control border border-border bg-surface px-4 py-4"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h2 id="phone-calendar-sync-title" className="text-lg font-semibold text-ink">
            Calendario del teléfono
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {status === null
              ? 'Comprobando si Karenda puede usar el calendario Android.'
              : !status.available
                ? 'La conexión directa está disponible en la app Android de Karenda. Abre la app instalada en tu POCO F6 para activarla.'
                : status.enabled
                  ? 'Karenda actualiza una copia local separada por asignatura y grupo personal.'
                  : status.lastSyncedAt
                    ? 'La sincronización está pausada. Las copias existentes se conservan en el teléfono.'
                    : 'Conecta copias locales por asignatura y grupo. No necesitas Google Calendar; Android pedirá permiso al conectar.'}
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Se sincroniza al guardar, al abrir Karenda y cada 15 minutos mientras está
            abierta. Cerrada, se actualiza cuando vuelvas a abrirla. No se crean alarmas
            automáticas. Huawei Health podrá mostrar la agenda si reconoce estos
            calendarios locales del teléfono.
          </p>
          {status?.available && status.lastSyncedAt ? (
            <p className="mt-2 text-sm text-ink-muted">
              Última sincronización: {formatLastSync(status.lastSyncedAt)} ·{' '}
              {status.eventCount} eventos en {status.calendarCount} calendarios.
            </p>
          ) : null}
        </div>

        {status?.available ? (
          <div className="flex flex-wrap gap-2">
            {status.enabled ? (
              <>
                <Button
                  isLoading={isSyncing}
                  loadingLabel="Sincronizando…"
                  onClick={() => void runSync(true)}
                  variant="secondary"
                >
                  Sincronizar ahora
                </Button>
                <Button
                  disabled={isSyncing}
                  onClick={() => void handlePause()}
                  variant="ghost"
                >
                  Pausar
                </Button>
              </>
            ) : (
              <Button
                isLoading={isConnecting || isSyncing}
                loadingLabel={status.lastSyncedAt ? 'Reanudando…' : 'Conectando…'}
                onClick={() => void handleConnect()}
              >
                {status.lastSyncedAt
                  ? 'Reanudar sincronización'
                  : 'Conectar calendario del teléfono'}
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {feedback ? (
        <p
          aria-live="polite"
          className={
            feedback.kind === 'error'
              ? 'mt-3 rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-sm leading-6 text-danger'
              : 'mt-3 rounded-control border border-success/30 bg-success-soft px-3 py-2 text-sm leading-6 text-success'
          }
          role={feedback.kind === 'error' ? 'alert' : undefined}
        >
          {feedback.message}
        </p>
      ) : null}

      {status?.available ? (
        <details className="mt-3 border-t border-border pt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-brand underline underline-offset-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft">
            Ver asignaturas y grupos sincronizados
          </summary>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Asignaturas</h3>
              {subjects.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {subjects.map((subject) => (
                    <li
                      key={subject.id}
                      className="flex items-center gap-2 text-sm text-ink-muted"
                    >
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: subject.color }}
                      />
                      {subject.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">Aún no hay asignaturas.</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Grupos personales</h3>
              {personalGroups.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {personalGroups.map((group) => (
                    <li
                      key={group.id}
                      className="flex items-center gap-2 text-sm text-ink-muted"
                    >
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: group.color ?? '#7A8780' }}
                      />
                      {group.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">
                  Aún no hay grupos personales.
                </p>
              )}
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            Los cambios se originan en Karenda; las ediciones del teléfono no se
            importan. Karenda no crea recordatorios automáticos.
          </p>
        </details>
      ) : null}
    </section>
  )
}
