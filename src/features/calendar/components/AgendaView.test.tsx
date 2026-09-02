import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from '../../../types/domain.ts'
import { AgendaView } from './AgendaView.tsx'

const subjectId = '11111111-1111-4111-8111-111111111111'

function makeEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    createdAt: '2026-08-30T10:00:00.000Z',
    description: null,
    endAt: null,
    id: 'event-default',
    isAllDay: false,
    kind: 'academic',
    location: null,
    ownerId: '22222222-2222-4222-8222-222222222222',
    personalGroupId: null,
    startAt: '2026-09-02T10:00:00-03:00',
    status: 'pending',
    subjectId,
    title: 'Evento',
    updatedAt: '2026-08-30T10:00:00.000Z',
    ...overrides,
  }
}

describe('AgendaView', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('groups upcoming events, keeps chronological order, and moves ongoing events to today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-30T12:00:00-03:00'))

    render(
      <AgendaView
        events={[
          makeEvent({
            endAt: '2026-08-29',
            id: 'event-past',
            isAllDay: true,
            startAt: '2026-08-20',
            title: 'Evento pasado',
          }),
          makeEvent({
            endAt: '2026-09-01',
            id: 'event-ongoing',
            isAllDay: true,
            startAt: '2026-08-28',
            title: 'Evento en curso',
          }),
          makeEvent({
            id: 'event-late',
            startAt: '2026-09-02T10:00:00-03:00',
            title: 'Control de Álgebra',
          }),
          makeEvent({
            id: 'event-early',
            startAt: '2026-09-02T08:00:00-03:00',
            title: 'Clase de Álgebra',
          }),
        ]}
        hasFilters={false}
        onClearFilters={vi.fn()}
        onSelect={vi.fn()}
        personalGroups={[]}
        subjects={[
          { abbreviation: 'ALG', color: '#2F625A', id: subjectId, name: 'Álgebra' },
        ]}
      />,
    )

    expect(screen.queryByText('Evento pasado')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /30 de agosto de 2026/ })).toBeVisible()

    const eventButtons = screen.getAllByRole('button', { name: /^Abrir/ })
    expect(eventButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Abrir Evento en curso',
      'Abrir Clase de Álgebra',
      'Abrir Control de Álgebra',
    ])
  })

  it('opens the selected event from the agenda row', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const event = makeEvent({ id: 'event-1', title: 'Control de Álgebra' })

    render(
      <AgendaView
        events={[event]}
        hasFilters={false}
        onClearFilters={vi.fn()}
        onSelect={onSelect}
        personalGroups={[]}
        subjects={[
          { abbreviation: 'ALG', color: '#2F625A', id: subjectId, name: 'Álgebra' },
        ]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Abrir Control de Álgebra' }))

    expect(onSelect).toHaveBeenCalledWith(event)
  })

  it('starts from a selected date while keeping ongoing events visible', () => {
    const ongoingEvent = makeEvent({
      endAt: '2026-09-12',
      id: 'event-ongoing',
      isAllDay: true,
      startAt: '2026-09-08',
      title: 'Semana en curso',
    })

    render(
      <AgendaView
        events={[ongoingEvent]}
        hasFilters={false}
        onClearFilters={vi.fn()}
        onSelect={vi.fn()}
        personalGroups={[]}
        startDate="2026-09-10"
        subjects={[
          { abbreviation: 'ALG', color: '#2F625A', id: subjectId, name: 'Álgebra' },
        ]}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /10 de septiembre de 2026/ }),
    ).toBeVisible()
    expect(screen.getByText('Semana en curso')).toBeVisible()
  })
})
