import { useEffect, useState } from 'react'
import type { PersonalGroup } from '../../../types/domain.ts'
import type { PersonalGroupInput } from '../../../services/validation.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.tsx'
import { EmptyState } from '../../../components/ui/EmptyState.tsx'
import { PersonalGroupForm } from './PersonalGroupForm.tsx'
import { useCatalogStore } from '../../../stores/catalogStore.ts'

function getGroupCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'grupo personal' : 'grupos personales'}`
}

export function PersonalGroupsPage() {
  const personalGroups = useCatalogStore((state) => state.personalGroups)
  const isLoaded = useCatalogStore((state) => state.isLoaded)
  const isLoading = useCatalogStore((state) => state.isLoading)
  const isSaving = useCatalogStore((state) => state.isSaving)
  const error = useCatalogStore((state) => state.error)
  const load = useCatalogStore((state) => state.load)
  const refresh = useCatalogStore((state) => state.refresh)
  const createPersonalGroup = useCatalogStore((state) => state.createPersonalGroup)
  const updatePersonalGroup = useCatalogStore((state) => state.updatePersonalGroup)
  const deletePersonalGroup = useCatalogStore((state) => state.deletePersonalGroup)
  const clearError = useCatalogStore((state) => state.clearError)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<PersonalGroup | null>(null)
  const [groupToDelete, setGroupToDelete] = useState<PersonalGroup | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  const openCreateForm = () => {
    clearError()
    setEditingGroup(null)
    setIsFormOpen(true)
  }

  const openEditForm = (group: PersonalGroup) => {
    clearError()
    setEditingGroup(group)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    clearError()
    setEditingGroup(null)
    setIsFormOpen(false)
  }

  const handleSubmit = async (input: PersonalGroupInput) => {
    const savedGroup = editingGroup
      ? await updatePersonalGroup(editingGroup.id, input)
      : await createPersonalGroup(input)

    if (savedGroup) {
      closeForm()
    }
  }

  const handleDelete = async () => {
    if (!groupToDelete) {
      return
    }

    const deleted = await deletePersonalGroup(groupToDelete.id)

    if (deleted) {
      setGroupToDelete(null)
    }
  }

  const renderGroupContent = () => {
    if (!isLoaded && isLoading) {
      return (
        <div
          aria-busy="true"
          aria-live="polite"
          className="space-y-3 px-5 py-8 sm:px-8"
        >
          <p className="text-sm text-ink-muted">Cargando grupos personales…</p>
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
            No pudimos cargar tus grupos
          </h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{error}</p>
          <Button className="mt-5" onClick={() => void refresh()} variant="secondary">
            Intentar nuevamente
          </Button>
        </div>
      )
    }

    if (personalGroups.length === 0) {
      return (
        <EmptyState
          action={<Button onClick={openCreateForm}>Crear primer grupo</Button>}
          description="Separa citas, cumpleaños y otros compromisos personales sin mezclarlos con tus eventos académicos."
          title="Todavía no tienes grupos personales"
        />
      )
    }

    return (
      <ul className="divide-y divide-border">
        {personalGroups.map((group) => (
          <li
            className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8"
            key={group.id}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1.5 size-3 shrink-0 rounded-full ring-4 ring-surface-strong"
                style={{ backgroundColor: group.color ?? '#7A8780' }}
              />
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-ink">
                  {group.name}
                </h3>
                <p className="mt-1 break-words text-sm text-ink-muted">
                  {group.color ? `Color ${group.color}` : 'Color neutro'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              <Button
                className="text-ink-muted hover:bg-surface-strong hover:text-ink"
                onClick={() => openEditForm(group)}
                variant="ghost"
              >
                Editar
              </Button>
              <Button
                className="text-danger hover:bg-danger-soft hover:text-danger"
                onClick={() => setGroupToDelete(group)}
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
    <section className="space-y-8" aria-labelledby="personal-groups-title">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight text-ink sm:text-4xl"
            id="personal-groups-title"
          >
            Grupos personales
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-muted">
            Ordena tus compromisos personales con nombres y colores propios.
          </p>
        </div>
        <Button
          onClick={isFormOpen ? closeForm : openCreateForm}
          variant={isFormOpen ? 'secondary' : 'primary'}
        >
          {isFormOpen ? 'Cerrar formulario' : 'Nuevo grupo'}
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
          Actualizando grupos personales…
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
          aria-labelledby="personal-group-list-title"
          className="overflow-hidden rounded-panel border border-border bg-surface"
        >
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-8">
            <div>
              <h2 className="font-semibold text-ink" id="personal-group-list-title">
                Tus grupos
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {getGroupCountLabel(personalGroups.length)}
              </p>
            </div>
          </div>
          {renderGroupContent()}
        </section>

        {isFormOpen ? (
          <aside
            className="rounded-panel border border-border bg-surface p-5 sm:p-6"
            aria-label="Formulario de grupo personal"
          >
            <PersonalGroupForm
              group={editingGroup}
              isLoading={isSaving}
              key={editingGroup?.id ?? 'new'}
              onCancel={closeForm}
              onSubmit={handleSubmit}
            />
          </aside>
        ) : null}
      </div>

      <ConfirmDialog
        confirmLabel="Eliminar grupo"
        description="Si tiene eventos o notas asociadas, InsForge impedirá la eliminación y conservará todos tus datos."
        error={groupToDelete ? error : null}
        isLoading={isSaving}
        onCancel={() => setGroupToDelete(null)}
        onConfirm={handleDelete}
        open={groupToDelete !== null}
        title={`¿Eliminar ${groupToDelete?.name ?? 'este grupo personal'}?`}
      />
    </section>
  )
}
