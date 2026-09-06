import { createClient } from '@insforge/sdk'
import { Capacitor } from '@capacitor/core'
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin'

const configuredBaseUrl = import.meta.env.VITE_INSFORGE_URL?.trim()
const configuredAnonKey = import.meta.env.VITE_INSFORGE_ANON_KEY?.trim()
const AUTH_SESSION_STORAGE_KEY = 'karenda.auth.session'
const MOBILE_AUTH_SESSION_KEY = 'karenda.auth.mobile-session'
const IS_NATIVE_PLATFORM = Capacitor.isNativePlatform()

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

function parsePersistedAuthSession(value: unknown): PersistedAuthSession | null {
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
}

function accessTokenExpiry(token: string): number | null {
  try {
    const encodedPayload = token.split('.')[1]
    if (!encodedPayload) return null
    const payload = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: unknown
    }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export const isInsForgeConfigured = Boolean(configuredBaseUrl && configuredAnonKey)

export const insforge = createClient({
  anonKey: configuredAnonKey,
  baseUrl: configuredBaseUrl,
  // Capacitor WebViews cannot reliably use InsForge's cross-origin refresh
  // cookie. The SDK's mobile flow returns an explicit refresh token instead.
  isServerMode: IS_NATIVE_PLATFORM,
})

const httpClient = insforge.getHttpClient()
const setRefreshToken = httpClient.setRefreshToken.bind(httpClient)

let mobileSession: PersistedAuthSession | null = null
let mobileRefreshPromise: Promise<void> | null = null

httpClient.setRefreshToken = (token) => {
  setRefreshToken(token)

  if (token) {
    const authorization = httpClient.getHeaders().Authorization

    if (authorization?.startsWith('Bearer ')) {
      persistAuthSession(authorization.slice('Bearer '.length), token)
    }
  }
}

function applyPersistedAuthSession(session: PersistedAuthSession): void {
  mobileSession = session
  insforge.setAccessToken(session.accessToken)

  if (session.refreshToken) {
    insforge.getHttpClient().setRefreshToken(session.refreshToken)
  }
}

const persistedAuthSession = readPersistedAuthSession()

if (persistedAuthSession) applyPersistedAuthSession(persistedAuthSession)

/** Restores the mobile session before React mounts and starts domain requests. */
export async function restorePersistedAuthSession(): Promise<void> {
  if (!IS_NATIVE_PLATFORM) return

  try {
    const stored = await SecureStoragePlugin.get({ key: MOBILE_AUTH_SESSION_KEY })
    if (!stored.value) return
    const session = parsePersistedAuthSession(JSON.parse(stored.value))
    if (session) applyPersistedAuthSession(session)
  } catch {
    // A missing or unavailable device store behaves like a signed-out session.
  }
}

/** Refreshes an expiring native access token using the explicit mobile token. */
export async function refreshMobileSessionIfNeeded(): Promise<void> {
  if (!IS_NATIVE_PLATFORM || !mobileSession?.refreshToken) return

  const expiresAt = accessTokenExpiry(mobileSession.accessToken)
  if (expiresAt !== null && expiresAt - Date.now() > 60_000) return
  if (mobileRefreshPromise) return mobileRefreshPromise

  mobileRefreshPromise = (async () => {
    const result = await insforge.auth.refreshSession({ refreshToken: mobileSession?.refreshToken ?? undefined })
    if (result.error || !result.data?.accessToken) {
      throw result.error ?? new Error('No se pudo renovar la sesión móvil.')
    }
    applyPersistedAuthSession({
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken ?? mobileSession?.refreshToken ?? null,
    })
  })().finally(() => {
    mobileRefreshPromise = null
  })

  return mobileRefreshPromise
}

export function persistAuthSession(
  accessToken: string,
  refreshToken?: string | null,
): void {
  if (IS_NATIVE_PLATFORM) {
    const previousSession = mobileSession
    const session: PersistedAuthSession = {
      accessToken,
      refreshToken:
        refreshToken === undefined
          ? previousSession?.refreshToken ?? null
          : refreshToken,
    }
    mobileSession = session
    void SecureStoragePlugin.set({
      key: MOBILE_AUTH_SESSION_KEY,
      value: JSON.stringify(session),
    })
    return
  }

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
  mobileSession = null
  insforge.setAccessToken(null)
  httpClient.setRefreshToken(null)

  if (IS_NATIVE_PLATFORM) {
    void SecureStoragePlugin.remove({ key: MOBILE_AUTH_SESSION_KEY }).catch(() => {
      // Missing keys are already cleared; keep sign-out resilient.
    })
  }

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
