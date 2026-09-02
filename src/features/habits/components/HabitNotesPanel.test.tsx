import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Habit, HabitNote } from '../../../types/domain.ts'
import {
  createHabitNote,
  deleteHabitNote,
  listHabitNotes,
  updateHabitNote,
} from '../../../services/habitService.ts'
import { useHabitStore } from '../../../stores/habitStore.ts'
import { HabitNotesPanel } from './HabitNotesPanel.tsx'

vi.mock('../../../services/habitService.ts', () => ({
  createHabitNote: vi.fn(),
  deleteHabitNote: vi.fn(),
  listHabitNotes: vi.fn(),
  updateHabitNote: vi.fn(),
}))

const habit: Habit = {
  calendarEnabled: false,
  calendarSchedule: null,
  color: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  description: null,
  endDate: null,
  evaluationMode: 'scheduled_occurrence',
  goalValue: 1,
  id: '11111111-1111-4111-8111-111111111111',
  lifecycleStatus: 'active',
  missPolicy: 'mark_missed',
  name: 'Leer',
  notePolicy: 'both',
  ownerId: '22222222-2222-4222-8222-222222222222',
  personalGroupId: null,
  quotaPeriod: null,
  schedule: {
    anchorDate: null,
    dayOfMonth: null,
    interval: 1,
    unit: 'day',
    weekdays: [],
  },
  startDate: '2026-09-01',
  statsEnabled: true,
  subjectId: null,
  trackingType: 'boolean',
  unit: null,
  updatedAt: '2026-09-01T10:00:00.000Z',
}

const note: HabitNote = {
  contentMarkdown: '<script>alert("x")</script>\n\nTexto seguro.',
  createdAt: '2026-09-01T10:00:00.000Z',
  entryDate: '2026-09-02',
  habitId: habit.id,
  id: '33333333-3333-4333-8333-333333333333',
  ownerId: habit.ownerId,
  title: 'Lectura',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

const mockedCreateHabitNote = vi.mocked(createHabitNote)
const mockedDeleteHabitNote = vi.mocked(deleteHabitNote)
const mockedListHabitNotes = vi.mocked(listHabitNotes)
const mockedUpdateHabitNote = vi.mocked(updateHabitNote)

describe('HabitNotesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useHabitStore.getState().reset()
    mockedListHabitNotes.mockResolvedValue([note])
  })

  it('loads, renders safely and deletes a contextual habit note', async () => {
    const user = userEvent.setup()
    mockedDeleteHabitNote.mockResolvedValue(undefined)
    mockedListHabitNotes.mockResolvedValueOnce([note]).mockResolvedValueOnce([])

    render(<HabitNotesPanel date="2026-09-02" habit={habit} onClose={vi.fn()} />)

    const noteButton = await screen.findByRole('button', { name: /Lectura/ })
    await user.click(noteButton)

    expect(screen.getByText('Texto seguro.')).toBeVisible()
    expect(document.querySelector('script')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))

    await vi.waitFor(() => expect(mockedDeleteHabitNote).toHaveBeenCalledWith(note.id))
    expect(screen.queryByRole('button', { name: /Lectura/ })).not.toBeInTheDocument()
    expect(mockedCreateHabitNote).not.toHaveBeenCalled()
    expect(mockedUpdateHabitNote).not.toHaveBeenCalled()
  })
})
