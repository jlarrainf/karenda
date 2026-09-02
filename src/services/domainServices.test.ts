import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '../lib/insforge/database.types.ts'
import { createEvent, deleteEvent, listEvents, updateEvent } from './eventService.ts'
import {
  createNote,
  listAllSubjectNotes,
  listNotes,
  updateNote,
} from './noteService.ts'
import {
  createPersonalGroup,
  listPersonalGroups,
  updatePersonalGroup,
} from './personalGroupService.ts'
import { createSubject, listSubjects, updateSubject } from './subjectService.ts'

const mocks = vi.hoisted(() => {
  const createQuery = () => {
    const query = {
      delete: vi.fn(),
      eq: vi.fn(),
      insert: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(),
      order: vi.fn(),
      or: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
      update: vi.fn(),
    }

    query.delete.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.insert.mockReturnValue(query)
    query.limit.mockReturnValue(query)
    query.maybeSingle.mockReturnValue(query)
    query.order.mockReturnValue(query)
    query.or.mockReturnValue(query)
    query.select.mockReturnValue(query)
    query.single.mockReturnValue(query)
    query.update.mockReturnValue(query)

    return query
  }

  return {
    databaseFrom: vi.fn(),
    primaryQuery: createQuery(),
    secondaryQuery: createQuery(),
    requireCurrentUserId: vi.fn(),
  }
})

vi.mock('../lib/insforge/client.ts', () => ({
  insforge: {
    database: {
      from: mocks.databaseFrom,
    },
  },
}))

vi.mock('./authService.ts', () => ({
  requireCurrentUserId: mocks.requireCurrentUserId,
}))

type SubjectRow = Database['public']['Tables']['subjects']['Row']
type PersonalGroupRow = Database['public']['Tables']['personal_groups']['Row']
type EventRow = Database['public']['Tables']['events']['Row']
type NoteRow = Database['public']['Tables']['notes']['Row']

const ownerId = '22222222-2222-4222-8222-222222222222'
const subjectId = '11111111-1111-4111-8111-111111111111'
const groupId = '33333333-3333-4333-8333-333333333333'
const eventId = '44444444-4444-4444-8444-444444444444'
const noteId = '55555555-5555-4555-8555-555555555555'
const timestamp = '2026-08-30T10:00:00.000Z'

const subjectRow: SubjectRow = {
  abbreviation: 'ALG',
  code: 'MAT-101',
  color: '#2F625A',
  created_at: timestamp,
  id: subjectId,
  name: 'Álgebra',
  owner_id: ownerId,
  updated_at: timestamp,
}

const personalGroupRow: PersonalGroupRow = {
  color: '#8A5A20',
  created_at: timestamp,
  id: groupId,
  name: 'Salud',
  owner_id: ownerId,
  updated_at: timestamp,
}

const eventRow: EventRow = {
  created_at: timestamp,
  description: 'Repasar derivadas.',
  end_at: null,
  id: eventId,
  is_all_day: false,
  kind: 'academic',
  location: 'Sala 12',
  owner_id: ownerId,
  personal_group_id: null,
  start_at: '2026-09-10T13:00:00.000Z',
  status: 'pending',
  subject_id: subjectId,
  title: 'Control 1',
  updated_at: timestamp,
}

const noteRow: NoteRow = {
  content_markdown: '**Resumen**',
  created_at: timestamp,
  id: noteId,
  owner_id: ownerId,
  target_id: subjectId,
  target_type: 'subject',
  title: 'Resumen',
  updated_at: timestamp,
}

function resetMocks() {
  vi.resetAllMocks()
  mocks.requireCurrentUserId.mockResolvedValue(ownerId)
  mocks.databaseFrom.mockReturnValue(mocks.primaryQuery)

  for (const query of [mocks.primaryQuery, mocks.secondaryQuery]) {
    query.delete.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.insert.mockReturnValue(query)
    query.limit.mockReturnValue(query)
    query.maybeSingle.mockReturnValue(query)
    query.order.mockReturnValue(query)
    query.or.mockReturnValue(query)
    query.select.mockReturnValue(query)
    query.single.mockReturnValue(query)
    query.update.mockReturnValue(query)
  }
}

describe('domain services', () => {
  beforeEach(resetMocks)

  it('RF-03 lists and maps subjects using the authenticated owner', async () => {
    mocks.primaryQuery.limit.mockResolvedValue({ data: [subjectRow], error: null })

    const subjects = await listSubjects()

    expect(subjects).toEqual([
      {
        abbreviation: 'ALG',
        code: 'MAT-101',
        color: '#2F625A',
        createdAt: timestamp,
        id: subjectId,
        name: 'Álgebra',
        ownerId,
        updatedAt: timestamp,
      },
    ])
    expect(mocks.databaseFrom).toHaveBeenCalledWith('subjects')
    expect(mocks.primaryQuery.eq).toHaveBeenCalledWith('owner_id', ownerId)
  })

  it('RF-04 inserts and maps a subject without trusting client ownership', async () => {
    mocks.primaryQuery.single.mockResolvedValue({ data: subjectRow, error: null })

    await createSubject({
      abbreviation: 'ALG',
      code: 'MAT-101',
      color: '#2F625A',
      name: 'Álgebra',
    })

    expect(mocks.primaryQuery.insert).toHaveBeenCalledWith([
      {
        abbreviation: 'ALG',
        code: 'MAT-101',
        color: '#2F625A',
        name: 'Álgebra',
        owner_id: ownerId,
      },
    ])
  })

  it('RF-05 updates only the requested subject fields and maps the response', async () => {
    mocks.primaryQuery.single.mockResolvedValue({
      data: { ...subjectRow, name: 'Álgebra avanzada' },
      error: null,
    })

    const subject = await updateSubject(subjectId, { name: 'Álgebra avanzada' })

    expect(subject.name).toBe('Álgebra avanzada')
    expect(mocks.primaryQuery.update).toHaveBeenCalledWith({ name: 'Álgebra avanzada' })
    expect(mocks.primaryQuery.eq).toHaveBeenCalledWith('id', subjectId)
    expect(mocks.primaryQuery.eq).toHaveBeenCalledWith('owner_id', ownerId)
  })

  it('RF-07 lists, creates and updates personal groups with optional colors', async () => {
    mocks.primaryQuery.limit.mockResolvedValue({
      data: [personalGroupRow],
      error: null,
    })
    await expect(listPersonalGroups()).resolves.toHaveLength(1)

    mocks.primaryQuery.single.mockResolvedValue({ data: personalGroupRow, error: null })
    await createPersonalGroup({ color: '#8A5A20', name: 'Salud' })
    expect(mocks.primaryQuery.insert).toHaveBeenCalledWith([
      { color: '#8A5A20', name: 'Salud', owner_id: ownerId },
    ])

    mocks.primaryQuery.single.mockResolvedValue({
      data: { ...personalGroupRow, color: null, name: 'Bienestar' },
      error: null,
    })
    const group = await updatePersonalGroup(groupId, { color: null, name: 'Bienestar' })
    expect(group.color).toBeNull()
    expect(mocks.primaryQuery.update).toHaveBeenCalledWith({
      color: null,
      name: 'Bienestar',
    })
  })

  it('RF-10 and RF-14 serializes and maps event date contracts', async () => {
    mocks.primaryQuery.single.mockResolvedValue({ data: eventRow, error: null })

    await createEvent({
      description: 'Repasar derivadas.',
      endAt: null,
      isAllDay: false,
      kind: 'academic',
      location: 'Sala 12',
      personalGroupId: null,
      startAt: '2026-09-10T10:00',
      status: 'pending',
      subjectId,
      title: 'Control 1',
    })

    expect(mocks.primaryQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        end_at: null,
        owner_id: ownerId,
        start_at: new Date('2026-09-10T10:00').toISOString(),
      }),
    ])

    mocks.secondaryQuery.maybeSingle.mockResolvedValue({ data: eventRow, error: null })
    mocks.databaseFrom
      .mockReturnValueOnce(mocks.secondaryQuery)
      .mockReturnValueOnce(mocks.primaryQuery)
    mocks.primaryQuery.single.mockResolvedValue({
      data: { ...eventRow, status: 'completed' },
      error: null,
    })
    const updated = await updateEvent(eventId, { status: 'completed' })

    expect(updated.status).toBe('completed')
    expect(mocks.primaryQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    )
  })

  it('RF-17 queries timed events by local boundaries and all-day events by date boundaries', async () => {
    mocks.primaryQuery.limit.mockResolvedValue({ data: [eventRow], error: null })

    await listEvents({
      endAt: '2026-10-01',
      startAt: '2026-09-01',
    })

    expect(mocks.primaryQuery.or).toHaveBeenCalledWith(
      expect.stringContaining('is_all_day.eq.true'),
    )
    expect(mocks.primaryQuery.or).toHaveBeenCalledWith(
      expect.stringContaining('2026-09-01T00:00:00.000Z'),
    )
    expect(mocks.primaryQuery.or).toHaveBeenCalledWith(
      expect.stringContaining(new Date(2026, 8, 1).toISOString()),
    )
  })

  it('scopes event deletion to the authenticated owner', async () => {
    mocks.secondaryQuery.maybeSingle.mockResolvedValue({ data: eventRow, error: null })
    mocks.databaseFrom
      .mockReturnValueOnce(mocks.secondaryQuery)
      .mockReturnValueOnce(mocks.primaryQuery)

    await deleteEvent(eventId)

    expect(mocks.primaryQuery.delete).toHaveBeenCalledOnce()
    expect(mocks.primaryQuery.eq).toHaveBeenCalledWith('id', eventId)
    expect(mocks.primaryQuery.eq).toHaveBeenCalledWith('owner_id', ownerId)
  })

  it('RF-25 preserves Markdown and filters notes by target and owner', async () => {
    mocks.primaryQuery.limit.mockResolvedValue({ data: [noteRow], error: null })
    const notes = await listNotes('subject', subjectId)

    expect(notes[0]?.contentMarkdown).toBe('**Resumen**')
    expect(mocks.primaryQuery.eq).toHaveBeenCalledWith('owner_id', ownerId)
    expect(mocks.primaryQuery.eq).toHaveBeenCalledWith('target_type', 'subject')
    expect(mocks.primaryQuery.eq).toHaveBeenCalledWith('target_id', subjectId)

    mocks.primaryQuery.single.mockResolvedValue({ data: noteRow, error: null })
    await createNote({
      contentMarkdown: '**Resumen**',
      targetId: subjectId,
      targetType: 'subject',
      title: 'Resumen',
    })
    expect(mocks.primaryQuery.insert).toHaveBeenCalledWith([
      {
        content_markdown: '**Resumen**',
        owner_id: ownerId,
        target_id: subjectId,
        target_type: 'subject',
        title: 'Resumen',
      },
    ])

    const updatedNoteRow = { ...noteRow, content_markdown: '# Actualizado' }
    mocks.primaryQuery.single.mockResolvedValue({ data: updatedNoteRow, error: null })
    const updated = await updateNote(noteId, { contentMarkdown: '# Actualizado' })
    expect(updated.contentMarkdown).toBe('# Actualizado')
    expect(mocks.primaryQuery.update).toHaveBeenCalledWith({
      content_markdown: '# Actualizado',
    })
  })

  it('lists every subject note for the aggregate notes filter', async () => {
    mocks.primaryQuery.limit.mockResolvedValue({ data: [noteRow], error: null })

    const notes = await listAllSubjectNotes()

    expect(notes).toHaveLength(1)
    expect(mocks.primaryQuery.eq).toHaveBeenCalledWith('owner_id', ownerId)
    expect(mocks.primaryQuery.eq).toHaveBeenCalledWith('target_type', 'subject')
  })
})
