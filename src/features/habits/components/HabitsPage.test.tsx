import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCatalogStore } from '../../../stores/catalogStore.ts'
import { useHabitStore } from '../../../stores/habitStore.ts'
import { HabitsPage } from './HabitsPage.tsx'

describe('HabitsPage', () => {
  beforeEach(() => {
    useCatalogStore.getState().reset()
    useHabitStore.getState().reset()
  })

  it('requests the current local date when entering the Today view', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 4, 12, 0, 0))

    const load = vi.fn().mockResolvedValue(undefined)
    const loadCatalog = vi.fn().mockResolvedValue(undefined)
    const originalLoad = useHabitStore.getState().load
    const originalLoadCatalog = useCatalogStore.getState().load

    useHabitStore.setState({
      load,
      range: { endDate: '2026-09-01', startDate: '2026-09-01' },
      selectedDate: '2026-09-01',
      view: 'today',
    })
    useCatalogStore.setState({ isLoaded: true, load: loadCatalog })

    try {
      render(<HabitsPage />)

      expect(load).toHaveBeenCalledWith('2026-09-04')
    } finally {
      useHabitStore.setState({ load: originalLoad })
      useCatalogStore.setState({ load: originalLoadCatalog })
      vi.useRealTimers()
    }
  })

  it('shows an accessible skeleton instead of an empty state while loading', () => {
    const load = vi.fn().mockResolvedValue(undefined)
    const loadCatalog = vi.fn().mockResolvedValue(undefined)
    const originalLoad = useHabitStore.getState().load
    const originalLoadCatalog = useCatalogStore.getState().load

    useHabitStore.setState({ isLoading: true, load })
    useCatalogStore.setState({ isLoaded: true, load: loadCatalog })

    try {
      render(<HabitsPage />)

      const status = screen.getByRole('status', { name: 'Cargando hábitos' })
      expect(status).toHaveAttribute('aria-busy', 'true')
      expect(screen.queryByText('Todavía no tienes hábitos')).not.toBeInTheDocument()
    } finally {
      useHabitStore.setState({ load: originalLoad })
      useCatalogStore.setState({ load: originalLoadCatalog })
    }
  })

  it('places manual habit creation before AI-assisted creation', () => {
    const load = vi.fn().mockResolvedValue(undefined)
    const loadCatalog = vi.fn().mockResolvedValue(undefined)
    const originalLoad = useHabitStore.getState().load
    const originalLoadCatalog = useCatalogStore.getState().load

    useHabitStore.setState({ load })
    useCatalogStore.setState({ isLoaded: true, load: loadCatalog })

    try {
      render(<HabitsPage />)

      const buttonLabels = screen.getAllByRole('button').map((button) => button.textContent)
      expect(buttonLabels.indexOf('Nuevo hábito')).toBeLessThan(
        buttonLabels.indexOf('Agregar con IA'),
      )
    } finally {
      useHabitStore.setState({ load: originalLoad })
      useCatalogStore.setState({ load: originalLoadCatalog })
    }
  })
})
