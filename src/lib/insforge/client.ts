import { createClient } from '@insforge/sdk'

const configuredBaseUrl = import.meta.env.VITE_INSFORGE_URL?.trim()
const configuredAnonKey = import.meta.env.VITE_INSFORGE_ANON_KEY?.trim()
const AUTH_SESSION_STORAGE_KEY = 'karenda.auth.session'

interface PersistedAuthSession {
  accessToken: string
  refreshToken: string | null
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function readPersistedAuthSession(): PersistedAuthSession | null {
  const storage = getSessionStorage()

  if (!storage) {
    return null
  }

  try {
    const value: unknown = JSON.parse(
      storage.getItem(AUTH_SESSION_STORAGE_KEY) ?? 'null',
    )

    if (
      typeof value !== 'object' ||
      value === null ||
      typeof (value as { accessToken?: unknown }).accessToken !== 'string'
    ) {
      return null
    }

    const refreshToken = (value as { refreshToken?: unknown }).refreshToken

    return {
      accessToken: (value as { accessToken: string }).accessToken,
      refreshToken: typeof refreshToken === 'string' ? refreshToken : null,
    }
  } catch {
    return null
  }
}

export const isInsForgeConfigured = Boolean(configuredBaseUrl && configuredAnonKey)

export const insforge = createClient({
  anonKey: configuredAnonKey,
  baseUrl: configuredBaseUrl,
})

const httpClient = insforge.getHttpClient()
const setRefreshToken = httpClient.setRefreshToken.bind(httpClient)

httpClient.setRefreshToken = (token) => {
  setRefreshToken(token)

  if (token) {
    const authorization = httpClient.getHeaders().Authorization

    if (authorization?.startsWith('Bearer ')) {
      persistAuthSession(authorization.slice('Bearer '.length), token)
    }
  }
}

const persistedAuthSession = readPersistedAuthSession()

if (persistedAuthSession) {
  insforge.setAccessToken(persistedAuthSession.accessToken)

  if (persistedAuthSession.refreshToken) {
    insforge.getHttpClient().setRefreshToken(persistedAuthSession.refreshToken)
  }
}

export function persistAuthSession(
  accessToken: string,
  refreshToken?: string | null,
): void {
  const storage = getSessionStorage()

  if (!storage || !accessToken) {
    return
  }

  const previousSession = readPersistedAuthSession()

  try {
    storage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        accessToken,
        refreshToken:
          refreshToken === undefined
            ? previousSession?.refreshToken ?? null
            : refreshToken,
      } satisfies PersistedAuthSession),
    )
  } catch {
    // Session persistence is optional when browser storage is unavailable.
  }
}

export function persistCurrentAccessToken(): void {
  const authorization = insforge.getHttpClient().getHeaders().Authorization

  if (authorization?.startsWith('Bearer ')) {
    persistAuthSession(authorization.slice('Bearer '.length))
  }
}

export function clearPersistedAuthSession(): void {
  const storage = getSessionStorage()

  if (!storage) {
    return
  }

  try {
    storage.removeItem(AUTH_SESSION_STORAGE_KEY)
  } catch {
    // Ignore storage cleanup failures; InsForge remains the source of truth.
  }
}
