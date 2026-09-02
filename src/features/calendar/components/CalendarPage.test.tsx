import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent, PersonalGroup } from '../../../types/domain.ts'
import { useCalendarStore } from '../../../stores/calendarStore.ts'
import { useCatalogStore } from '../../../stores/catalogStore.ts'
import { requestAiEventDrafts } from '../../../services/aiEventService.ts'
import { CalendarPage } from './CalendarPage.tsx'

vi.mock('@fullcalendar/react', () => ({
  default: () => <div data-testid="full-calendar" />,
}))

vi.mock('../../../services/aiEventService.ts', () => ({
  requestAiEventDrafts: vi.fn(),
}))

const subjectId = '11111111-1111-4111-8111-111111111111'
const personalGroupId = '33333333-3333-4333-8333-333333333333'

const events: CalendarEvent[] = [
  {
    createdAt: '2026-08-30T10:00:00.000Z',
    description: 'Repasar derivadas.',
    endAt: null,
    id: 'event-academic',
    isAllDay: false,
    kind: 'academic',
    location: 'Sala 12',
    ownerId: '22222222-2222-4222-8222-222222222222',
    personalGroupId: null,
    startAt: '2099-09-02T10:00:00-03:00',
    status: 'pending',
    subjectId,
    title: 'Control de Álgebra',
    updatedAt: '2026-08-30T10:00:00.000Z',
  },
  {
    createdAt: '2026-08-30T10:00:00.000Z',
    description: null,
    endAt: null,
    id: 'event-personal',
    isAllDay: false,
    kind: 'personal',
    location: null,
    ownerId: '22222222-2222-4222-8222-222222222222',
    personalGroupId,
    startAt: '2099-09-03T10:00:00-03:00',
    status: 'completed',
    subjectId: null,
    title: 'Cita médica',
    updatedAt: '2026-08-30T10:00:00.000Z',
  },
]

describe('CalendarPage', () => {
  beforeEach(() => {
    useCalendarStore.getState().reset()
    useCatalogStore.getState().reset()
    vi.resetAllMocks()
  })

  it('shares search and filters with the Agenda view', async () => {
    const user = userEvent.setup()

    render(
      <CalendarPage
        events={events}
        personalGroups={[{ color: '#8A5A20', id: personalGroupId, name: 'Salud' }]}
        subjects={[
          {
            abbreviation: 'ALG',
            code: 'MAT-101',
            color: '#2F625A',
            id: subjectId,
            name: 'Álgebra',
          },
        ]}
      />,
    )

    expect(screen.getByText('2 eventos visibles')).toBeVisible()

    await user.type(screen.getByLabelText('Buscar eventos'), 'algebra')
    expect(screen.getByText('1 evento visible')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Agenda' }))

    expect(screen.getByRole('heading', { name: 'Agenda' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Navegación de agenda' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Ir a la agenda anterior' }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Ir a la agenda siguiente' }),
    ).toBeVisible()
    expect(screen.getByText('Control de Álgebra')).toBeVisible()
    expect(screen.queryByText('Cita médica')).not.toBeInTheDocument()
  })

  it('applies a category filter and clears it from the toolbar', async () => {
    const user = userEvent.setup()

    render(
      <CalendarPage
        events={events}
        personalGroups={[{ color: '#8A5A20', id: personalGroupId, name: 'Salud' }]}
        subjects={[
          {
            abbreviation: 'ALG',
            code: 'MAT-101',
            color: '#2F625A',
            id: subjectId,
            name: 'Álgebra',
          },
        ]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Filtros' }))
    await user.click(screen.getByLabelText('Personales'))
    await user.click(screen.getByRole('button', { name: 'Agenda' }))

    expect(screen.getByText('1 evento visible')).toBeVisible()
    expect(screen.queryByText('Control de Álgebra')).not.toBeInTheDocument()
    expect(screen.getByText('Cita médica')).toBeVisible()

    await user.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0]!)

    expect(screen.getByText('2 eventos visibles')).toBeVisible()
  })

  it('creates one confirmed group and associates repeated proposals with it', async () => {
    const user = userEvent.setup()
    const groupId = '44444444-4444-4444-8444-444444444444'
    const createdGroup: PersonalGroup = {
      color: null,
      createdAt: '2026-09-01T10:00:00.000Z',
      id: groupId,
      name: 'Salud',
      ownerId: '22222222-2222-4222-8222-222222222222',
      updatedAt: '2026-09-01T10:00:00.000Z',
    }
    const createPersonalGroup = vi.fn().mockResolvedValue(createdGroup)
    const createEvent = vi.fn().mockResolvedValue(events[0])
    const originalCreatePersonalGroup = useCatalogStore.getState().createPersonalGroup
    const originalCreateEvent = useCalendarStore.getState().createEvent

    useCatalogStore.setState({ createPersonalGroup })
    useCalendarStore.setState({ createEvent })
    vi.mocked(requestAiEventDrafts).mockResolvedValue([
      {
        draftId: 'ai-draft-1',
        input: {
          description: null,
          endAt: null,
          isAllDay: true,
          kind: 'personal',
          location: null,
          personalGroupId: null,
          startAt: '2099-09-04',
          status: 'pending',
          subjectId: null,
          title: 'Cita médica',
        },
        newPersonalGroupName: 'Salud',
        reviewFlags: ['new_personal_group'],
      },
      {
        draftId: 'ai-draft-2',
        input: {
          description: null,
          endAt: null,
          isAllDay: true,
          kind: 'personal',
          location: null,
          personalGroupId: null,
          startAt: '2099-09-05',
          status: 'pending',
          subjectId: null,
          title: 'Control médico',
        },
        newPersonalGroupName: ' salud ',
        reviewFlags: ['new_personal_group'],
      },
    ])

    render(<CalendarPage events={[]} />)

    await user.click(screen.getByRole('button', { name: 'Agregar con IA' }))
    await user.type(screen.getByLabelText('Describe tus eventos'), 'Dos citas médicas.')
    await user.click(screen.getByRole('button', { name: 'Preparar borradores' }))
    await screen.findByText('Revisa tus borradores')
    await user.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))
    await user.click(screen.getByRole('button', { name: 'Guardar eventos (2)' }))

    expect(createPersonalGroup).toHaveBeenCalledOnce()
    expect(createPersonalGroup).toHaveBeenCalledWith({ color: null, name: 'Salud' })
    expect(createEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ personalGroupId: groupId }),
    )
    expect(createEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ personalGroupId: groupId }),
    )

    useCatalogStore.setState({ createPersonalGroup: originalCreatePersonalGroup })
    useCalendarStore.setState({ createEvent: originalCreateEvent })
  })
})
