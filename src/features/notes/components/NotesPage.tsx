import { useEffect, useState } from 'react'
import type { Note, NoteFilter, PersonalGroup, Subject } from '../../../types/domain.ts'
import type { NoteDraft } from '../../../stores/noteStore.ts'
import { useCatalogStore } from '../../../stores/catalogStore.ts'
import { useNoteStore } from '../../../stores/noteStore.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.tsx'
import { EmptyState } from '../../../components/ui/EmptyState.tsx'
import { MarkdownRenderer } from './MarkdownRenderer.tsx'
import { NoteEditor } from './NoteEditor.tsx'
import { NoteTargetNavigation } from './NoteTargetNavigation.tsx'

const updatedDateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function getTargetLabel(
  target: NoteFilter,
  subjects: Subject[],
  personalGroups: PersonalGroup[],
): string {
  if (target.targetType === 'all_subjects') {
    return 'Todos los ramos'
  }

  if (target.targetType === 'subject') {
    const subject = subjects.find((item) => item.id === target.targetId)

    return subject ? `${subject.name} (${subject.code})` : 'Asignatura no disponible'
  }

  return (
    personalGroups.find((item) => item.id === target.targetId)?.name ??
    'Grupo personal no disponible'
  )
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? 'Actualización no disponible'
    : `Actualizada ${updatedDateFormatter.format(date)}`
}

function getNoteCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'nota' : 'notas'}`
}

export function NotesPage() {
  const subjects = useCatalogStore((state) => state.subjects)
  const personalGroups = useCatalogStore((state) => state.personalGroups)
  const catalogIsLoaded = useCatalogStore((state) => state.isLoaded)
  const catalogIsLoading = useCatalogStore((state) => state.isLoading)
  const catalogError = useCatalogStore((state) => state.error)
  const loadCatalog = useCatalogStore((state) => state.load)
  const clearCatalogError = useCatalogStore((state) => state.clearError)
  const target = useNoteStore((state) => state.target)
  const notes = useNoteStore((state) => state.notes)
  const selectedNoteId = useNoteStore((state) => state.selectedNoteId)
  const draft = useNoteStore((state) => state.draft)
  const notesAreLoaded = useNoteStore((state) => state.isLoaded)
  const notesAreLoading = useNoteStore((state) => state.isLoading)
  const saveStatus = useNoteStore((state) => state.saveStatus)
  const noteError = useNoteStore((state) => state.error)
  const selectTarget = useNoteStore((state) => state.selectTarget)
  const loadNotes = useNoteStore((state) => state.load)
  const startEditing = useNoteStore((state) => state.startEditing)
  const setDraft = useNoteStore((state) => state.setDraft)
  const clearDraft = useNoteStore((state) => state.clearDraft)
  const saveDraft = useNoteStore((state) => state.saveDraft)
  const deleteNote = useNoteStore((state) => state.deleteNote)
  const clearNoteError = useNoteStore((state) => state.clearError)
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null)
  const [isManagementOpen, setIsManagementOpen] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    if (catalogIsLoaded && !target) {
      selectTarget({ targetType: 'all_subjects' })
    }
  }, [catalogIsLoaded, selectTarget, target])

  useEffect(() => {
    if (target) {
      void loadNotes(target)
    }
  }, [loadNotes, target])

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null
  const targetLabel = target
    ? getTargetLabel(target, subjects, personalGroups)
    : 'Selecciona un destino'

  const handleSelectTarget = (nextTarget: NoteFilter) => {
    clearNoteError()
    setNoteToDelete(null)
    setIsEditorOpen(false)
    setIsManagementOpen(false)
    selectTarget(nextTarget)
  }

  const handleCreateNote = () => {
    if (!target || target.targetType === 'all_subjects') {
      return
    }

    clearNoteError()
    clearDraft()
    setIsManagementOpen(true)
    setIsEditorOpen(true)
  }

  const handleOpenEdit = () => {
    if (!selectedNote) {
      return
    }

    clearNoteError()
    startEditing(selectedNote)
    setIsManagementOpen(true)
    setIsEditorOpen(true)
  }

  const handleSelectNote = (note: Note) => {
    clearNoteError()
    startEditing(note)
  }

  const handleSave = async () => {
    await saveDraft()
  }

  const handleDeleteRequest = () => {
    if (selectedNote) {
      clearNoteError()
      setNoteToDelete(selectedNote)
    }
  }

  const handleDelete = async () => {
    if (!noteToDelete) {
      return
    }

    const deleted = await deleteNote(noteToDelete.id)

    if (deleted) {
      setNoteToDelete(null)
      setIsEditorOpen(false)
    }
  }

  const handleCancelDelete = () => {
    clearNoteError()
    setNoteToDelete(null)
  }

  const handleDraftChange = (field: keyof NoteDraft, value: string) => {
    setDraft(field, value)
  }

  const handleCloseEditor = () => {
    clearNoteError()
    if (selectedNote) {
      startEditing(selectedNote)
    } else {
      clearDraft()
    }
    setIsEditorOpen(false)
  }

  const handleToggleManagement = () => {
    if (isManagementOpen) {
      handleCloseEditor()
      setIsManagementOpen(false)
      return
    }

    setIsManagementOpen(true)
  }

  const canCreateNote = target?.targetType !== 'all_subjects' && target !== null
  const editorTarget = selectedNote
    ? { targetId: selectedNote.targetId, targetType: selectedNote.targetType }
    : target?.targetType !== 'all_subjects'
      ? target
      : null
  const selectedNoteTargetLabel = selectedNote
    ? getTargetLabel(
        { targetId: selectedNote.targetId, targetType: selectedNote.targetType },
        subjects,
        personalGroups,
      )
    : null

  return (
    <section aria-labelledby="notes-title" className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight text-ink sm:text-4xl"
            id="notes-title"
          >
            Notas Markdown
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">
            Conserva apuntes y material de estudio junto a cada asignatura o grupo
            personal.
          </p>
        </div>
        <Button
          onClick={handleToggleManagement}
          variant={isManagementOpen ? 'secondary' : 'primary'}
        >
          {isManagementOpen ? 'Cerrar configuración' : 'Configurar notas'}
        </Button>
      </header>

      {catalogError ? (
        <div
          aria-live="assertive"
          className="rounded-control border border-danger/30 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger"
          role="alert"
        >
          {catalogError}
          <Button
            className="mt-3 border-danger/40 text-danger hover:bg-danger/10"
            onClick={() => {
              clearCatalogError()
              void loadCatalog(true)
            }}
            variant="secondary"
          >
            Intentar nuevamente
          </Button>
        </div>
      ) : null}

      {!catalogIsLoaded && catalogIsLoading ? (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Cargando destinos de notas…
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <NoteTargetNavigation
          onSelect={handleSelectTarget}
          personalGroups={personalGroups}
          subjects={subjects}
          target={target}
        />

        <div className="min-w-0">
          {!target ? (
            <section className="rounded-panel border border-border bg-surface">
              <EmptyState
                description="Selecciona un filtro para consultar tus notas."
                title="Elige un destino"
              />
            </section>
          ) : (
            <>
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-ink">
                    {targetLabel}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {getNoteCountLabel(notes.length)}
                  </p>
                </div>
              </div>

              {isManagementOpen ? (
                <section
                  aria-labelledby="notes-settings-title"
                  className="mb-6 rounded-panel border border-border bg-surface-subtle p-5 sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3
                        className="text-lg font-bold tracking-tight text-ink"
                        id="notes-settings-title"
                      >
                        Configuración de notas
                      </h3>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">
                        La lectura permanece separada de las acciones que modifican tus
                        apuntes.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={!canCreateNote} onClick={handleCreateNote}>
                        Nueva nota
                      </Button>
                      <Button
                        disabled={!selectedNote}
                        onClick={handleOpenEdit}
                        variant="secondary"
                      >
                        Editar nota seleccionada
                      </Button>
                    </div>
                  </div>
                  {!canCreateNote ? (
                    <p className="mt-4 text-sm text-ink-muted">
                      Selecciona una asignatura o grupo personal para crear una nota.
                    </p>
                  ) : null}
                </section>
              ) : null}

              {!notesAreLoaded && notesAreLoading ? (
                <section
                  aria-busy="true"
                  aria-live="polite"
                  className="rounded-panel border border-border bg-surface px-5 py-8 sm:px-8"
                >
                  Cargando notas…
                </section>
              ) : null}

              {!notesAreLoaded && noteError ? (
                <section className="rounded-panel border border-border bg-surface px-5 py-8 sm:px-8">
                  <h3 className="text-lg font-semibold text-ink">
                    No pudimos cargar tus notas
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">{noteError}</p>
                  <Button
                    className="mt-5"
                    onClick={() => void loadNotes(target)}
                    variant="secondary"
                  >
                    Intentar nuevamente
                  </Button>
                </section>
              ) : null}

              {notesAreLoaded ? (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <section
                    aria-labelledby="note-list-title"
                    className="h-fit overflow-hidden rounded-panel border border-border bg-surface"
                  >
                    <div className="border-b border-border px-5 py-4 sm:px-6">
                      <h3 className="font-semibold text-ink" id="note-list-title">
                        Notas disponibles
                      </h3>
                    </div>
                    {notes.length > 0 ? (
                      <ul className="divide-y divide-border">
                        {notes.map((note) => (
                          <li key={note.id}>
                            <button
                              aria-pressed={selectedNoteId === note.id}
                              className={[
                                'w-full px-5 py-4 text-left transition-colors duration-state focus-visible:bg-brand-soft sm:px-6',
                                selectedNoteId === note.id
                                  ? 'bg-brand-soft'
                                  : 'hover:bg-surface-subtle',
                              ].join(' ')}
                              onClick={() => handleSelectNote(note)}
                              type="button"
                            >
                              <span className="block break-words font-semibold text-ink">
                                {note.title}
                              </span>
                              <span className="mt-1 block text-xs text-ink-muted">
                                {formatUpdatedAt(note.updatedAt)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState
                        description="Este filtro todavía no tiene notas."
                        title="No hay notas"
                      />
                    )}
                  </section>

                  {isEditorOpen && editorTarget ? (
                    <NoteEditor
                      draft={draft}
                      error={noteToDelete ? null : noteError}
                      isEditing={selectedNote !== null}
                      key={selectedNoteId ?? 'new-note'}
                      onCancel={handleCloseEditor}
                      onChange={handleDraftChange}
                      onDelete={selectedNote ? handleDeleteRequest : undefined}
                      onSave={handleSave}
                      saveStatus={saveStatus}
                      target={editorTarget}
                      targetLabel={
                        selectedNoteTargetLabel ??
                        getTargetLabel(editorTarget, subjects, personalGroups)
                      }
                    />
                  ) : (
                    <section
                      aria-labelledby="note-reader-title"
                      className="min-w-0 rounded-panel border border-border bg-surface p-5 sm:p-6"
                    >
                      {selectedNote ? (
                        <>
                          <div className="border-b border-border pb-5">
                            <h3
                              className="break-words text-2xl font-bold tracking-tight text-ink"
                              id="note-reader-title"
                            >
                              {selectedNote.title}
                            </h3>
                            <p className="mt-2 text-sm text-ink-muted">
                              {selectedNoteTargetLabel} ·{' '}
                              {formatUpdatedAt(selectedNote.updatedAt)}
                            </p>
                          </div>
                          <div className="pt-5">
                            <MarkdownRenderer content={selectedNote.contentMarkdown} />
                          </div>
                        </>
                      ) : (
                        <EmptyState
                          description="Selecciona una nota para leer su contenido Markdown."
                          title="Elige una nota"
                        />
                      )}
                    </section>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        confirmLabel="Eliminar nota"
        description="Esta acción eliminará únicamente esta nota y no se puede deshacer."
        error={noteToDelete ? noteError : null}
        isLoading={saveStatus === 'saving'}
        onCancel={handleCancelDelete}
        onConfirm={handleDelete}
        open={noteToDelete !== null}
        title={`¿Eliminar ${noteToDelete?.title ?? 'esta nota'}?`}
      />
    </section>
  )
}
