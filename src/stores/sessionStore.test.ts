import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserSchema } from '@insforge/sdk'
import {
  getCurrentUser,
  onAuthStateChange,
  register,
  signIn,
  signOut,
  verifyEmail,
} from '../services/authService.ts'
import { useCatalogStore } from './catalogStore.ts'
import { useCalendarStore } from './calendarStore.ts'
import { useHabitStore } from './habitStore.ts'
import { useNoteStore } from './noteStore.ts'
import { useRecurringTaskStore } from './recurringTaskStore.ts'
import { useSessionStore } from './sessionStore.ts'
import { SESSION_EXPIRED_EVENT } from '../services/errors.ts'

vi.mock('../services/authService.ts', () => ({
  getCurrentUser: vi.fn(),
  onAuthStateChange: vi.fn(() => vi.fn()),
  register: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  verifyEmail: vi.fn(),
}))

const user = {
  email: 'estudiante@example.com',
  id: '11111111-1111-4111-8111-111111111111',
} as UserSchema

const mockedGetCurrentUser = vi.mocked(getCurrentUser)
const mockedOnAuthStateChange = vi.mocked(onAuthStateChange)
const mockedRegister = vi.mocked(register)
const mockedSignIn = vi.mocked(signIn)
const mockedSignOut = vi.mocked(signOut)
const mockedVerifyEmail = vi.mocked(verifyEmail)

describe('sessionStore', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    useSessionStore.setState({
      error: null,
      isInitialized: false,
      isLoading: false,
      user: null,
    })
    useCatalogStore.getState().reset()
    useCalendarStore.getState().reset()
    useHabitStore.getState().reset()
    useNoteStore.getState().reset()
    useRecurringTaskStore.getState().reset()
    mockedOnAuthStateChange.mockReturnValue(vi.fn())
  })

  it('initializes the current user and subscribes to auth changes once', async () => {
    mockedGetCurrentUser.mockResolvedValue(user)

    await useSessionStore.getState().initialize()
    await useSessionStore.getState().initialize()

    expect(mockedGetCurrentUser).toHaveBeenCalledOnce()
    expect(mockedOnAuthStateChange).toHaveBeenCalledOnce()
    expect(useSessionStore.getState().user).toBe(user)
    expect(useSessionStore.getState().isInitialized).toBe(true)
  })

  it('shares concurrent session checks instead of refreshing twice', async () => {
    let resolveUser: ((value: UserSchema) => void) | undefined
    mockedGetCurrentUser.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUser = resolve
        }),
    )

    const initialization = useSessionStore.getState().initialize()
    const refresh = useSessionStore.getState().refresh()

    expect(mockedGetCurrentUser).toHaveBeenCalledOnce()

    resolveUser?.(user)
    await Promise.all([initialization, refresh])

    expect(useSessionStore.getState().user).toBe(user)
    expect(useSessionStore.getState().isLoading).toBe(false)
  })

  it('exposes a retryable error when session checking times out', async () => {
    vi.useFakeTimers()
    mockedGetCurrentUser.mockImplementation(() => new Promise(() => undefined))

    const initialization = useSessionStore.getState().initialize()
    await vi.advanceTimersByTimeAsync(15_000)
    await initialization

    expect(useSessionStore.getState()).toMatchObject({
      error:
        'La comprobación de tu sesión está tardando demasiado. Revisa tu conexión e inténtalo nuevamente.',
      isInitialized: true,
      isLoading: false,
    })
  })

  it('updates the user and clears domain caches after sign-in', async () => {
    useCatalogStore.setState({ isLoaded: true })
    useCalendarStore.setState({ isLoaded: true })
    useHabitStore.setState({ isLoaded: true })
    useNoteStore.setState({ isLoaded: true })
    useRecurringTaskStore.setState({ isLoaded: true })
    mockedSignIn.mockResolvedValue({
      accessToken: 'token',
      refreshToken: null,
      user,
    })

    await expect(
      useSessionStore.getState().signIn({
        email: user.email!,
        password: 'secret-password',
      }),
    ).resolves.toMatchObject({ user })

    expect(useSessionStore.getState().user).toBe(user)
    expect(useCatalogStore.getState().isLoaded).toBe(false)
    expect(useCalendarStore.getState().isLoaded).toBe(false)
    expect(useHabitStore.getState().isLoaded).toBe(false)
    expect(useNoteStore.getState().isLoaded).toBe(false)
    expect(useRecurringTaskStore.getState().isLoaded).toBe(false)
  })

  it('does not activate a session before email verification succeeds', async () => {
    mockedRegister.mockResolvedValue({
      accessToken: null,
      requiresEmailVerification: true,
      refreshToken: null,
      user: null,
    })
    mockedVerifyEmail.mockResolvedValue({
      accessToken: 'token',
      refreshToken: null,
      user,
    })

    await useSessionStore.getState().register({
      email: user.email!,
      password: 'secret-password',
    })
    expect(useSessionStore.getState().user).toBeNull()

    await useSessionStore.getState().verifyEmail({
      email: user.email!,
      otp: '123456',
    })
    expect(useSessionStore.getState().user).toBe(user)
  })

  it('clears the session and domain stores after sign-out', async () => {
    useSessionStore.setState({ isInitialized: true, user })
    useCatalogStore.setState({ isLoaded: true })
    useCalendarStore.setState({ isLoaded: true })
    useHabitStore.setState({ isLoaded: true })
    useNoteStore.setState({ isLoaded: true })
    useRecurringTaskStore.setState({ isLoaded: true })
    mockedSignOut.mockResolvedValue(undefined)

    await useSessionStore.getState().signOut()

    expect(useSessionStore.getState().user).toBeNull()
    expect(useCatalogStore.getState().isLoaded).toBe(false)
    expect(useCalendarStore.getState().isLoaded).toBe(false)
    expect(useHabitStore.getState().isLoaded).toBe(false)
    expect(useNoteStore.getState().isLoaded).toBe(false)
    expect(useRecurringTaskStore.getState().isLoaded).toBe(false)
  })

  it('clears the session and domain stores when a protected request expires it', async () => {
    mockedGetCurrentUser.mockResolvedValue(user)
    await useSessionStore.getState().initialize()

    useCatalogStore.setState({ isLoaded: true })
    useCalendarStore.setState({ isLoaded: true })
    useHabitStore.setState({ isLoaded: true })
    useNoteStore.setState({ isLoaded: true })
    useRecurringTaskStore.setState({ isLoaded: true })

    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))

    expect(useSessionStore.getState().user).toBeNull()
    expect(useSessionStore.getState().error).toBeNull()
    expect(useCatalogStore.getState().isLoaded).toBe(false)
    expect(useCalendarStore.getState().isLoaded).toBe(false)
    expect(useHabitStore.getState().isLoaded).toBe(false)
    expect(useNoteStore.getState().isLoaded).toBe(false)
    expect(useRecurringTaskStore.getState().isLoaded).toBe(false)
  })
})
