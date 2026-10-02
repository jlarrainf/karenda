import { Capacitor, registerPlugin } from '@capacitor/core'
import { AppError } from './errors.ts'
import { listAllEvents } from './eventService.ts'
import { listPersonalGroups } from './personalGroupService.ts'
import { listSubjects } from './subjectService.ts'
import { mapEventsForPhoneCalendar } from '../features/calendar/utils/phoneCalendarMapper.ts'
import type { PhoneCalendarPayload } from '../features/calendar/utils/phoneCalendarMapper.ts'

export interface PhoneCalendarSyncStatus {
  available: boolean
  enabled: boolean
  lastSyncedAt: string | null
  eventCount: number
  calendarCount: number
}

interface PhoneCalendarNativePlugin {
  getStatus(): Promise<Omit<PhoneCalendarSyncStatus, 'available'>>
  requestCalendarPermission(): Promise<{ granted: boolean }>
  setEnabled(options: { enabled: boolean }): Promise<void>
  sync(
    options: PhoneCalendarPayload,
  ): Promise<Omit<PhoneCalendarSyncStatus, 'available'>>
}

const phoneCalendarPlugin = registerPlugin<PhoneCalendarNativePlugin>('PhoneCalendar')

function isPhoneCalendarAvailable(): boolean {
  return (
    Capacitor.getPlatform() === 'android' &&
    Capacitor.isPluginAvailable('PhoneCalendar')
  )
}

function unavailableStatus(): PhoneCalendarSyncStatus {
  return {
    available: false,
    enabled: false,
    lastSyncedAt: null,
    eventCount: 0,
    calendarCount: 0,
  }
}

function withAvailability(
  status: Omit<PhoneCalendarSyncStatus, 'available'>,
): PhoneCalendarSyncStatus {
  return { ...status, available: true }
}

export async function getPhoneCalendarSyncStatus(): Promise<PhoneCalendarSyncStatus> {
  if (!isPhoneCalendarAvailable()) return unavailableStatus()
  return withAvailability(await phoneCalendarPlugin.getStatus())
}

export async function requestPhoneCalendarPermission(): Promise<boolean> {
  if (!isPhoneCalendarAvailable()) {
    throw new AppError(
      'forbidden',
      'La sincronización directa requiere la app Android de Karenda.',
    )
  }

  const result = await phoneCalendarPlugin.requestCalendarPermission()
  return result.granted
}

export async function setPhoneCalendarSyncEnabled(enabled: boolean): Promise<void> {
  if (!isPhoneCalendarAvailable()) {
    throw new AppError(
      'forbidden',
      'La sincronización directa requiere la app Android de Karenda.',
    )
  }

  await phoneCalendarPlugin.setEnabled({ enabled })
}

export async function syncPhoneCalendar(): Promise<PhoneCalendarSyncStatus> {
  if (!isPhoneCalendarAvailable()) {
    throw new AppError(
      'forbidden',
      'La sincronización directa requiere la app Android de Karenda.',
    )
  }

  const [events, subjects, personalGroups] = await Promise.all([
    listAllEvents(),
    listSubjects(),
    listPersonalGroups(),
  ])
  const payload = mapEventsForPhoneCalendar(events, subjects, personalGroups)
  const status = await phoneCalendarPlugin.sync(payload)
  return withAvailability(status)
}
