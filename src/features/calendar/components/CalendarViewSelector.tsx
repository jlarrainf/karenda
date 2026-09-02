import { Button } from '../../../components/ui/Button.tsx'
import type { CalendarView } from '../../../stores/calendarStore.ts'

interface CalendarViewSelectorProps {
  onChange: (view: CalendarView) => void
  value: CalendarView
}

const viewOptions: { label: string; value: CalendarView }[] = [
  { label: 'Agenda', value: 'agenda' },
  { label: 'Mes', value: 'month' },
  { label: 'Semana', value: 'week' },
  { label: 'Día', value: 'day' },
]

export function CalendarViewSelector({ onChange, value }: CalendarViewSelectorProps) {
  return (
    <div aria-label="Selector de vista" className="flex flex-wrap gap-2" role="group">
      {viewOptions.map((option) => (
        <Button
          aria-pressed={value === option.value}
          key={option.value}
          onClick={() => onChange(option.value)}
          variant={value === option.value ? 'primary' : 'secondary'}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
