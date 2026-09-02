import { createClient } from '@insforge/sdk'

const configuredBaseUrl = import.meta.env.VITE_INSFORGE_URL?.trim()
const configuredAnonKey = import.meta.env.VITE_INSFORGE_ANON_KEY?.trim()

export const isInsForgeConfigured = Boolean(configuredBaseUrl && configuredAnonKey)

export const insforge = createClient({
  anonKey: configuredAnonKey,
  baseUrl: configuredBaseUrl,
})
