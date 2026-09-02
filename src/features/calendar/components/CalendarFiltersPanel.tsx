import type { ChangeEvent } from 'react'
import type { PersonalGroup, Subject } from '../../../types/domain.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { TextField } from '../../../components/ui/FormField.tsx'
import type { CalendarFilterArrayKey, CalendarFilters } from '../utils/eventFilters.ts'

interface CalendarFiltersPanelProps {
  filters: CalendarFilters
  onClear: () => void
  onClose: () => void
  onDateChange: (field: 'endDate' | 'startDate', value: string) => void
  onToggle: (key: CalendarFilterArrayKey, value: string) => void
  personalGroups: Pick<PersonalGroup, 'id' | 'name'>[]
  subjects: Pick<Subject, 'abbreviation' | 'code' | 'id' | 'name'>[]
}

interface CheckboxOptionProps {
  checked: boolean
  label: string
  onChange: () => void
}

function CheckboxOption({ checked, label, onChange }: CheckboxOptionProps) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-control px-2 py-1.5 text-sm text-ink hover:bg-surface-strong">
      <input
        checked={checked}
        className="size-4 accent-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft"
        onChange={onChange}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  )
}

function getDateRangeError(filters: CalendarFilters): string | undefined {
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    return 'La fecha inicial debe ser anterior o igual a la fecha final.'
  }

  return undefined
}

export function CalendarFiltersPanel({
  filters,
  onClear,
  onClose,
  onDateChange,
  onToggle,
  personalGroups,
  subjects,
}: CalendarFiltersPanelProps) {
  const dateRangeError = getDateRangeError(filters)
  const handleDateChange =
    (field: 'endDate' | 'startDate') => (event: ChangeEvent<HTMLInputElement>) => {
      onDateChange(field, event.target.value)
    }

  return (
    <section
      aria-labelledby="calendar-filters-title"
      className="space-y-5 rounded-panel border border-border bg-surface-subtle p-4 sm:p-5"
      id="calendar-filters"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-ink" id="calendar-filters-title">
            Filtros de eventos
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Combina varias opciones para acotar los resultados.
          </p>
        </div>
        <Button onClick={onClose} variant="ghost">
          Cerrar filtros
        </Button>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold text-ink">Tipo</legend>
          <CheckboxOption
            checked={filters.kinds.includes('academic')}
            label="Académicos"
            onChange={() => onToggle('kinds', 'academic')}
          />
          <CheckboxOption
            checked={filters.kinds.includes('personal')}
            label="Personales"
            onChange={() => onToggle('kinds', 'personal')}
          />
        </fieldset>

        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold text-ink">Estado</legend>
          <CheckboxOption
            checked={filters.statuses.includes('pending')}
            label="Pendientes"
            onChange={() => onToggle('statuses', 'pending')}
          />
          <CheckboxOption
            checked={filters.statuses.includes('completed')}
            label="Completados"
            onChange={() => onToggle('statuses', 'completed')}
          />
        </fieldset>

        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold text-ink">Asignaturas</legend>
          {subjects.length > 0 ? (
            subjects.map((subject) => (
              <CheckboxOption
                checked={filters.subjectIds.includes(subject.id)}
                key={subject.id}
                label={`${subject.name} (${subject.abbreviation})`}
                onChange={() => onToggle('subjectIds', subject.id)}
              />
            ))
          ) : (
            <p className="px-2 py-1.5 text-sm text-ink-muted">No hay asignaturas.</p>
          )}
        </fieldset>

        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold text-ink">Grupos personales</legend>
          {personalGroups.length > 0 ? (
            personalGroups.map((group) => (
              <CheckboxOption
                checked={filters.personalGroupIds.includes(group.id)}
                key={group.id}
                label={group.name}
                onChange={() => onToggle('personalGroupIds', group.id)}
              />
            ))
          ) : (
            <p className="px-2 py-1.5 text-sm text-ink-muted">
              No hay grupos personales.
            </p>
          )}
        </fieldset>
      </div>

      <fieldset className="grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
        <legend className="sr-only">Rango de fechas</legend>
        <TextField
          error={dateRangeError}
          id="calendar-filter-start-date"
          label="Desde"
          onChange={handleDateChange('startDate')}
          type="date"
          value={filters.startDate}
        />
        <TextField
          error={dateRangeError}
          id="calendar-filter-end-date"
          label="Hasta"
          onChange={handleDateChange('endDate')}
          type="date"
          value={filters.endDate}
        />
      </fieldset>

      <div className="flex justify-end border-t border-border pt-5">
        <Button onClick={onClear} variant="secondary">
          Limpiar filtros
        </Button>
      </div>
    </section>
  )
}
