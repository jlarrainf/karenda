import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InsForgeError, type UserSchema } from '@insforge/sdk'
import { insforge } from '../lib/insforge/client.ts'
import {
  getCurrentUser,
  register,
  requireCurrentUserId,
  signIn,
} from './authService.ts'

const mocks = vi.hoisted(() => ({
  auth: {
    getCurrentUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    verifyEmail: vi.fn(),
  },
  clearPersistedAuthSession: vi.fn(),
  persistAuthSession: vi.fn(),
  persistCurrentAccessToken: vi.fn(),
}))

vi.mock('../lib/insforge/client.ts', () => ({
  insforge: {
    auth: mocks.auth,
  },
  clearPersistedAuthSession: mocks.clearPersistedAuthSession,
  persistAuthSession: mocks.persistAuthSession,
  persistCurrentAccessToken: mocks.persistCurrentAccessToken,
}))

const mockedGetCurrentUser = vi.mocked(insforge.auth.getCurrentUser)
const mockedSignInWithPassword = vi.mocked(insforge.auth.signInWithPassword)
const mockedSignUp = vi.mocked(insforge.auth.signUp)
const user = {
  createdAt: '2026-08-30T10:00:00.000Z',
  email: 'student@example.com',
  emailVerified: true,
  id: 'user-1',
  metadata: null,
  profile: null,
  updatedAt: '2026-08-30T10:00:00.000Z',
} as UserSchema

describe('authService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('validates registration before calling InsForge and normalizes payload fields', async () => {
    mockedSignUp.mockResolvedValue({
      data: {
        accessToken: 'token',
        requireEmailVerification: false,
        refreshToken: 'refresh-token',
        user,
      },
      error: null,
    })

    const result = await register({
      email: '  student@example.com ',
      name: '  Estudiante  ',
      password: 'secret-password',
    })

    expect(result).toMatchObject({
      accessToken: 'token',
      refreshToken: 'refresh-token',
      requiresEmailVerification: false,
    })
    expect(mocks.persistAuthSession).toHaveBeenCalledWith(
      'token',
      'refresh-token',
    )
    expect(mockedSignUp).toHaveBeenCalledWith({
      email: 'student@example.com',
      name: 'Estudiante',
      password: 'secret-password',
    })

    await expect(
      register({ email: 'invalid', password: 'short' }),
    ).rejects.toMatchObject({ code: 'validation' })
    expect(mockedSignUp).toHaveBeenCalledOnce()
  })

  it('maps password sign-in and keeps unauthenticated sessions nullable', async () => {
    mockedSignInWithPassword.mockResolvedValue({
      data: {
        accessToken: 'token',
        refreshToken: 'refresh-token',
        user,
      },
      error: null,
    })

    await expect(
      signIn({ email: 'student@example.com', password: 'secret-password' }),
    ).resolves.toMatchObject({
      accessToken: 'token',
      refreshToken: 'refresh-token',
    })
    expect(mocks.persistAuthSession).toHaveBeenCalledWith(
      'token',
      'refresh-token',
    )
    expect(mockedSignInWithPassword).toHaveBeenCalledWith({
      email: 'student@example.com',
      password: 'secret-password',
    })

    mockedGetCurrentUser.mockResolvedValue({
      data: { user: null },
      error: new InsForgeError('Unauthorized', 401, 'unauthorized'),
    })
    await expect(getCurrentUser()).resolves.toBeNull()
    expect(mocks.clearPersistedAuthSession).toHaveBeenCalled()
    await expect(requireCurrentUserId()).rejects.toMatchObject({
      code: 'unauthenticated',
    })

    mockedGetCurrentUser.mockResolvedValue({
      data: { user: null },
      error: new InsForgeError('Invalid CSRF token', 403, 'forbidden'),
    })
    await expect(getCurrentUser()).resolves.toBeNull()

    mockedGetCurrentUser.mockRejectedValue(
      new InsForgeError('Invalid CSRF token', 403, 'forbidden'),
    )
    await expect(getCurrentUser()).resolves.toBeNull()
  })

  it('persists the active token after restoring the current user', async () => {
    mockedGetCurrentUser.mockResolvedValue({
      data: { user },
      error: null,
    })

    await expect(getCurrentUser()).resolves.toBe(user)

    expect(mocks.persistCurrentAccessToken).toHaveBeenCalledOnce()
  })
})
