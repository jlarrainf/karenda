import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note } from '../types/domain.ts'
import {
  createNote,
  deleteNote,
  listAllSubjectNotes,
  listNotes,
  updateNote,
} from '../services/noteService.ts'
import { useNoteStore } from './noteStore.ts'

vi.mock('../services/noteService.ts', () => ({
  createNote: vi.fn(),
  deleteNote: vi.fn(),
  listAllSubjectNotes: vi.fn(),
  listNotes: vi.fn(),
  updateNote: vi.fn(),
}))

const target = {
  targetId: '11111111-1111-4111-8111-111111111111',
  targetType: 'subject' as const,
}

const note: Note = {
  contentMarkdown: '# Repaso\n\nContenido importante.',
  createdAt: '2026-08-30T10:00:00.000Z',
  id: '44444444-4444-4444-8444-444444444444',
  ownerId: '22222222-2222-4222-8222-222222222222',
  targetId: target.targetId,
  targetType: target.targetType,
  title: 'Repaso',
  updatedAt: '2026-08-30T10:00:00.000Z',
}

const mockedCreateNote = vi.mocked(createNote)
const mockedDeleteNote = vi.mocked(deleteNote)
const mockedListNotes = vi.mocked(listNotes)
const mockedListAllSubjectNotes = vi.mocked(listAllSubjectNotes)
const mockedUpdateNote = vi.mocked(updateNote)

describe('noteStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useNoteStore.getState().reset()
  })

  it('loads notes for the selected destination', async () => {
    mockedListNotes.mockResolvedValue([note])
    useNoteStore.getState().selectTarget(target)

    await useNoteStore.getState().load()

    expect(mockedListNotes).toHaveBeenCalledWith(target.targetType, target.targetId)
    expect(useNoteStore.getState().notes).toEqual([note])
    expect(useNoteStore.getState().isLoaded).toBe(true)
  })

  it('creates a note from the current draft and marks it as saved', async () => {
    mockedCreateNote.mockResolvedValue(note)
    useNoteStore.getState().selectTarget(target)
    useNoteStore.getState().setDraft('title', note.title)
    useNoteStore.getState().setDraft('contentMarkdown', note.contentMarkdown)

    await useNoteStore.getState().saveDraft()

    expect(mockedCreateNote).toHaveBeenCalledWith({
      contentMarkdown: note.contentMarkdown,
      targetId: target.targetId,
      targetType: target.targetType,
      title: note.title,
    })
    expect(useNoteStore.getState().notes).toEqual([note])
    expect(useNoteStore.getState().selectedNoteId).toBe(note.id)
    expect(useNoteStore.getState().saveStatus).toBe('saved')
  })

  it('loads all subject notes for the aggregate filter', async () => {
    mockedListAllSubjectNotes.mockResolvedValue([note])
    useNoteStore.getState().selectTarget({ targetType: 'all_subjects' })

    await useNoteStore.getState().load()

    expect(mockedListAllSubjectNotes).toHaveBeenCalledOnce()
    expect(useNoteStore.getState().notes).toEqual([note])
  })

  it('updates an existing note while keeping the edited draft on failure', async () => {
    useNoteStore.getState().startEditing(note)
    useNoteStore.getState().setDraft('title', 'Título actualizado')
    mockedUpdateNote.mockRejectedValue(new Error('network failure'))

    await useNoteStore.getState().saveDraft()

    expect(mockedUpdateNote).toHaveBeenCalledWith(note.id, {
      contentMarkdown: note.contentMarkdown,
      title: 'Título actualizado',
    })
    expect(useNoteStore.getState().draft.title).toBe('Título actualizado')
    expect(useNoteStore.getState().error).toBe(
      'No se pudo conectar con Karenda. Revisa tu conexión e inténtalo nuevamente.',
    )
    expect(useNoteStore.getState().saveStatus).toBe('idle')
  })

  it('removes a note only after the delete operation succeeds', async () => {
    mockedDeleteNote.mockResolvedValue(undefined)
    useNoteStore.getState().selectTarget(target)
    useNoteStore.setState({ notes: [note], selectedNoteId: note.id })

    const deleted = await useNoteStore.getState().deleteNote(note.id)

    expect(deleted).toBe(true)
    expect(mockedDeleteNote).toHaveBeenCalledWith(note.id)
    expect(useNoteStore.getState().notes).toEqual([])
    expect(useNoteStore.getState().selectedNoteId).toBeNull()
  })

  it('ignores a stale save after the selected destination changes', async () => {
    const nextTarget = {
      targetId: '66666666-6666-4666-8666-666666666666',
      targetType: 'personal_group' as const,
    }
    let resolveCreate: ((value: Note) => void) | undefined
    mockedCreateNote.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve
        }),
    )
    useNoteStore.getState().selectTarget(target)
    useNoteStore.getState().setDraft('title', 'Nueva nota')

    const savePromise = useNoteStore.getState().saveDraft()
    useNoteStore.getState().selectTarget(nextTarget)
    resolveCreate?.({ ...note, title: 'Nueva nota' })

    await expect(savePromise).resolves.toBeNull()
    expect(useNoteStore.getState().target).toEqual(nextTarget)
    expect(useNoteStore.getState().notes).toEqual([])
  })
})
