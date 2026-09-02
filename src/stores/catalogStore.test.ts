import { beforeEach, describe, expect, it, vi } from 'vitest'
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
import { useCatalogStore } from './catalogStore.ts'

vi.mock('../services/subjectService.ts', () => ({
  createSubject: vi.fn(),
  deleteSubject: vi.fn(),
  listSubjects: vi.fn(),
  updateSubject: vi.fn(),
}))

vi.mock('../services/personalGroupService.ts', () => ({
  createPersonalGroup: vi.fn(),
  deletePersonalGroup: vi.fn(),
  listPersonalGroups: vi.fn(),
  updatePersonalGroup: vi.fn(),
}))

const ownerId = '22222222-2222-4222-8222-222222222222'
const timestamp = '2026-08-30T10:00:00.000Z'

const firstSubject: Subject = {
  abbreviation: 'Z',
  code: 'Z-101',
  color: '#2F625A',
  createdAt: timestamp,
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Zoología',
  ownerId,
  updatedAt: timestamp,
}

const secondSubject: Subject = {
  ...firstSubject,
  abbreviation: 'A',
  code: 'A-101',
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Álgebra',
}

const group: PersonalGroup = {
  color: null,
  createdAt: timestamp,
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Salud',
  ownerId,
  updatedAt: timestamp,
}

const mockedCreatePersonalGroup = vi.mocked(createPersonalGroup)
const mockedCreateSubject = vi.mocked(createSubject)
const mockedDeletePersonalGroup = vi.mocked(deletePersonalGroup)
const mockedDeleteSubject = vi.mocked(deleteSubject)
const mockedListPersonalGroups = vi.mocked(listPersonalGroups)
const mockedListSubjects = vi.mocked(listSubjects)
const mockedUpdatePersonalGroup = vi.mocked(updatePersonalGroup)
const mockedUpdateSubject = vi.mocked(updateSubject)

describe('catalogStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCatalogStore.getState().reset()
  })

  it('loads and sorts both catalogs while preserving the loaded state', async () => {
    mockedListSubjects.mockResolvedValue([firstSubject, secondSubject])
    mockedListPersonalGroups.mockResolvedValue([group])

    await useCatalogStore.getState().load()

    expect(useCatalogStore.getState().subjects.map((item) => item.name)).toEqual([
      'Álgebra',
      'Zoología',
    ])
    expect(useCatalogStore.getState().personalGroups).toEqual([group])
    expect(useCatalogStore.getState().isLoaded).toBe(true)
    expect(useCatalogStore.getState().error).toBeNull()
  })

  it('updates local catalog state only after successful mutations', async () => {
    mockedCreateSubject.mockResolvedValue(firstSubject)
    mockedCreatePersonalGroup.mockResolvedValue(group)
    mockedUpdateSubject.mockResolvedValue({ ...firstSubject, name: 'Álgebra avanzada' })
    mockedUpdatePersonalGroup.mockResolvedValue({ ...group, name: 'Bienestar' })

    await useCatalogStore.getState().createSubject({
      abbreviation: 'Z',
      code: 'Z-101',
      color: '#2F625A',
      name: 'Zoología',
    })
    await useCatalogStore.getState().createPersonalGroup({ name: 'Salud' })
    await useCatalogStore.getState().updateSubject(firstSubject.id, {
      name: 'Álgebra avanzada',
    })
    await useCatalogStore
      .getState()
      .updatePersonalGroup(group.id, { name: 'Bienestar' })

    expect(useCatalogStore.getState().subjects[0]?.name).toBe('Álgebra avanzada')
    expect(useCatalogStore.getState().personalGroups[0]?.name).toBe('Bienestar')
    expect(useCatalogStore.getState().isSaving).toBe(false)
  })

  it('keeps catalog rows when deletion fails and exposes the translated error', async () => {
    useCatalogStore.setState({ subjects: [firstSubject], personalGroups: [group] })
    mockedDeleteSubject.mockRejectedValue(
      new Error('delete violates foreign key; recurso asociado'),
    )
    mockedDeletePersonalGroup.mockResolvedValue(undefined)

    await expect(
      useCatalogStore.getState().deleteSubject(firstSubject.id),
    ).resolves.toBe(false)
    expect(useCatalogStore.getState().subjects).toEqual([firstSubject])
    expect(useCatalogStore.getState().error).toContain('eventos o notas asociadas')

    await expect(
      useCatalogStore.getState().deletePersonalGroup(group.id),
    ).resolves.toBe(true)
    expect(useCatalogStore.getState().personalGroups).toEqual([])
  })
})
