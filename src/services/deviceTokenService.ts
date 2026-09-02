import { insforge } from '../lib/insforge/client.ts'
import { runInsForge, runInsForgeAction } from './errors.ts'
import type {
  CreatedPairingCode,
  CreatedDeviceToken,
  DeviceTokenMetadata,
  DeviceTokenScope,
} from '../types/deviceToken.ts'

const DEVICE_TOKEN_FUNCTION = 'karenda-koreader-device-tokens'

interface DeviceTokenListResponse {
  tokens: DeviceTokenMetadata[]
}

interface DeviceTokenActionResponse {
  message: string
}

function invoke<T>(
  method: 'GET' | 'POST',
  body: Record<string, unknown> | undefined,
  fallback: string,
) {
  return runInsForge(
    () =>
      insforge.functions.invoke<T>(DEVICE_TOKEN_FUNCTION, {
        ...(body ? { body } : {}),
        method,
      }),
    fallback,
  )
}

export function listDeviceTokens(): Promise<DeviceTokenMetadata[]> {
  return invoke<DeviceTokenListResponse>(
    'GET',
    undefined,
    'No se pudieron cargar los dispositivos.',
  ).then((response) => response.tokens)
}

export function createDeviceToken(
  label: string,
  scopes: DeviceTokenScope[] = ['read:snapshot'],
): Promise<CreatedDeviceToken> {
  return invoke<CreatedDeviceToken>(
    'POST',
    { action: 'create', label, scopes },
    'No se pudo generar el token del dispositivo.',
  )
}

export function createDevicePairingCode(label: string): Promise<CreatedPairingCode> {
  return invoke<CreatedPairingCode>(
    'POST',
    { action: 'create_pairing', label },
    'No se pudo generar el código de emparejamiento.',
  )
}

export function revokeDeviceToken(tokenId: string): Promise<void> {
  return runInsForgeAction(
    () =>
      insforge.functions.invoke<DeviceTokenActionResponse>(DEVICE_TOKEN_FUNCTION, {
        body: { action: 'revoke', token_id: tokenId },
        method: 'POST',
      }),
    'No se pudo revocar el token del dispositivo.',
  )
}

export function regenerateDeviceToken(
  tokenId: string,
  label: string,
  scopes: DeviceTokenScope[],
): Promise<CreatedDeviceToken> {
  return invoke<CreatedDeviceToken>(
    'POST',
    { action: 'regenerate', label, scopes, token_id: tokenId },
    'No se pudo regenerar el token del dispositivo.',
  )
}
