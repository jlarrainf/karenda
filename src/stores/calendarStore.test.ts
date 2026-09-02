import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from '../types/domain.ts'
import {
  createEvent,
  deleteEvent,
  listEvents,
  listUpcomingEvents,
  updateEvent,
  updateEventStatus,
} from '../services/eventService.ts'
import type { EventRange } from '../services/validation.ts'
import { useCalendarStore } from './calendarStore.ts'

vi.mock('../services/eventService.ts', () => ({
  createEvent: vi.fn(),
  deleteEvent: vi.fn(),
  listEvents: vi.fn(),
  listUpcomingEvents: vi.fn(),
  updateEvent: vi.fn(),
  updateEventStatus: vi.fn(),
}))

const range: EventRange = {
  endAt: '2026-10-01T00:00:00.000Z',
  startAt: '2026-09-01T00:00:00.000Z',
}

const event: CalendarEvent = {
  createdAt: '2026-08-30T10:00:00.000Z',
  description: null,
  endAt: null,
  id: '44444444-4444-4444-8444-444444444444',
  isAllDay: false,
  kind: 'academic',
  location: null,
  ownerId: '22222222-2222-4222-8222-222222222222',
  personalGroupId: null,
  startAt: '2026-09-10T10:00:00-03:00',
  status: 'pending',
  subjectId: '11111111-1111-4111-8111-111111111111',
  title: 'Control 1',
  updatedAt: '2026-08-30T10:00:00.000Z',
}

const mockedCreateEvent = vi.mocked(createEvent)
const mockedDeleteEvent = vi.mocked(deleteEvent)
const mockedListEvents = vi.mocked(listEvents)
const mockedListUpcomingEvents = vi.mocked(listUpcomingEvents)
const mockedUpdateEvent = vi.mocked(updateEvent)
const mockedUpdateEventStatus = vi.mocked(updateEventStatus)

describe('calendarStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCalendarStore.getState().reset()
  })

  it('loads a visible range once and reuses it until forced', async () => {
    mockedListEvents.mockResolvedValue([event])

    await useCalendarStore.getState().load(range)
    await useCalendarStore.getState().load(range)

    expect(mockedListEvents).toHaveBeenCalledTimes(1)
    expect(useCalendarStore.getState().events).toEqual([event])
    expect(useCalendarStore.getState().visibleRange).toEqual(range)
  })

  it('refreshes the visible range after a status mutation', async () => {
    mockedListEvents.mockResolvedValue([event])
    mockedUpdateEventStatus.mockResolvedValue({ ...event, status: 'completed' })

    await useCalendarStore.getState().load(range)
    await useCalendarStore.getState().updateEventStatus(event.id, 'completed')

    expect(mockedUpdateEventStatus).toHaveBeenCalledWith(event.id, 'completed')
    expect(mockedListEvents).toHaveBeenCalledTimes(2)
  })

  it('refreshes the visible range after creating an event', async () => {
    mockedListEvents.mockResolvedValue([event])
    mockedCreateEvent.mockResolvedValue(event)

    await useCalendarStore.getState().load(range)
    await useCalendarStore.getState().createEvent({
      kind: 'academic',
      startAt: '2026-09-10T10:00',
      subjectId: event.subjectId,
      title: event.title,
    })

    expect(mockedCreateEvent).toHaveBeenCalledOnce()
    expect(mockedListEvents).toHaveBeenCalledTimes(2)
  })

  it('refreshes the visible range after updating an event', async () => {
    mockedListEvents.mockResolvedValue([event])
    mockedUpdateEvent.mockResolvedValue({ ...event, title: 'Control actualizado' })

    await useCalendarStore.getState().load(range)
    await useCalendarStore
      .getState()
      .updateEvent(event.id, { title: 'Control actualizado' })

    expect(mockedUpdateEvent).toHaveBeenCalledWith(event.id, {
      title: 'Control actualizado',
    })
    expect(mockedListEvents).toHaveBeenCalledTimes(2)
  })

  it('refreshes the visible range after deleting an event', async () => {
    mockedListEvents.mockResolvedValue([event])
    mockedDeleteEvent.mockResolvedValue(undefined)

    await useCalendarStore.getState().load(range)
    await expect(useCalendarStore.getState().deleteEvent(event.id)).resolves.toBe(true)

    expect(mockedDeleteEvent).toHaveBeenCalledWith(event.id)
    expect(mockedListEvents).toHaveBeenCalledTimes(2)
  })

  it('loads upcoming events once and keeps the agenda start date', async () => {
    const startAt = '2026-08-30'
    mockedListUpcomingEvents.mockResolvedValue([event])

    await useCalendarStore.getState().loadAgenda(startAt)
    await useCalendarStore.getState().loadAgenda(startAt)

    expect(mockedListUpcomingEvents).toHaveBeenCalledOnce()
    expect(mockedListUpcomingEvents).toHaveBeenCalledWith(startAt)
    expect(useCalendarStore.getState().agendaStartAt).toBe(startAt)
    expect(useCalendarStore.getState().visibleRange).toBeNull()
    expect(useCalendarStore.getState().events).toEqual([event])
  })
})
