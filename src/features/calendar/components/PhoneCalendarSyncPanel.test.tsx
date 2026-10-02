import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from '../../../types/domain.ts'
import { useCalendarStore } from '../../../stores/calendarStore.ts'
import { useCatalogStore } from '../../../stores/catalogStore.ts'
import type { PhoneCalendarSyncStatus } from '../../../services/phoneCalendarSyncService.ts'
import { PhoneCalendarSyncPanel } from './PhoneCalendarSyncPanel.tsx'

const phoneCalendarServiceMock = vi.hoisted(() => ({
  getPhoneCalendarSyncStatus: vi.fn(),
  requestPhoneCalendarPermission: vi.fn(),
  setPhoneCalendarSyncEnabled: vi.fn(),
  syncPhoneCalendar: vi.fn(),
}))

vi.mock('../../../services/phoneCalendarSyncService.ts', () => phoneCalendarServiceMock)

const connectedStatus: PhoneCalendarSyncStatus = {
  available: true,
  enabled: true,
  lastSyncedAt: '2026-09-01T12:00:00.000Z',
  eventCount: 2,
  calendarCount: 3,
}

const disconnectedStatus: PhoneCalendarSyncStatus = {
  available: true,
  enabled: false,
  lastSyncedAt: null,
  eventCount: 0,
  calendarCount: 0,
}

const event: CalendarEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  ownerId: '22222222-2222-4222-8222-222222222222',
  kind: 'academic',
  title: 'Control 1',
  subjectId: null,
  personalGroupId: null,
  startAt: '2026-09-10T13:00:00.000Z',
  endAt: null,
  isAllDay: false,
  status: 'pending',
  location: null,
  description: null,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
}

function resetStores() {
  useCalendarStore.getState().reset()
  useCatalogStore.getState().reset()
}

describe('PhoneCalendarSyncPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    resetStores()
    phoneCalendarServiceMock.getPhoneCalendarSyncStatus.mockResolvedValue({
      ...disconnectedStatus,
      available: false,
    })
    phoneCalendarServiceMock.requestPhoneCalendarPermission.mockResolvedValue(true)
    phoneCalendarServiceMock.setPhoneCalendarSyncEnabled.mockResolvedValue(undefined)
    phoneCalendarServiceMock.syncPhoneCalendar.mockResolvedValue(connectedStatus)
  })

  it('explains that direct synchronization requires the Android app in a browser', async () => {
    render(<PhoneCalendarSyncPanel />)

    expect(
      await screen.findByText(/disponible en la app Android de Karenda/),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Conectar calendario del teléfono' }),
    ).not.toBeInTheDocument()
  })

  it('asks for calendar permission, enables sync and performs the initial copy', async () => {
    const user = userEvent.setup()
    phoneCalendarServiceMock.getPhoneCalendarSyncStatus.mockResolvedValue(
      disconnectedStatus,
    )
    render(<PhoneCalendarSyncPanel />)

    await user.click(
      await screen.findByRole('button', { name: 'Conectar calendario del teléfono' }),
    )

    expect(
      phoneCalendarServiceMock.requestPhoneCalendarPermission,
    ).toHaveBeenCalledOnce()
    expect(phoneCalendarServiceMock.setPhoneCalendarSyncEnabled).toHaveBeenCalledWith(
      true,
    )
    expect(phoneCalendarServiceMock.syncPhoneCalendar).toHaveBeenCalledOnce()
    expect(
      await screen.findByText('Se sincronizaron 2 eventos en 3 calendarios.'),
    ).toBeVisible()
  })

  it('does not enable synchronization when Android permission is denied', async () => {
    const user = userEvent.setup()
    phoneCalendarServiceMock.getPhoneCalendarSyncStatus.mockResolvedValue(
      disconnectedStatus,
    )
    phoneCalendarServiceMock.requestPhoneCalendarPermission.mockResolvedValue(false)
    render(<PhoneCalendarSyncPanel />)

    await user.click(
      await screen.findByRole('button', { name: 'Conectar calendario del teléfono' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se concedió el permiso.',
    )
    expect(phoneCalendarServiceMock.setPhoneCalendarSyncEnabled).not.toHaveBeenCalled()
    expect(phoneCalendarServiceMock.syncPhoneCalendar).not.toHaveBeenCalled()
  })

  it('syncs when calendar data changes and lets the person pause without deleting copies', async () => {
    const user = userEvent.setup()
    phoneCalendarServiceMock.getPhoneCalendarSyncStatus.mockResolvedValue(
      connectedStatus,
    )
    useCalendarStore.setState({
      events: [event],
      eventMutationVersion: 0,
      isLoaded: true,
    })
    useCatalogStore.setState({ isLoaded: true })
    render(<PhoneCalendarSyncPanel />)

    await waitFor(() =>
      expect(phoneCalendarServiceMock.syncPhoneCalendar).toHaveBeenCalledOnce(),
    )
    act(() => {
      useCalendarStore.setState({
        events: [
          { ...event, title: 'Control 2', updatedAt: '2026-09-02T12:00:00.000Z' },
        ],
      })
    })
    await waitFor(() =>
      expect(phoneCalendarServiceMock.syncPhoneCalendar).toHaveBeenCalledTimes(2),
    )
    act(() => {
      useCalendarStore.setState({ eventMutationVersion: 1 })
    })
    await waitFor(() =>
      expect(phoneCalendarServiceMock.syncPhoneCalendar).toHaveBeenCalledTimes(3),
    )

    await user.click(screen.getByRole('button', { name: 'Pausar' }))
    expect(
      phoneCalendarServiceMock.setPhoneCalendarSyncEnabled,
    ).toHaveBeenLastCalledWith(false)
    expect(
      await screen.findByText(/Las copias que ya están en el teléfono se conservarán/),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Reanudar sincronización' }),
    ).toBeVisible()
  })

  it('queues a calendar change that arrives during an active synchronization', async () => {
    let completeFirstSync: ((status: PhoneCalendarSyncStatus) => void) | undefined
    phoneCalendarServiceMock.getPhoneCalendarSyncStatus.mockResolvedValue(
      connectedStatus,
    )
    phoneCalendarServiceMock.syncPhoneCalendar.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeFirstSync = resolve
        }),
    )
    useCalendarStore.setState({ events: [event], isLoaded: true })
    useCatalogStore.setState({ isLoaded: true })
    render(<PhoneCalendarSyncPanel />)

    await waitFor(() =>
      expect(phoneCalendarServiceMock.syncPhoneCalendar).toHaveBeenCalledOnce(),
    )
    act(() => {
      useCalendarStore.setState({
        events: [
          {
            ...event,
            title: 'Control actualizado',
            updatedAt: '2026-09-02T12:00:00.000Z',
          },
        ],
      })
    })
    expect(phoneCalendarServiceMock.syncPhoneCalendar).toHaveBeenCalledOnce()

    await act(async () => {
      completeFirstSync?.(connectedStatus)
    })
    await waitFor(() =>
      expect(phoneCalendarServiceMock.syncPhoneCalendar).toHaveBeenCalledTimes(2),
    )
  })

  it('synchronizes on the fifteen-minute foreground interval', async () => {
    const intervalSpy = vi.spyOn(window, 'setInterval')
    phoneCalendarServiceMock.getPhoneCalendarSyncStatus.mockResolvedValue(
      connectedStatus,
    )
    render(<PhoneCalendarSyncPanel />)

    await screen.findByRole('button', { name: 'Sincronizar ahora' })
    const intervalCallback = intervalSpy.mock.calls.find(
      ([, delay]) => delay === 15 * 60 * 1000,
    )?.[0]
    expect(intervalCallback).toEqual(expect.any(Function))

    await act(async () => {
      if (typeof intervalCallback === 'function') intervalCallback()
    })
    await waitFor(() =>
      expect(phoneCalendarServiceMock.syncPhoneCalendar).toHaveBeenCalledOnce(),
    )
    intervalSpy.mockRestore()
  })
})
