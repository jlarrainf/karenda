import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const http = {
    getHeaders: vi.fn(() => ({})),
    setRefreshToken: vi.fn(),
  }
  const client = {
    getHttpClient: vi.fn(() => http),
    setAccessToken: vi.fn(),
  }

  return {
    client,
    createClient: vi.fn(() => client),
    http,
  }
})

vi.mock('@insforge/sdk', () => ({
  createClient: mocks.createClient,
}))

import {
  clearPersistedAuthSession,
  persistAuthSession,
  persistCurrentAccessToken,
} from './client.ts'

const storageKey = 'karenda.auth.session'

describe('InsForge client session persistence', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
    mocks.http.getHeaders.mockReturnValue({})
  })

  it('stores the access and refresh tokens without storing domain data', () => {
    persistAuthSession('access-token', 'refresh-token')

    expect(JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
  })

  it('keeps the refresh token when only the access token changes', () => {
    persistAuthSession('first-access-token', 'refresh-token')
    persistAuthSession('next-access-token')

    expect(JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')).toEqual({
      accessToken: 'next-access-token',
      refreshToken: 'refresh-token',
    })
  })

  it('persists the current access token and clears it explicitly', () => {
    mocks.http.getHeaders.mockReturnValue({
      Authorization: 'Bearer current-access-token',
    })

    persistCurrentAccessToken()
    expect(JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')).toEqual({
      accessToken: 'current-access-token',
      refreshToken: null,
    })

    clearPersistedAuthSession()
    expect(sessionStorage.getItem(storageKey)).toBeNull()
  })

  it('updates persistence when InsForge rotates a refresh token', () => {
    mocks.http.getHeaders.mockReturnValue({
      Authorization: 'Bearer active-access-token',
    })

    persistAuthSession('active-access-token', 'old-refresh-token')
    mocks.http.setRefreshToken('new-refresh-token')

    expect(JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')).toEqual({
      accessToken: 'active-access-token',
      refreshToken: 'new-refresh-token',
    })
  })
})
