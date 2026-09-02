import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from '../../../types/domain.ts'
import { EventDetail } from './EventDetail.tsx'

const event: CalendarEvent = {
  createdAt: '2026-08-30T10:00:00.000Z',
  description: 'Repasar capítulos uno y dos.',
  endAt: '2026-09-10T12:00:00-03:00',
  id: '44444444-4444-4444-8444-444444444444',
  isAllDay: false,
  kind: 'academic',
  location: 'Sala 12',
  ownerId: '22222222-2222-4222-8222-222222222222',
  personalGroupId: null,
  startAt: '2026-09-10T10:00:00-03:00',
  status: 'pending',
  subjectId: '11111111-1111-4111-8111-111111111111',
  title: 'Control 1',
  updatedAt: '2026-08-30T10:00:00.000Z',
}

const detailProps = {
  accentColor: '#2F625A',
  event,
  onClose: vi.fn(),
  onEdit: vi.fn(),
  onToggleStatus: vi.fn().mockResolvedValue(undefined),
  personalGroups: [],
  subjects: [{ id: event.subjectId!, name: 'Álgebra' }],
}

describe('EventDetail', () => {
  it('shows event metadata and exposes status and edit actions', async () => {
    const user = userEvent.setup()

    render(<EventDetail {...detailProps} />)

    expect(screen.getByRole('heading', { name: 'Control 1' })).toBeVisible()
    expect(screen.getByText('Álgebra')).toBeVisible()
    expect(screen.getByText('Pendiente')).toBeVisible()
    expect(screen.getByText('Sala 12')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Marcar como completado' }))
    expect(detailProps.onToggleStatus).toHaveBeenCalledWith(event)

    await user.click(screen.getByRole('button', { name: 'Editar evento' }))
    expect(detailProps.onEdit).toHaveBeenCalledWith(event)
    expect(detailProps.onClose).toHaveBeenCalled()
  })

  it('requires confirmation before deleting an event', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(
      <EventDetail
        {...detailProps}
        onClose={onClose}
        onDelete={onDelete}
        onEdit={undefined}
        onToggleStatus={undefined}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Eliminar evento' }))

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toBeVisible()
    expect(within(dialog).getByText('¿Eliminar Control 1?')).toBeVisible()
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Eliminar evento' }))

    expect(onDelete).toHaveBeenCalledWith(event)
    expect(onClose).toHaveBeenCalled()
  })
})
