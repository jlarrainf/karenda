import { useEffect, useRef } from 'react'
import type { FormEvent, SyntheticEvent } from 'react'
import { Button } from './Button.tsx'

interface ConfirmDialogProps {
  cancelLabel?: string
  confirmLabel?: string
  description: string
  error?: string | null
  isLoading?: boolean
  loadingLabel?: string
  onCancel: () => void
  onConfirm: () => Promise<void> | void
  open: boolean
  title: string
}

export function ConfirmDialog({
  cancelLabel = 'Cancelar',
  confirmLabel = 'Confirmar',
  description,
  error,
  isLoading = false,
  loadingLabel = 'Eliminando…',
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal()
      } else {
        dialog.setAttribute('open', '')
      }
    }

    if (!open && dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close()
      } else {
        dialog.removeAttribute('open')
      }
    }
  }, [open])

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()

    if (!isLoading) {
      onCancel()
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isLoading) {
      void onConfirm()
    }
  }

  return (
    <dialog
      aria-describedby="confirm-dialog-description"
      aria-labelledby="confirm-dialog-title"
      className="max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-panel border border-border bg-surface p-0 text-ink shadow-overlay backdrop:bg-ink/45"
      onCancel={handleCancel}
      ref={dialogRef}
      role="alertdialog"
    >
      <form className="space-y-6 p-5 sm:p-6" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-xl font-bold tracking-tight" id="confirm-dialog-title">
            {title}
          </h2>
          <p
            className="mt-2 text-sm leading-6 text-ink-muted"
            id="confirm-dialog-description"
          >
            {description}
          </p>
        </div>
        {error ? (
          <p
            aria-live="assertive"
            className="text-sm leading-6 text-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button disabled={isLoading} onClick={onCancel} variant="ghost">
            {cancelLabel}
          </Button>
          <Button
            isLoading={isLoading}
            loadingLabel={loadingLabel}
            type="submit"
            variant="danger"
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
