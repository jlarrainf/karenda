import { create } from 'zustand'
import type { EntityId, Note } from '../types/domain.ts'
import {
  createNote,
  deleteNote,
  listAllSubjectNotes,
  listNotes,
  updateNote,
} from '../services/noteService.ts'
import { AppError, toAppError } from '../services/errors.ts'
import type { NotePatch } from '../services/validation.ts'
import type { NoteFilter } from '../types/domain.ts'

export interface NoteDraft {
  title: string
  contentMarkdown: string
}

export type NoteSaveStatus = 'idle' | 'saving' | 'saved'

interface NoteState {
  target: NoteFilter | null
  notes: Note[]
  selectedNoteId: EntityId | null
  draft: NoteDraft
  isLoaded: boolean
  isLoading: boolean
  saveStatus: NoteSaveStatus
  error: string | null
  selectTarget: (target: NoteFilter | null) => void
  load: (target?: NoteFilter | null) => Promise<void>
  startEditing: (note: Note) => void
  setDraft: (field: keyof NoteDraft, value: string) => void
  clearDraft: () => void
  saveDraft: () => Promise<Note | null>
  updateNote: (id: string, input: NotePatch) => Promise<Note | null>
  deleteNote: (id: string) => Promise<boolean>
  clearError: () => void
  reset: () => void
}

let noteLoadSequence = 0
let noteMutationSequence = 0

function getErrorMessage(error: unknown, fallback: string): string {
  return toAppError(error, fallback).message
}

function replaceNote(notes: Note[], updatedNote: Note): Note[] {
  return notes.map((note) => (note.id === updatedNote.id ? updatedNote : note))
}

export const useNoteStore = create<NoteState>((set, get) => ({
  target: null,
  notes: [],
  selectedNoteId: null,
  draft: { title: '', contentMarkdown: '' },
  isLoaded: false,
  isLoading: false,
  saveStatus: 'idle',
  error: null,

  selectTarget: (target) => {
    noteLoadSequence += 1
    noteMutationSequence += 1
    set({
      target,
      notes: [],
      selectedNoteId: null,
      draft: { title: '', contentMarkdown: '' },
      isLoaded: false,
      isLoading: false,
      saveStatus: 'idle',
      error: null,
    })
  },

  load: async (target = get().target) => {
    const requestSequence = ++noteLoadSequence

    if (!target) {
      set({ notes: [], isLoaded: true, isLoading: false, error: null })
      return
    }

    set({ target, isLoading: true, error: null })

    try {
      const notes =
        target.targetType === 'all_subjects'
          ? await listAllSubjectNotes()
          : await listNotes(target.targetType, target.targetId)

      if (requestSequence !== noteLoadSequence) {
        return
      }

      set({ notes, isLoaded: true, error: null })
    } catch (error) {
      if (requestSequence === noteLoadSequence) {
        set({
          error: getErrorMessage(error, 'No se pudieron cargar las notas.'),
        })
      }
    } finally {
      if (requestSequence === noteLoadSequence) {
        set({ isLoading: false })
      }
    }
  },

  startEditing: (note) =>
    set({
      selectedNoteId: note.id,
      draft: {
        title: note.title,
        contentMarkdown: note.contentMarkdown,
      },
      saveStatus: 'idle',
      error: null,
    }),

  setDraft: (field, value) =>
    set((state) => ({
      draft: { ...state.draft, [field]: value },
      saveStatus: 'idle',
      error: null,
    })),

  clearDraft: () =>
    set({
      selectedNoteId: null,
      draft: { title: '', contentMarkdown: '' },
      saveStatus: 'idle',
    }),

  saveDraft: async () => {
    const { target, selectedNoteId, draft } = get()
    const createTarget = target && target.targetType !== 'all_subjects' ? target : null

    if (!createTarget && !selectedNoteId) {
      const error = new AppError(
        'validation',
        'Selecciona una asignatura o grupo personal para guardar la nota.',
      )
      set({ error: error.message, saveStatus: 'idle' })
      return null
    }

    const requestSequence = ++noteMutationSequence
    set({ saveStatus: 'saving', error: null })

    try {
      const note = selectedNoteId
        ? await updateNote(selectedNoteId, {
            title: draft.title,
            contentMarkdown: draft.contentMarkdown,
          })
        : await createNote({
            targetType: createTarget!.targetType,
            targetId: createTarget!.targetId,
            title: draft.title,
            contentMarkdown: draft.contentMarkdown,
          })

      if (requestSequence !== noteMutationSequence) {
        return null
      }

      set((state) => ({
        notes: selectedNoteId ? replaceNote(state.notes, note) : [...state.notes, note],
        selectedNoteId: note.id,
        target: selectedNoteId
          ? state.target
          : { targetType: note.targetType, targetId: note.targetId },
        saveStatus: 'saved',
        isLoaded: true,
        error: null,
      }))
      return note
    } catch (error) {
      if (requestSequence === noteMutationSequence) {
        set({
          saveStatus: 'idle',
          error: getErrorMessage(error, 'No se pudo guardar la nota.'),
        })
      }
      return null
    }
  },

  updateNote: async (id, input) => {
    const requestSequence = ++noteMutationSequence
    set({ saveStatus: 'saving', error: null })

    try {
      const note = await updateNote(id, input)
      if (requestSequence !== noteMutationSequence) {
        return null
      }

      set((state) => ({
        notes: replaceNote(state.notes, note),
        selectedNoteId: note.id,
        target:
          state.target?.targetType === 'all_subjects'
            ? state.target
            : { targetType: note.targetType, targetId: note.targetId },
        draft: {
          title: note.title,
          contentMarkdown: note.contentMarkdown,
        },
        saveStatus: 'saved',
        error: null,
      }))
      return note
    } catch (error) {
      if (requestSequence === noteMutationSequence) {
        set({
          saveStatus: 'idle',
          error: getErrorMessage(error, 'No se pudo actualizar la nota.'),
        })
      }
      return null
    }
  },

  deleteNote: async (id) => {
    const requestSequence = ++noteMutationSequence
    set({ saveStatus: 'saving', error: null })

    try {
      await deleteNote(id)
      if (requestSequence !== noteMutationSequence) {
        return true
      }

      set((state) => ({
        notes: state.notes.filter((note) => note.id !== id),
        selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
        draft:
          state.selectedNoteId === id
            ? { title: '', contentMarkdown: '' }
            : state.draft,
        saveStatus: 'idle',
        error: null,
      }))
      return true
    } catch (error) {
      if (requestSequence === noteMutationSequence) {
        set({
          saveStatus: 'idle',
          error: getErrorMessage(error, 'No se pudo eliminar la nota.'),
        })
      }
      return false
    }
  },

  clearError: () => set({ error: null }),

  reset: () => {
    noteLoadSequence += 1
    noteMutationSequence += 1
    set({
      target: null,
      notes: [],
      selectedNoteId: null,
      draft: { title: '', contentMarkdown: '' },
      isLoaded: false,
      isLoading: false,
      saveStatus: 'idle',
      error: null,
    })
  },
}))
