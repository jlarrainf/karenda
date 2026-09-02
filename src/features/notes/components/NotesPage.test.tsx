import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note } from '../../../types/domain.ts'
import { useCatalogStore } from '../../../stores/catalogStore.ts'
import { useNoteStore } from '../../../stores/noteStore.ts'
import { listAllSubjectNotes, listNotes } from '../../../services/noteService.ts'
import { NotesPage } from './NotesPage.tsx'

vi.mock('../../../services/noteService.ts', () => ({
  createNote: vi.fn(),
  deleteNote: vi.fn(),
  listAllSubjectNotes: vi.fn(),
  listNotes: vi.fn(),
  updateNote: vi.fn(),
}))

vi.mock('../../../services/subjectService.ts', () => ({
  createSubject: vi.fn(),
  deleteSubject: vi.fn(),
  listSubjects: vi.fn(),
  updateSubject: vi.fn(),
}))

vi.mock('../../../services/personalGroupService.ts', () => ({
  createPersonalGroup: vi.fn(),
  deletePersonalGroup: vi.fn(),
  listPersonalGroups: vi.fn(),
  updatePersonalGroup: vi.fn(),
}))

const subjectId = '11111111-1111-4111-8111-111111111111'
const groupId = '33333333-3333-4333-8333-333333333333'
const target = { targetId: subjectId, targetType: 'subject' as const }

const note: Note = {
  contentMarkdown: '# Repaso',
  createdAt: '2026-08-30T10:00:00.000Z',
  id: '44444444-4444-4444-8444-444444444444',
  ownerId: '22222222-2222-4222-8222-222222222222',
  targetId: subjectId,
  targetType: 'subject',
  title: 'Repaso de Álgebra',
  updatedAt: '2026-08-30T10:00:00.000Z',
}

const mockedListNotes = vi.mocked(listNotes)
const mockedListAllSubjectNotes = vi.mocked(listAllSubjectNotes)

describe('NotesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCatalogStore.getState().reset()
    useNoteStore.getState().reset()
    useCatalogStore.setState({
      isLoaded: true,
      isLoading: false,
      personalGroups: [
        {
          color: null,
          createdAt: note.createdAt,
          id: groupId,
          name: 'Salud',
          ownerId: note.ownerId,
          updatedAt: note.updatedAt,
        },
      ],
      subjects: [
        {
          abbreviation: 'ALG',
          code: 'MAT-101',
          color: '#2F625A',
          createdAt: note.createdAt,
          id: subjectId,
          name: 'Álgebra',
          ownerId: note.ownerId,
          updatedAt: note.updatedAt,
        },
      ],
    })
    useNoteStore.setState({
      isLoaded: true,
      target,
      notes: [note],
    })
    mockedListNotes.mockImplementation(async (targetType, targetId) =>
      targetType === target.targetType && targetId === target.targetId ? [note] : [],
    )
    mockedListAllSubjectNotes.mockResolvedValue([note])
  })

  it('lists notes for the selected subject and shows an empty destination', async () => {
    const user = userEvent.setup()

    render(<NotesPage />)

    expect(await screen.findByText('Repaso de Álgebra')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Álgebra (MAT-101)' })).toBeVisible()
    expect(screen.queryByLabelText(/^Contenido Markdown/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configurar notas' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: /Todos los ramos/ }))

    expect(
      await screen.findByRole('heading', { name: 'Todos los ramos' }),
    ).toBeVisible()
    expect(mockedListAllSubjectNotes).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Salud' }))

    await waitFor(() =>
      expect(screen.getByText('Este filtro todavía no tiene notas.')).toBeVisible(),
    )
    expect(screen.getByRole('heading', { name: 'Salud' })).toBeVisible()
  })

  it('opens note administration explicitly instead of mounting the editor initially', async () => {
    const user = userEvent.setup()

    render(<NotesPage />)

    expect(
      screen.queryByRole('heading', { name: 'Configuración de notas' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Configurar notas' }))

    expect(
      screen.getByRole('heading', { name: 'Configuración de notas' }),
    ).toBeVisible()
    expect(screen.queryByLabelText(/^Contenido Markdown/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Repaso de Álgebra/ }))
    await user.click(screen.getByRole('button', { name: 'Editar nota seleccionada' }))

    expect(screen.getByLabelText(/^Contenido Markdown/)).toBeVisible()
  })
})
