import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button.tsx'
import { EmptyState } from '../../../components/ui/EmptyState.tsx'
import { useHabitStore } from '../../../stores/habitStore.ts'
import { MarkdownRenderer } from '../../notes/components/MarkdownRenderer.tsx'

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : dateFormatter.format(date)
}

export function HabitNotesLibrary() {
  const habits = useHabitStore((state) => state.habits)
  const notes = useHabitStore((state) => state.notes)
  const notesLoaded = useHabitStore((state) => state.notesLoaded)
  const isLoading = useHabitStore((state) => state.isLoading)
  const error = useHabitStore((state) => state.error)
  const loadNotes = useHabitStore((state) => state.loadNotes)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  useEffect(() => {
    void loadNotes(undefined, true)
  }, [loadNotes])

  const selectedNote =
    notes.find((note) => note.id === selectedNoteId) ?? notes[0] ?? null
  const selectedHabit = selectedNote
    ? habits.find((habit) => habit.id === selectedNote.habitId)
    : null

  return (
    <section aria-labelledby="habit-notes-library-title" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            className="text-xl font-bold tracking-tight text-ink"
            id="habit-notes-library-title"
          >
            Notas de hábitos
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Consulta tus notas sin mezclarlas con las notas de asignaturas y grupos.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold text-brand hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft"
          to="/habits"
        >
          Gestionar en Hábitos
        </Link>
      </div>

      {error ? (
        <p
          className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {isLoading && !notesLoaded ? (
        <p
          className="rounded-panel border border-border bg-surface px-5 py-8 text-sm text-ink-muted"
          role="status"
        >
          Cargando notas de hábitos…
        </p>
      ) : null}
      {!isLoading && notesLoaded && notes.length === 0 ? (
        <EmptyState
          description="Crea una nota desde la vista de un hábito."
          title="No hay notas de hábitos"
        />
      ) : null}
      {notes.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <section
            aria-label="Lista de notas de hábitos"
            className="h-fit overflow-hidden rounded-panel border border-border bg-surface"
          >
            <ul className="divide-y divide-border">
              {notes.map((note) => {
                const habit = habits.find((item) => item.id === note.habitId)
                return (
                  <li key={note.id}>
                    <button
                      aria-pressed={selectedNote?.id === note.id}
                      className={`w-full touch-manipulation px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft hover:bg-surface-subtle focus-visible:bg-brand-soft ${selectedNote?.id === note.id ? 'bg-brand-soft' : ''}`}
                      onClick={() => setSelectedNoteId(note.id)}
                      type="button"
                    >
                      <span className="block break-words font-semibold text-ink">
                        {note.title}
                      </span>
                      <span className="mt-1 block text-xs text-ink-muted">
                        {habit?.name ?? 'Hábito no disponible'} ·{' '}
                        {note.entryDate ? `Día ${note.entryDate}` : 'General'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
          {selectedNote ? (
            <article
              aria-labelledby="habit-note-reader-title"
              className="min-w-0 rounded-panel border border-border bg-surface p-5 sm:p-6"
            >
              <header className="border-b border-border pb-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                  {selectedHabit?.name ?? 'Hábito'}
                </p>
                <h3
                  className="mt-2 break-words text-2xl font-bold tracking-tight text-ink"
                  id="habit-note-reader-title"
                >
                  {selectedNote.title}
                </h3>
                <p className="mt-2 text-sm text-ink-muted">
                  {selectedNote.entryDate
                    ? `Nota del ${selectedNote.entryDate}`
                    : 'Nota general'}{' '}
                  · {formatDate(selectedNote.updatedAt)}
                </p>
              </header>
              <div className="pt-5">
                <MarkdownRenderer content={selectedNote.contentMarkdown} />
              </div>
            </article>
          ) : null}
        </div>
      ) : null}
      <Button onClick={() => void loadNotes(undefined, true)} variant="ghost">
        Actualizar notas
      </Button>
    </section>
  )
}
