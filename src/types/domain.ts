export type EntityId = string
export type IsoDateTime = string

export type EventKind = 'academic' | 'personal'
export type EventStatus = 'pending' | 'completed'
export type NoteTargetType = 'subject' | 'personal_group'

export interface NoteTarget {
  targetType: NoteTargetType
  targetId: EntityId
}

export interface AllSubjectsNoteFilter {
  targetType: 'all_subjects'
}

export type NoteFilter = NoteTarget | AllSubjectsNoteFilter

export interface Subject {
  id: EntityId
  ownerId: EntityId
  name: string
  code: string
  abbreviation: string
  color: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface PersonalGroup {
  id: EntityId
  ownerId: EntityId
  name: string
  color: string | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface CalendarEvent {
  id: EntityId
  ownerId: EntityId
  kind: EventKind
  title: string
  subjectId: EntityId | null
  personalGroupId: EntityId | null
  startAt: IsoDateTime
  endAt: IsoDateTime | null
  isAllDay: boolean
  status: EventStatus
  location: string | null
  description: string | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface Note {
  id: EntityId
  ownerId: EntityId
  targetType: NoteTargetType
  targetId: EntityId
  title: string
  contentMarkdown: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}
