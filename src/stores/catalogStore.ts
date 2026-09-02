import { create } from 'zustand'
import type { PersonalGroup, Subject } from '../types/domain.ts'
import {
  createPersonalGroup,
  deletePersonalGroup,
  listPersonalGroups,
  updatePersonalGroup,
} from '../services/personalGroupService.ts'
import {
  createSubject,
  deleteSubject,
  listSubjects,
  updateSubject,
} from '../services/subjectService.ts'
import { toAppError } from '../services/errors.ts'
import type {
  PersonalGroupInput,
  PersonalGroupPatch,
  SubjectInput,
  SubjectPatch,
} from '../services/validation.ts'

interface CatalogState {
  subjects: Subject[]
  personalGroups: PersonalGroup[]
  isLoaded: boolean
  isLoading: boolean
  isSaving: boolean
  error: string | null
  load: (force?: boolean) => Promise<void>
  refresh: () => Promise<void>
  createSubject: (input: SubjectInput) => Promise<Subject | null>
  updateSubject: (id: string, input: SubjectPatch) => Promise<Subject | null>
  deleteSubject: (id: string) => Promise<boolean>
  createPersonalGroup: (input: PersonalGroupInput) => Promise<PersonalGroup | null>
  updatePersonalGroup: (
    id: string,
    input: PersonalGroupPatch,
  ) => Promise<PersonalGroup | null>
  deletePersonalGroup: (id: string) => Promise<boolean>
  clearError: () => void
  reset: () => void
}

let catalogLoadSequence = 0

function sortByName<T extends { id: string; name: string }>(items: T[]): T[] {
  return [...items].sort(
    (left, right) =>
      left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }) ||
      left.id.localeCompare(right.id),
  )
}

function getErrorMessage(error: unknown, fallback: string): string {
  return toAppError(error, fallback).message
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  subjects: [],
  personalGroups: [],
  isLoaded: false,
  isLoading: false,
  isSaving: false,
  error: null,

  load: async (force = false) => {
    if (!force && (get().isLoaded || get().isLoading)) {
      return
    }

    const requestSequence = ++catalogLoadSequence
    set({ isLoading: true, error: null })

    try {
      const [subjects, personalGroups] = await Promise.all([
        listSubjects(),
        listPersonalGroups(),
      ])

      if (requestSequence !== catalogLoadSequence) {
        return
      }

      set({
        subjects: sortByName(subjects),
        personalGroups: sortByName(personalGroups),
        isLoaded: true,
        error: null,
      })
    } catch (error) {
      if (requestSequence === catalogLoadSequence) {
        set({ error: getErrorMessage(error, 'No se pudo cargar el catálogo.') })
      }
    } finally {
      if (requestSequence === catalogLoadSequence) {
        set({ isLoading: false })
      }
    }
  },

  refresh: async () => {
    await get().load(true)
  },

  createSubject: async (input) => {
    set({ isSaving: true, error: null })

    try {
      const subject = await createSubject(input)
      set((state) => ({
        subjects: sortByName([...state.subjects, subject]),
        isLoaded: true,
        error: null,
      }))
      return subject
    } catch (error) {
      set({ error: getErrorMessage(error, 'No se pudo crear la asignatura.') })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  updateSubject: async (id, input) => {
    set({ isSaving: true, error: null })

    try {
      const subject = await updateSubject(id, input)
      set((state) => ({
        subjects: sortByName(
          state.subjects.map((item) => (item.id === subject.id ? subject : item)),
        ),
        isLoaded: true,
        error: null,
      }))
      return subject
    } catch (error) {
      set({ error: getErrorMessage(error, 'No se pudo actualizar la asignatura.') })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  deleteSubject: async (id) => {
    set({ isSaving: true, error: null })

    try {
      await deleteSubject(id)
      set((state) => ({
        subjects: state.subjects.filter((item) => item.id !== id),
        error: null,
      }))
      return true
    } catch (error) {
      set({
        error: getErrorMessage(
          error,
          'No se pudo eliminar la asignatura. Resuelve primero sus asociaciones.',
        ),
      })
      return false
    } finally {
      set({ isSaving: false })
    }
  },

  createPersonalGroup: async (input) => {
    set({ isSaving: true, error: null })

    try {
      const personalGroup = await createPersonalGroup(input)
      set((state) => ({
        personalGroups: sortByName([...state.personalGroups, personalGroup]),
        isLoaded: true,
        error: null,
      }))
      return personalGroup
    } catch (error) {
      set({
        error: getErrorMessage(error, 'No se pudo crear el grupo personal.'),
      })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  updatePersonalGroup: async (id, input) => {
    set({ isSaving: true, error: null })

    try {
      const personalGroup = await updatePersonalGroup(id, input)
      set((state) => ({
        personalGroups: sortByName(
          state.personalGroups.map((item) =>
            item.id === personalGroup.id ? personalGroup : item,
          ),
        ),
        isLoaded: true,
        error: null,
      }))
      return personalGroup
    } catch (error) {
      set({
        error: getErrorMessage(error, 'No se pudo actualizar el grupo personal.'),
      })
      return null
    } finally {
      set({ isSaving: false })
    }
  },

  deletePersonalGroup: async (id) => {
    set({ isSaving: true, error: null })

    try {
      await deletePersonalGroup(id)
      set((state) => ({
        personalGroups: state.personalGroups.filter((item) => item.id !== id),
        error: null,
      }))
      return true
    } catch (error) {
      set({
        error: getErrorMessage(
          error,
          'No se pudo eliminar el grupo personal. Resuelve primero sus asociaciones.',
        ),
      })
      return false
    } finally {
      set({ isSaving: false })
    }
  },

  clearError: () => set({ error: null }),

  reset: () => {
    catalogLoadSequence += 1
    set({
      subjects: [],
      personalGroups: [],
      isLoaded: false,
      isLoading: false,
      isSaving: false,
      error: null,
    })
  },
}))
