import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { emptyCalendarFilters } from '../utils/eventFilters.ts'
import { CalendarFiltersPanel } from './CalendarFiltersPanel.tsx'

describe('CalendarFiltersPanel', () => {
  it('exposes filter controls and explicit clear and close actions', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    const onClose = vi.fn()
    const onDateChange = vi.fn()
    const onToggle = vi.fn()

    render(
      <CalendarFiltersPanel
        filters={emptyCalendarFilters}
        onClear={onClear}
        onClose={onClose}
        onDateChange={onDateChange}
        onToggle={onToggle}
        personalGroups={[{ id: 'group-1', name: 'Salud' }]}
        subjects={[
          { abbreviation: 'ALG', code: 'MAT-101', id: 'subject-1', name: 'Álgebra' },
        ]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Filtros de eventos' })).toBeVisible()
    expect(screen.getByLabelText('Álgebra (ALG)')).toBeInTheDocument()
    expect(screen.getByLabelText('Salud')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Académicos'))
    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-09-01' },
    })
    await user.click(screen.getByRole('button', { name: 'Cerrar filtros' }))
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(onToggle).toHaveBeenCalledWith('kinds', 'academic')
    expect(onDateChange).toHaveBeenCalledWith('startDate', '2026-09-01')
    expect(onClose).toHaveBeenCalledOnce()
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('shows an invalid date range message', () => {
    render(
      <CalendarFiltersPanel
        filters={{
          ...emptyCalendarFilters,
          endDate: '2026-09-01',
          startDate: '2026-09-02',
        }}
        onClear={vi.fn()}
        onClose={vi.fn()}
        onDateChange={vi.fn()}
        onToggle={vi.fn()}
        personalGroups={[]}
        subjects={[]}
      />,
    )

    expect(
      screen.getAllByText(
        'La fecha inicial debe ser anterior o igual a la fecha final.',
      ),
    ).toHaveLength(2)
  })
})
