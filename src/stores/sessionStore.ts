import { create } from 'zustand'
import type { UserSchema } from '@insforge/sdk'
import {
  getCurrentUser,
  onAuthStateChange,
  register as registerAccount,
  signIn as signInAccount,
  signOut as signOutAccount,
  verifyEmail as verifyEmailAccount,
  type SignInResult,
  type SignUpResult,
} from '../services/authService.ts'
import { AppError, SESSION_EXPIRED_EVENT, toAppError } from '../services/errors.ts'
import type {
  EmailVerificationInput,
  RegisterInput,
  SignInInput,
} from '../services/validation.ts'
import { useCatalogStore } from './catalogStore.ts'
import { useCalendarStore } from './calendarStore.ts'
import { useHabitStore } from './habitStore.ts'
import { useNoteStore } from './noteStore.ts'
import { useRecurringTaskStore } from './recurringTaskStore.ts'

interface SessionState {
  user: UserSchema | null
  isInitialized: boolean
  isLoading: boolean
  error: string | null
  initialize: () => Promise<void>
  refresh: () => Promise<void>
  retry: () => Promise<void>
  register: (input: RegisterInput) => Promise<SignUpResult | null>
  verifyEmail: (input: EmailVerificationInput) => Promise<SignInResult | null>
  signIn: (input: SignInInput) => Promise<SignInResult | null>
  signOut: () => Promise<void>
  clearError: () => void
}

let sessionCheckPromise: Promise<void> | null = null
let removeAuthListener: (() => void) | null = null
let removeSessionExpiredListener: (() => void) | null = null
const SESSION_CHECK_TIMEOUT_MS = 15_000

function withSessionCheckTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new AppError('network', message))
    }, SESSION_CHECK_TIMEOUT_MS)

    promise.then(
      (value) => {
        clearTimeout(timeoutId)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}

function resetDomainStores(): void {
  useCatalogStore.getState().reset()
  useCalendarStore.getState().reset()
  useHabitStore.getState().reset()
  useNoteStore.getState().reset()
  useRecurringTaskStore.getState().reset()
}

export const useSessionStore = create<SessionState>((set, get) => {
  const ensureAuthListener = () => {
    if (!removeAuthListener) {
      removeAuthListener = onAuthStateChange((event) => {
        if (event === 'signedOut') {
          resetDomainStores()
          set({ user: null, error: null })
          return
        }

        if (event === 'signedIn') {
          resetDomainStores()
          void get().refresh()
        }
      })
    }

    if (!removeSessionExpiredListener && typeof window !== 'undefined') {
      const handleSessionExpired = () => {
        resetDomainStores()
        set({
          error: null,
          isInitialized: true,
          isLoading: false,
          user: null,
        })
      }

      window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
      removeSessionExpiredListener = () => {
        window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
      }
    }
  }

  return {
    user: null,
    isInitialized: false,
    isLoading: false,
    error: null,

    initialize: async () => {
      ensureAuthListener()

      if (get().isInitialized) {
        return
      }

      if (sessionCheckPromise) {
        return sessionCheckPromise
      }

      set({ isLoading: true, error: null })

      sessionCheckPromise = (async () => {
        try {
          const user = await withSessionCheckTimeout(
            getCurrentUser(),
            'La comprobación de tu sesión está tardando demasiado. Revisa tu conexión e inténtalo nuevamente.',
          )
          set({ user, isInitialized: true, error: null })
        } catch (error) {
          const appError = toAppError(error, 'No se pudo comprobar la sesión.')

          if (appError.code === 'unauthenticated') {
            resetDomainStores()
            set({ user: null, isInitialized: true, error: null })
          } else {
            set({ user: null, isInitialized: true, error: appError.message })
          }
        } finally {
          set({ isLoading: false })
          sessionCheckPromise = null
        }
      })()

      return sessionCheckPromise
    },

    refresh: async () => {
      ensureAuthListener()

      if (sessionCheckPromise) {
        return sessionCheckPromise
      }

      set({ isLoading: true, error: null })

      sessionCheckPromise = (async () => {
        try {
          const user = await withSessionCheckTimeout(
            getCurrentUser(),
            'La actualización de tu sesión está tardando demasiado. Revisa tu conexión e inténtalo nuevamente.',
          )
          set({ user, isInitialized: true, error: null })
        } catch (error) {
          const appError = toAppError(error, 'No se pudo actualizar la sesión.')

          if (appError.code === 'unauthenticated') {
            resetDomainStores()
            set({ user: null, isInitialized: true, error: null })
          } else {
            set({ error: appError.message, isInitialized: true })
          }
        } finally {
          set({ isLoading: false })
          sessionCheckPromise = null
        }

      })()

      return sessionCheckPromise
    },

    retry: async () => {
      set({ isInitialized: false, error: null })
      await get().initialize()
    },

    register: async (input) => {
      ensureAuthListener()
      set({ isLoading: true, error: null })

      try {
        const result = await registerAccount(input)

        if (result.user && result.accessToken && !result.requiresEmailVerification) {
          resetDomainStores()
          set({ user: result.user, isInitialized: true, error: null })
        } else {
          set({ error: null })
        }

        return result
      } catch (error) {
        const appError = toAppError(error, 'No se pudo crear la cuenta.')
        set({ error: appError.message })
        return null
      } finally {
        set({ isLoading: false })
      }
    },

    verifyEmail: async (input) => {
      ensureAuthListener()
      set({ isLoading: true, error: null })

      try {
        const result = await verifyEmailAccount(input)
        resetDomainStores()
        set({ user: result.user, isInitialized: true, error: null })
        return result
      } catch (error) {
        const appError = toAppError(
          error,
          'No se pudo verificar el correo electrónico.',
        )
        set({ error: appError.message })
        return null
      } finally {
        set({ isLoading: false })
      }
    },

    signIn: async (input) => {
      ensureAuthListener()
      set({ isLoading: true, error: null })

      try {
        const result = await signInAccount(input)
        resetDomainStores()
        set({ user: result.user, isInitialized: true, error: null })
        return result
      } catch (error) {
        const appError = toAppError(error, 'No se pudo iniciar sesión.')
        set({ error: appError.message })
        return null
      } finally {
        set({ isLoading: false })
      }
    },

    signOut: async () => {
      set({ isLoading: true, error: null })

      try {
        await signOutAccount()
        resetDomainStores()
        set({ user: null, isInitialized: true, error: null })
      } catch (error) {
        const appError = toAppError(error, 'No se pudo cerrar la sesión.')
        set({ error: appError.message })
      } finally {
        set({ isLoading: false })
      }
    },

    clearError: () => set({ error: null }),
  }
})
