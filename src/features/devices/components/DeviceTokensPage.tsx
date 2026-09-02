import { useEffect, useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.tsx'
import { EmptyState } from '../../../components/ui/EmptyState.tsx'
import { copyTextToClipboard } from '../../../lib/browser/clipboard.ts'
import {
  createDevicePairingCode as createDevicePairingCodeRequest,
  listDeviceTokens,
  regenerateDeviceToken,
  revokeDeviceToken,
} from '../../../services/deviceTokenService.ts'
import type {
  CreatedPairingCode,
  CreatedDeviceToken,
  DeviceTokenMetadata,
} from '../../../types/deviceToken.ts'

type PendingAction =
  | { kind: 'regenerate'; token: DeviceTokenMetadata }
  | { kind: 'revoke'; token: DeviceTokenMetadata }
  | null

type CopyStatus = 'idle' | 'copied' | 'error'

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(value: string | null): string {
  if (!value) {
    return 'Todavía no usado'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : dateFormatter.format(date)
}

function formatScope(scope: string): string {
  return scope === 'read:snapshot' ? 'Lectura del calendario' : 'Escritura futura'
}

function getTokenStatus(token: DeviceTokenMetadata): {
  label: string
  className: string
} {
  if (token.revoked_at) {
    return {
      className: 'bg-danger-soft text-danger',
      label: 'Revocado',
    }
  }

  if (token.expires_at && new Date(token.expires_at).getTime() <= Date.now()) {
    return {
      className: 'bg-warning-soft text-warning',
      label: 'Expirado',
    }
  }

  return {
    className: 'bg-success-soft text-success',
    label: 'Activo',
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function PairingCodePanel({
  pairingCode,
  copyStatus,
  onCopy,
  onHide,
}: {
  pairingCode: CreatedPairingCode
  copyStatus: CopyStatus
  onCopy: () => Promise<void>
  onHide: () => void
}) {
  return (
    <aside
      aria-labelledby="device-pairing-code-title"
      className="rounded-panel border border-brand/30 bg-brand-soft p-5 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">
        Emparejamiento pendiente
      </p>
      <h2
        className="mt-2 text-xl font-bold tracking-tight text-ink"
        id="device-pairing-code-title"
      >
        Código para KOReader
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
        En KOReader abre <strong>Karenda &gt; Vincular dispositivo</strong> y escribe
        este código. No se guarda en la web ni en el Kindle y solo puede usarse una vez.
      </p>
      <code className="mt-5 block select-all rounded-control border border-brand/30 bg-surface px-3 py-4 text-center text-3xl font-bold tracking-[0.35em] text-brand">
        {pairingCode.pairing_code}
      </code>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => void onCopy()} variant="secondary">
          Copiar código
        </Button>
        <Button onClick={onHide} variant="ghost">
          Ocultar código
        </Button>
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-ink-muted">
        {copyStatus === 'copied'
          ? 'Código copiado al portapapeles.'
          : copyStatus === 'error'
            ? 'No se pudo copiar automáticamente. Selecciónalo y cópialo manualmente.'
            : `Vence el ${formatDate(pairingCode.expires_at)}.`}
      </p>
    </aside>
  )
}

function TokenSecretPanel({
  createdToken,
  copyStatus,
  onCopy,
  onHide,
}: {
  createdToken: CreatedDeviceToken
  copyStatus: CopyStatus
  onCopy: () => Promise<void>
  onHide: () => void
}) {
  return (
    <aside
      aria-labelledby="device-token-secret-title"
      className="rounded-panel border border-warning/30 bg-warning-soft p-5 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-warning">
        Copia manual requerida
      </p>
      <h2
        className="mt-2 text-xl font-bold tracking-tight text-ink"
        id="device-token-secret-title"
      >
        Token listo para KOReader
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        Guárdalo ahora en la configuración del plugin. Karenda no volverá a mostrar este
        secreto.
      </p>
      <code className="mt-4 block select-all break-all rounded-control border border-warning/30 bg-surface px-3 py-3 text-sm leading-6 text-ink">
        {createdToken.token}
      </code>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => void onCopy()} variant="secondary">
          Copiar token
        </Button>
        <Button onClick={onHide} variant="ghost">
          Ocultar token
        </Button>
      </div>
      <p aria-live="polite" className="mt-3 text-sm text-ink-muted">
        {copyStatus === 'copied'
          ? 'Token copiado al portapapeles.'
          : copyStatus === 'error'
            ? 'No se pudo copiar automáticamente. Selecciónalo y cópialo manualmente.'
            : 'El token solo se conserva mientras esta página permanezca abierta.'}
      </p>
    </aside>
  )
}

function DeviceTokenRow({
  token,
  onRegenerate,
  onRevoke,
}: {
  token: DeviceTokenMetadata
  onRegenerate: () => void
  onRevoke: () => void
}) {
  const status = getTokenStatus(token)
  const isActive = status.label === 'Activo'

  return (
    <li className="flex flex-col gap-4 border-t border-border px-5 py-5 first:border-t-0 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-semibold text-ink">
              {token.label}
            </h3>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
            >
              {status.label}
            </span>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm text-ink-muted sm:grid-cols-2">
            <div>
              <dt className="inline font-semibold text-ink">Creado: </dt>
              <dd className="inline">{formatDate(token.created_at)}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-ink">Último uso: </dt>
              <dd className="inline">{formatDate(token.last_used_at)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="inline font-semibold text-ink">Permisos: </dt>
              <dd className="inline">{token.scopes.map(formatScope).join(', ')}</dd>
            </div>
          </dl>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <Button onClick={onRegenerate} variant="secondary">
            Regenerar token
          </Button>
          {isActive ? (
            <Button
              onClick={onRevoke}
              variant="ghost"
              className="text-danger hover:bg-danger-soft"
            >
              Revocar token
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function DeviceTokensPage() {
  const [tokens, setTokens] = useState<DeviceTokenMetadata[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [label, setLabel] = useState('Kindle')
  const [isCreating, setIsCreating] = useState(false)
  const [createdPairingCode, setCreatedPairingCode] =
    useState<CreatedPairingCode | null>(null)
  const [pairingCopyStatus, setPairingCopyStatus] = useState<CopyStatus>('idle')
  const [createdToken, setCreatedToken] = useState<CreatedDeviceToken | null>(null)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isActionLoading, setIsActionLoading] = useState(false)

  const loadTokens = async () => {
    setIsLoading(true)
    setError(null)

    try {
      setTokens(await listDeviceTokens())
      setIsLoaded(true)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'No se pudieron cargar los dispositivos.'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTokens()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  const handleCreate = async () => {
    const normalizedLabel = label.trim()

    if (!normalizedLabel) {
      setError('Escribe un nombre para identificar el dispositivo.')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const result = await createDevicePairingCodeRequest(normalizedLabel)
      setCreatedPairingCode(result)
      setPairingCopyStatus('idle')
      setCreatedToken(null)
      setLabel(normalizedLabel)
      await loadTokens()
    } catch (createError) {
      setError(
        getErrorMessage(createError, 'No se pudo generar el código de emparejamiento.'),
      )
    } finally {
      setIsCreating(false)
    }
  }

  const handlePairingCopy = async () => {
    if (!createdPairingCode) {
      setPairingCopyStatus('error')
      return
    }

    try {
      await copyTextToClipboard(createdPairingCode.pairing_code)
      setPairingCopyStatus('copied')
    } catch {
      setPairingCopyStatus('error')
    }
  }

  const handleCopy = async () => {
    if (!createdToken) {
      setCopyStatus('error')
      return
    }

    try {
      await copyTextToClipboard(createdToken.token)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
  }

  const handleConfirmAction = async () => {
    if (!pendingAction) {
      return
    }

    setIsActionLoading(true)
    setActionError(null)

    try {
      if (pendingAction.kind === 'revoke') {
        await revokeDeviceToken(pendingAction.token.id)
      } else {
        const result = await regenerateDeviceToken(
          pendingAction.token.id,
          pendingAction.token.label,
          pendingAction.token.scopes,
        )
        setCreatedToken(result)
        setCopyStatus('idle')
      }

      setPendingAction(null)
      await loadTokens()
    } catch (actionErrorValue) {
      setActionError(
        getErrorMessage(actionErrorValue, 'No se pudo completar la operación.'),
      )
    } finally {
      setIsActionLoading(false)
    }
  }

  const confirmationIsRegeneration = pendingAction?.kind === 'regenerate'

  return (
    <section aria-labelledby="device-tokens-title" className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight text-ink sm:text-4xl"
            id="device-tokens-title"
          >
            Dispositivos
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">
            Conecta KOReader a tu calendario sin compartir tu sesión de Karenda.
          </p>
        </div>
      </header>

      {error ? (
        <div
          aria-live="assertive"
          className="rounded-control border border-danger/30 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {createdPairingCode ? (
        <PairingCodePanel
          copyStatus={pairingCopyStatus}
          onCopy={handlePairingCopy}
          onHide={() => setCreatedPairingCode(null)}
          pairingCode={createdPairingCode}
        />
      ) : null}

      {createdToken ? (
        <TokenSecretPanel
          copyStatus={copyStatus}
          createdToken={createdToken}
          onCopy={handleCopy}
          onHide={() => setCreatedToken(null)}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)]">
        <section
          aria-labelledby="add-device-title"
          className="h-fit rounded-panel border border-border bg-surface p-5 sm:p-6"
        >
          <h2
            className="text-xl font-bold tracking-tight text-ink"
            id="add-device-title"
          >
            Conectar dispositivo
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Genera un código de seis dígitos para vincular un Kindle o instalación de
            KOReader sin copiar un token largo.
          </p>
          <form
            className="mt-6 space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              void handleCreate()
            }}
          >
            <div>
              <label
                className="block text-sm font-semibold text-ink"
                htmlFor="device-label"
              >
                Nombre del dispositivo
              </label>
              <input
                className="mt-2 block min-h-11 w-full rounded-control border border-border bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-focus focus:ring-4 focus:ring-brand-soft"
                id="device-label"
                maxLength={120}
                onChange={(event) => setLabel(event.target.value)}
                value={label}
              />
              <p className="mt-2 text-xs leading-5 text-ink-muted">
                Ejemplo: Kindle de estudio. El permiso será solo de lectura.
              </p>
            </div>
            <Button isLoading={isCreating} loadingLabel="Generando…" type="submit">
              Generar código
            </Button>
          </form>
        </section>

        <section
          aria-busy={isLoading && !isLoaded}
          aria-labelledby="device-list-title"
          className="overflow-hidden rounded-panel border border-border bg-surface"
        >
          <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:px-6">
            <h2 className="font-semibold text-ink" id="device-list-title">
              Tus dispositivos
            </h2>
            <p className="text-sm text-ink-muted">
              {tokens.length} {tokens.length === 1 ? 'dispositivo' : 'dispositivos'}
            </p>
          </div>
          {!isLoaded && isLoading ? (
            <div aria-live="polite" className="space-y-3 px-5 py-8 sm:px-6">
              <p className="text-sm text-ink-muted">Cargando dispositivos…</p>
              <div className="h-16 animate-pulse rounded-control bg-surface-subtle" />
              <div className="h-16 animate-pulse rounded-control bg-surface-subtle" />
            </div>
          ) : null}
          {!isLoaded && !isLoading && error ? (
            <div className="px-5 py-8 sm:px-6">
              <p className="text-sm leading-6 text-ink-muted">
                No pudimos cargar la lista de dispositivos.
              </p>
              <Button
                className="mt-4"
                onClick={() => void loadTokens()}
                variant="secondary"
              >
                Intentar nuevamente
              </Button>
            </div>
          ) : null}
          {isLoaded && tokens.length === 0 ? (
            <EmptyState
              description="Genera un código para conectar tu primer Kindle sin usar tus credenciales de Karenda."
              title="Todavía no tienes dispositivos"
            />
          ) : null}
          {isLoaded && tokens.length > 0 ? (
            <ul>
              {tokens.map((token) => (
                <DeviceTokenRow
                  key={token.id}
                  onRegenerate={() => {
                    setActionError(null)
                    setPendingAction({ kind: 'regenerate', token })
                  }}
                  onRevoke={() => {
                    setActionError(null)
                    setPendingAction({ kind: 'revoke', token })
                  }}
                  token={token}
                />
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <ConfirmDialog
        confirmLabel={confirmationIsRegeneration ? 'Regenerar token' : 'Revocar token'}
        description={
          confirmationIsRegeneration
            ? 'El token actual dejará de funcionar inmediatamente y recibirás un secreto nuevo para copiar a KOReader.'
            : 'El token dejará de funcionar inmediatamente. Esta acción no elimina tus eventos ni tus notas.'
        }
        error={actionError}
        isLoading={isActionLoading}
        loadingLabel={confirmationIsRegeneration ? 'Regenerando…' : 'Revocando…'}
        onCancel={() => {
          if (!isActionLoading) {
            setActionError(null)
            setPendingAction(null)
          }
        }}
        onConfirm={handleConfirmAction}
        open={pendingAction !== null}
        title={confirmationIsRegeneration ? '¿Regenerar token?' : '¿Revocar token?'}
      />
    </section>
  )
}
