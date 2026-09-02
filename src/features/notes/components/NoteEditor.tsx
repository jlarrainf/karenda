import { useState, type FormEvent } from 'react'
import type { NoteTarget } from '../../../types/domain.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { TextAreaField, TextField } from '../../../components/ui/FormField.tsx'
import { noteInputSchema } from '../../../services/validation.ts'
import type { NoteDraft, NoteSaveStatus } from '../../../stores/noteStore.ts'
import { MarkdownRenderer } from './MarkdownRenderer.tsx'

interface NoteEditorProps {
  draft: NoteDraft
  error: string | null
  isEditing: boolean
  saveStatus: NoteSaveStatus
  target: NoteTarget
  targetLabel: string
  onCancel: () => void
  onChange: (field: keyof NoteDraft, value: string) => void
  onDelete?: () => void
  onSave: () => Promise<void>
}

interface NoteFieldErrors {
  contentMarkdown?: string
  title?: string
}

function getFieldErrors(target: NoteTarget, draft: NoteDraft): NoteFieldErrors {
  const result = noteInputSchema.safeParse({
    contentMarkdown: draft.contentMarkdown,
    targetId: target.targetId,
    targetType: target.targetType,
    title: draft.title,
  })

  if (result.success) {
    return {}
  }

  return result.error.issues.reduce<NoteFieldErrors>((errors, issue) => {
    const field = issue.path[0]

    if (field === 'title' || field === 'contentMarkdown') {
      errors[field] ??= issue.message
    }

    return errors
  }, {})
}

export function NoteEditor({
  draft,
  error,
  isEditing,
  saveStatus,
  target,
  targetLabel,
  onCancel,
  onChange,
  onDelete,
  onSave,
}: NoteEditorProps) {
  const [isPreview, setIsPreview] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<NoteFieldErrors>({})
  const isSaving = saveStatus === 'saving'

  const handleFieldChange = (field: keyof NoteDraft, value: string) => {
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }))
    onChange(field, value)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextFieldErrors = getFieldErrors(target, draft)

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      return
    }

    void onSave()
  }

  return (
    <section
      aria-labelledby="note-editor-title"
      className="rounded-panel border border-border bg-surface p-5 sm:p-6"
    >
      <form
        aria-busy={isSaving}
        className="space-y-5"
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              className="text-xl font-bold tracking-tight text-ink"
              id="note-editor-title"
            >
              {isEditing ? 'Editar nota' : 'Nueva nota'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Destino: <span className="font-semibold text-ink">{targetLabel}</span>
            </p>
          </div>
          <div aria-label="Modo de nota" className="flex gap-2" role="group">
            <Button
              aria-pressed={!isPreview}
              onClick={() => setIsPreview(false)}
              type="button"
              variant={!isPreview ? 'primary' : 'secondary'}
            >
              Editar
            </Button>
            <Button
              aria-pressed={isPreview}
              onClick={() => setIsPreview(true)}
              type="button"
              variant={isPreview ? 'primary' : 'secondary'}
            >
              Vista previa
            </Button>
          </div>
        </div>

        {error ? (
          <p
            aria-live="assertive"
            className="rounded-control bg-danger-soft px-3 py-2 text-sm leading-6 text-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {isPreview ? (
          <div
            aria-label="Vista previa de la nota"
            className="min-h-80 rounded-control border border-border bg-surface-subtle p-4 sm:p-5"
          >
            <h3 className="break-words text-2xl font-bold tracking-tight text-ink">
              {draft.title || 'Sin título'}
            </h3>
            <div className="mt-5 border-t border-border pt-5">
              {draft.contentMarkdown.trim() ? (
                <MarkdownRenderer content={draft.contentMarkdown} />
              ) : (
                <p className="text-sm text-ink-muted">
                  Escribe contenido Markdown para ver la vista previa.
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <TextField
              autoComplete="off"
              error={fieldErrors.title}
              id="note-title"
              label="Título"
              maxLength={240}
              onChange={(event) => handleFieldChange('title', event.target.value)}
              required
              value={draft.title}
            />
            <TextAreaField
              error={fieldErrors.contentMarkdown}
              hint="Puedes usar encabezados, listas, enlaces, código, tablas y fórmulas entre $...$ o $$...$$."
              id="note-content"
              label="Contenido Markdown"
              maxLength={100000}
              onChange={(event) =>
                handleFieldChange('contentMarkdown', event.target.value)
              }
              required
              rows={16}
              value={draft.contentMarkdown}
            />
          </>
        )}

        {saveStatus === 'saved' ? (
          <p
            aria-live="polite"
            className="text-sm font-semibold text-success"
            role="status"
          >
            Nota guardada.
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          {onDelete ? (
            <Button disabled={isSaving} onClick={onDelete} variant="danger">
              Eliminar nota
            </Button>
          ) : null}
          <Button disabled={isSaving} onClick={onCancel} variant="ghost">
            {isEditing ? 'Cancelar edición' : 'Limpiar'}
          </Button>
          <Button isLoading={isSaving} loadingLabel="Guardando…" type="submit">
            Guardar nota
          </Button>
        </div>
      </form>
    </section>
  )
}
