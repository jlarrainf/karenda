import { useEffect, useState } from 'react'
import type { Subject } from '../../../types/domain.ts'
import type { SubjectInput } from '../../../services/validation.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.tsx'
import { EmptyState } from '../../../components/ui/EmptyState.tsx'
import { SubjectForm } from './SubjectForm.tsx'
import { useCatalogStore } from '../../../stores/catalogStore.ts'
import { listCanvasCourseLinks, unlinkCanvasCourse } from '../../../services/canvasService.ts'
import type { CanvasCourseLink } from '../../../types/canvas.ts'

function getSubjectCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'asignatura' : 'asignaturas'}`
}

export function SubjectsPage() {
  const subjects = useCatalogStore((state) => state.subjects)
  const isLoaded = useCatalogStore((state) => state.isLoaded)
  const isLoading = useCatalogStore((state) => state.isLoading)
  const isSaving = useCatalogStore((state) => state.isSaving)
  const error = useCatalogStore((state) => state.error)
  const load = useCatalogStore((state) => state.load)
  const refresh = useCatalogStore((state) => state.refresh)
  const createSubject = useCatalogStore((state) => state.createSubject)
  const updateSubject = useCatalogStore((state) => state.updateSubject)
  const deleteSubject = useCatalogStore((state) => state.deleteSubject)
  const clearError = useCatalogStore((state) => state.clearError)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null)
  const [canvasLinks, setCanvasLinks] = useState<CanvasCourseLink[]>([])
  const [canvasCourseToUnlink, setCanvasCourseToUnlink] = useState<CanvasCourseLink | null>(null)
  const [isCanvasUnlinking, setIsCanvasUnlinking] = useState(false)
  const [canvasUnlinkError, setCanvasUnlinkError] = useState<string | null>(null)
  const [canvasUnlinkMessage, setCanvasUnlinkMessage] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let isActive = true
    void listCanvasCourseLinks()
      .then((links) => {
        if (isActive) setCanvasLinks(links)
      })
      .catch(() => {
        if (isActive) setCanvasLinks([])
      })
    return () => {
      isActive = false
    }
  }, [])

  const openCreateForm = () => {
    clearError()
    setEditingSubject(null)
    setIsFormOpen(true)
  }

  const openEditForm = (subject: Subject) => {
    clearError()
    setEditingSubject(subject)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    clearError()
    setEditingSubject(null)
    setIsFormOpen(false)
  }

  const handleSubmit = async (input: SubjectInput) => {
    const savedSubject = editingSubject
      ? await updateSubject(editingSubject.id, input)
      : await createSubject(input)

    if (savedSubject) {
      closeForm()
    }
  }

  const handleDelete = async () => {
    if (!subjectToDelete) {
      return
    }

    const deleted = await deleteSubject(subjectToDelete.id)

    if (deleted) {
      setSubjectToDelete(null)
    }
  }

  const handleUnlinkCanvasCourse = async () => {
    if (!canvasCourseToUnlink) return

    setIsCanvasUnlinking(true)
    setCanvasUnlinkError(null)
    setCanvasUnlinkMessage(null)
    try {
      await unlinkCanvasCourse(canvasCourseToUnlink.id)
      setCanvasLinks((links) => links.filter((link) => link.id !== canvasCourseToUnlink.id))
      setCanvasUnlinkMessage(`Se desvinculó ${canvasCourseToUnlink.canvasName}. Los eventos históricos se conservaron.`)
      setCanvasCourseToUnlink(null)
    } catch (unlinkError) {
      setCanvasUnlinkError(unlinkError instanceof Error ? unlinkError.message : 'No se pudo desvincular el curso de Canvas.')
    } finally {
      setIsCanvasUnlinking(false)
    }
  }

  const subjectCanvasLinks = editingSubject
    ? canvasLinks.filter((link) => link.subjectId === editingSubject.id)
    : []
  const canvasLinksBySubjectId = new Map<string, CanvasCourseLink[]>()
  for (const link of canvasLinks) {
    const links = canvasLinksBySubjectId.get(link.subjectId) ?? []
    links.push(link)
    canvasLinksBySubjectId.set(link.subjectId, links)
  }

  const renderSubjectContent = () => {
    if (!isLoaded && isLoading) {
      return (
        <div
          aria-busy="true"
          aria-live="polite"
          className="space-y-3 px-5 py-8 sm:px-8"
        >
          <p className="text-sm text-ink-muted">Cargando asignaturas…</p>
          <div className="h-12 animate-pulse rounded-control bg-surface-subtle" />
          <div className="h-12 animate-pulse rounded-control bg-surface-subtle" />
          <div className="h-12 animate-pulse rounded-control bg-surface-subtle" />
        </div>
      )
    }

    if (!isLoaded && error) {
      return (
        <div className="px-5 py-10 sm:px-8">
          <h3 className="text-lg font-semibold text-ink">
            No pudimos cargar tus asignaturas
          </h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{error}</p>
          <Button className="mt-5" onClick={() => void refresh()} variant="secondary">
            Intentar nuevamente
          </Button>
        </div>
      )
    }

    if (subjects.length === 0) {
      return (
        <EmptyState
          action={<Button onClick={openCreateForm}>Crear primera asignatura</Button>}
          description="Añade nombre, sigla, abreviación y color para reconocer tus eventos académicos de un vistazo."
          title="Todavía no tienes asignaturas"
        />
      )
    }

    return (
      <ul className="divide-y divide-border">
        {subjects.map((subject) => (
          <li
            className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8"
            key={subject.id}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1.5 size-3 shrink-0 rounded-full ring-4 ring-surface-strong"
                style={{ backgroundColor: subject.color }}
              />
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-ink">
                  {subject.name}
                </h3>
                <p className="mt-1 break-words text-sm text-ink-muted">
                  {subject.code} · {subject.abbreviation} · Color {subject.color}
                </p>
                {canvasLinksBySubjectId.get(subject.id)?.length ? (
                  <p className="mt-2 text-xs font-semibold text-brand">
                    Canvas vinculado: {canvasLinksBySubjectId.get(subject.id)?.map((link) => link.canvasName).join(', ')}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              <Button
                className="text-ink-muted hover:bg-surface-strong hover:text-ink"
                onClick={() => openEditForm(subject)}
                variant="ghost"
              >
                Editar
              </Button>
              <Button
                className="text-danger hover:bg-danger-soft hover:text-danger"
                onClick={() => setSubjectToDelete(subject)}
                variant="ghost"
              >
                Eliminar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section className="space-y-8" aria-labelledby="subjects-title">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight text-ink sm:text-4xl"
            id="subjects-title"
          >
            Asignaturas
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">
            Mantén los colores y nombres que dan contexto a tus eventos académicos.
          </p>
        </div>
        <Button
          onClick={isFormOpen ? closeForm : openCreateForm}
          variant={isFormOpen ? 'secondary' : 'primary'}
        >
          {isFormOpen ? 'Cerrar formulario' : 'Nueva asignatura'}
        </Button>
      </header>

      {error && isLoaded ? (
        <div
          aria-live="assertive"
          className="rounded-control border border-danger/30 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {isLoaded && isLoading ? (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Actualizando asignaturas…
        </p>
      ) : null}

      <div
        className={
          isFormOpen
            ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]'
            : ''
        }
      >
        <section
          aria-busy={!isLoaded && isLoading}
          aria-labelledby="subject-list-title"
          className="overflow-hidden rounded-panel border border-border bg-surface"
        >
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-8">
            <div>
              <h2 className="font-semibold text-ink" id="subject-list-title">
                Tus asignaturas
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {getSubjectCountLabel(subjects.length)}
              </p>
            </div>
          </div>
          {renderSubjectContent()}
        </section>

        {isFormOpen ? (
          <aside
            className="rounded-panel border border-border bg-surface p-5 sm:p-6"
            aria-label="Formulario de asignatura"
          >
            <SubjectForm
              canvasLinks={subjectCanvasLinks}
              isLoading={isSaving}
              key={editingSubject?.id ?? 'new'}
              onCancel={closeForm}
              onSubmit={handleSubmit}
              onUnlinkCanvasCourse={(link) => {
                setCanvasUnlinkError(null)
                setCanvasCourseToUnlink(link)
              }}
              subject={editingSubject}
            />
          </aside>
        ) : null}
      </div>

      <ConfirmDialog
        confirmLabel="Eliminar asignatura"
        description="Si tiene eventos o notas asociadas, InsForge impedirá la eliminación y conservará todos tus datos."
        error={subjectToDelete ? error : null}
        isLoading={isSaving}
        onCancel={() => setSubjectToDelete(null)}
        onConfirm={handleDelete}
        open={subjectToDelete !== null}
        title={`¿Eliminar ${subjectToDelete?.name ?? 'esta asignatura'}?`}
      />

      {canvasUnlinkMessage ? (
        <p aria-live="polite" className="rounded-control border border-success/30 bg-success-soft px-4 py-3 text-sm leading-6 text-success">
          {canvasUnlinkMessage}
        </p>
      ) : null}

      <ConfirmDialog
        confirmLabel="Desvincular curso"
        description="El curso dejará de sincronizarse con esta asignatura. Los eventos, vínculos de elementos y datos históricos de Karenda se conservarán."
        error={canvasUnlinkError}
        isLoading={isCanvasUnlinking}
        loadingLabel="Desvinculando…"
        onCancel={() => {
          setCanvasCourseToUnlink(null)
          setCanvasUnlinkError(null)
        }}
        onConfirm={handleUnlinkCanvasCourse}
        open={canvasCourseToUnlink !== null}
        title={`¿Desvincular ${canvasCourseToUnlink?.canvasName ?? 'este curso'}?`}
      />
    </section>
  )
}
