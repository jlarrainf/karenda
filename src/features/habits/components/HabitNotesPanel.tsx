import { useEffect, useMemo, useState } from 'react'
import type { Habit, HabitNote } from '../../../types/domain.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { TextAreaField, TextField } from '../../../components/ui/FormField.tsx'
import { useHabitStore } from '../../../stores/habitStore.ts'
import { MarkdownRenderer } from '../../notes/components/MarkdownRenderer.tsx'

interface HabitNotesPanelProps {
  habit: Habit
  date: string
  onClose: () => void
}

function canUseGeneralNotes(policy: Habit['notePolicy']): boolean {
  return policy === 'general' || policy === 'both'
}

function canUseDailyNotes(policy: Habit['notePolicy']): boolean {
  return policy === 'daily' || policy === 'both'
}

export function HabitNotesPanel({ habit, date, onClose }: HabitNotesPanelProps) {
  const allNotes = useHabitStore((state) => state.notes)
  const notesLoaded = useHabitStore((state) => state.notesLoaded)
  const isSaving = useHabitStore((state) => state.isSaving)
  const error = useHabitStore((state) => state.error)
  const loadNotes = useHabitStore((state) => state.loadNotes)
  const createNote = useHabitStore((state) => state.createNote)
  const updateNote = useHabitStore((state) => state.updateNote)
  const deleteNote = useHabitStore((state) => state.deleteNote)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [entryDate, setEntryDate] = useState<string | null>(null)

  const notes = useMemo(
    () => allNotes.filter((note) => note.habitId === habit.id),
    [allNotes, habit.id],
  )

  useEffect(() => {
    void loadNotes(habit.id, true)
  }, [habit.id, loadNotes])

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  )

  const beginNew = (nextEntryDate: string | null) => {
    setSelectedNoteId(null)
    setTitle('')
    setContent('')
    setEntryDate(nextEntryDate)
  }

  const selectNote = (note: HabitNote) => {
    setSelectedNoteId(note.id)
    setTitle(note.title)
    setContent(note.contentMarkdown)
    setEntryDate(note.entryDate)
  }

  const handleSave = async () => {
    const input = { contentMarkdown: content, entryDate, habitId: habit.id, title }
    const saved = selectedNoteId
      ? await updateNote(selectedNoteId, input)
      : await createNote(input)
    if (saved) setSelectedNoteId(saved.id)
  }

  const handleDelete = async () => {
    if (!selectedNoteId) return
    const deleted = await deleteNote(selectedNoteId)
    if (deleted) beginNew(entryDate)
  }

  return (
    <aside
      aria-labelledby="habit-notes-title"
      className="rounded-panel border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">
            Notas del hábito
          </p>
          <h2
            className="mt-2 text-xl font-bold tracking-tight text-ink"
            id="habit-notes-title"
          >
            {habit.name}
          </h2>
        </div>
        <Button onClick={onClose} variant="ghost">
          Cerrar
        </Button>
      </div>

      {error ? (
        <p
          className="mt-4 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {!notesLoaded ? (
        <p className="mt-5 text-sm text-ink-muted" role="status">
          Cargando notas…
        </p>
      ) : null}

      {notesLoaded ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <div>
            <div className="flex flex-wrap gap-2">
              {canUseGeneralNotes(habit.notePolicy) ? (
                <Button onClick={() => beginNew(null)} variant="secondary">
                  Nueva general
                </Button>
              ) : null}
              {canUseDailyNotes(habit.notePolicy) ? (
                <Button onClick={() => beginNew(date)} variant="secondary">
                  Nueva diaria
                </Button>
              ) : null}
            </div>
            <ul className="mt-4 divide-y divide-border rounded-control border border-border">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <li key={note.id}>
                    <button
                      aria-pressed={selectedNoteId === note.id}
                      className="w-full touch-manipulation px-3 py-3 text-left text-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft hover:bg-surface-subtle focus-visible:bg-brand-soft"
                      onClick={() => selectNote(note)}
                      type="button"
                    >
                      <span className="block font-semibold text-ink">{note.title}</span>
                      <span className="mt-1 block text-xs text-ink-muted">
                        {note.entryDate ? `Día ${note.entryDate}` : 'General'}
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-4 text-sm text-ink-muted">
                  Todavía no hay notas para este hábito.
                </li>
              )}
            </ul>
          </div>
          <div className="space-y-4">
            <TextField
              id="habit-note-title"
              label="Título"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
            <TextField
              disabled={!canUseDailyNotes(habit.notePolicy)}
              id="habit-note-date"
              label="Fecha diaria opcional"
              onChange={(event) => setEntryDate(event.target.value || null)}
              type="date"
              value={entryDate ?? ''}
            />
            <TextAreaField
              id="habit-note-content"
              label="Contenido Markdown"
              onChange={(event) => setContent(event.target.value)}
              rows={9}
              value={content}
            />
            {selectedNote ? (
              <div className="rounded-control border border-border bg-surface-subtle p-4">
                <MarkdownRenderer content={selectedNote.contentMarkdown} />
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
              {selectedNote ? (
                <Button
                  disabled={isSaving}
                  onClick={() => void handleDelete()}
                  variant="danger"
                >
                  Eliminar
                </Button>
              ) : null}
              <Button
                disabled={isSaving}
                onClick={() => beginNew(entryDate)}
                variant="ghost"
              >
                Limpiar
              </Button>
              <Button
                isLoading={isSaving}
                loadingLabel="Guardando…"
                onClick={() => void handleSave()}
              >
                Guardar nota
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
