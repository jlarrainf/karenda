import type {
  NoteFilter,
  NoteTarget,
  PersonalGroup,
  Subject,
} from '../../../types/domain.ts'

interface NoteTargetNavigationProps {
  onSelect: (target: NoteFilter) => void
  personalGroups: Pick<PersonalGroup, 'color' | 'id' | 'name'>[]
  subjects: Pick<Subject, 'abbreviation' | 'code' | 'color' | 'id' | 'name'>[]
  target: NoteFilter | null
}

function targetButtonClassName(isSelected: boolean): string {
  return [
    'flex min-h-14 w-full items-center gap-3 rounded-control px-3 text-left text-sm transition-colors duration-state focus-visible:ring-4 focus-visible:ring-brand-soft',
    isSelected
      ? 'bg-brand-soft text-brand'
      : 'text-ink-muted hover:bg-surface-strong hover:text-ink',
  ].join(' ')
}

function isSelectedTarget(
  target: NoteFilter | null,
  targetType: NoteTarget['targetType'],
  id: string,
) {
  return target?.targetType === targetType && target.targetId === id
}

export function NoteTargetNavigation({
  onSelect,
  personalGroups,
  subjects,
  target,
}: NoteTargetNavigationProps) {
  return (
    <aside
      aria-labelledby="note-targets-title"
      className="h-fit rounded-panel border border-border bg-surface p-4 sm:p-5"
    >
      <div className="border-b border-border pb-4">
        <h2 className="font-semibold text-ink" id="note-targets-title">
          Destinos de notas
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted">
          Filtra por todos los ramos, una asignatura o un grupo personal.
        </p>
      </div>

      <nav aria-label="Destinos de notas" className="mt-4 space-y-5">
        <section aria-labelledby="note-subjects-title">
          <h3
            className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle"
            id="note-subjects-title"
          >
            Asignaturas
          </h3>
          <ul className="mt-2 space-y-1">
            <li>
              <button
                aria-pressed={target?.targetType === 'all_subjects'}
                className={targetButtonClassName(target?.targetType === 'all_subjects')}
                onClick={() => onSelect({ targetType: 'all_subjects' })}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="grid size-3 shrink-0 place-items-center rounded-sm bg-brand ring-4 ring-surface-strong"
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">Todos los ramos</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-muted">
                    Todas las notas de asignaturas
                  </span>
                </span>
              </button>
            </li>
            {subjects.length > 0
              ? subjects.map((subject) => {
                  const isSelected = isSelectedTarget(target, 'subject', subject.id)

                  return (
                    <li key={subject.id}>
                      <button
                        aria-pressed={isSelected}
                        className={targetButtonClassName(isSelected)}
                        onClick={() =>
                          onSelect({ targetId: subject.id, targetType: 'subject' })
                        }
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="size-3 shrink-0 rounded-full ring-4 ring-surface-strong"
                          style={{ backgroundColor: subject.color }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {subject.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink-muted">
                            {subject.code} · {subject.abbreviation}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })
              : null}
          </ul>
          {subjects.length === 0 ? (
            <p className="px-2 py-3 text-sm text-ink-muted">No hay asignaturas.</p>
          ) : null}
        </section>

        <section aria-labelledby="note-groups-title">
          <h3
            className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle"
            id="note-groups-title"
          >
            Grupos personales
          </h3>
          {personalGroups.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {personalGroups.map((personalGroup) => {
                const isSelected = isSelectedTarget(
                  target,
                  'personal_group',
                  personalGroup.id,
                )

                return (
                  <li key={personalGroup.id}>
                    <button
                      aria-pressed={isSelected}
                      className={targetButtonClassName(isSelected)}
                      onClick={() =>
                        onSelect({
                          targetId: personalGroup.id,
                          targetType: 'personal_group',
                        })
                      }
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-full ring-4 ring-surface-strong"
                        style={{ backgroundColor: personalGroup.color ?? '#7A8780' }}
                      />
                      <span className="min-w-0 truncate font-semibold">
                        {personalGroup.name}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-2 py-3 text-sm text-ink-muted">
              No hay grupos personales.
            </p>
          )}
        </section>
      </nav>
    </aside>
  )
}
