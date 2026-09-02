export type DeviceTokenScope = 'read:snapshot' | 'write:events'

export interface DeviceTokenMetadata {
  id: string
  label: string
  scopes: DeviceTokenScope[]
  created_at: string
  updated_at: string
  last_used_at: string | null
  revoked_at: string | null
  expires_at: string | null
}

export interface CreatedDeviceToken {
  token: string
  token_metadata: DeviceTokenMetadata
  message: string
}

export interface CreatedPairingCode {
  pairing_code: string
  expires_at: string
  message: string
}
