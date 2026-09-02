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
import { SESSION_EXPIRED_EVENT, toAppError } from '../services/errors.ts'
import type {
  EmailVerificationInput,
  RegisterInput,
  SignInInput,
} from '../services/validation.ts'
import { useCatalogStore } from './catalogStore.ts'
import { useCalendarStore } from './calendarStore.ts'
import { useNoteStore } from './noteStore.ts'

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

let initializationPromise: Promise<void> | null = null
let removeAuthListener: (() => void) | null = null
let removeSessionExpiredListener: (() => void) | null = null

function resetDomainStores(): void {
  useCatalogStore.getState().reset()
  useCalendarStore.getState().reset()
  useNoteStore.getState().reset()
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

      if (initializationPromise) {
        return initializationPromise
      }

      set({ isLoading: true, error: null })

      initializationPromise = (async () => {
        try {
          const user = await getCurrentUser()
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
          initializationPromise = null
        }
      })()

      return initializationPromise
    },

    refresh: async () => {
      set({ isLoading: true, error: null })

      try {
        const user = await getCurrentUser()
        set({ user, isInitialized: true, error: null })
      } catch (error) {
        const appError = toAppError(error, 'No se pudo actualizar la sesión.')

        if (appError.code === 'unauthenticated') {
          resetDomainStores()
          set({ user: null, isInitialized: true, error: null })
        } else {
          set({ error: appError.message })
        }
      } finally {
        set({ isLoading: false })
      }
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
