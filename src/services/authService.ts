import type {
  AuthStateChangeCallback,
  CreateUserRequest,
  UserSchema,
} from '@insforge/sdk'
import { insforge } from '../lib/insforge/client.ts'
import {
  AppError,
  notifySessionExpired,
  runInsForge,
  runInsForgeAction,
  toAppError,
} from './errors.ts'
import {
  emailVerificationInputSchema,
  parseInput,
  passwordResetExchangeSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  registerInputSchema,
  signInInputSchema,
  verificationEmailRequestSchema,
  type EmailVerificationInput,
  type PasswordReset,
  type PasswordResetExchange,
  type PasswordResetRequest,
  type RegisterInput,
  type SignInInput,
  type VerificationEmailRequest,
} from './validation.ts'

export interface SignUpResult {
  user: UserSchema | null
  requiresEmailVerification: boolean
  accessToken: string | null
}

export interface SignInResult {
  user: UserSchema
  accessToken: string
}

export interface ResetPasswordToken {
  token: string
  expiresAt: string
}

export type PublicAuthConfig = NonNullable<
  Awaited<ReturnType<typeof insforge.auth.getPublicAuthConfig>>['data']
>

function isInvalidSessionError(error: AppError): boolean {
  return error.code === 'unauthenticated' || error.code === 'forbidden'
}

export async function register(input: RegisterInput): Promise<SignUpResult> {
  const parsed = parseInput(registerInputSchema, input)
  const payload: CreateUserRequest = {
    email: parsed.email.trim(),
    password: parsed.password,
  }

  if (parsed.name?.trim()) {
    payload.name = parsed.name.trim()
  }

  if (parsed.redirectTo) {
    payload.redirectTo = parsed.redirectTo
  }

  const data = await runInsForge(
    () => insforge.auth.signUp(payload),
    'No se pudo crear la cuenta.',
  )

  return {
    user: data.user ?? null,
    requiresEmailVerification: data.requireEmailVerification ?? false,
    accessToken: data.accessToken,
  }
}

export async function signIn(input: SignInInput): Promise<SignInResult> {
  const parsed = parseInput(signInInputSchema, input)
  const data = await runInsForge(
    () =>
      insforge.auth.signInWithPassword({
        email: parsed.email.trim(),
        password: parsed.password,
      }),
    'No se pudo iniciar sesión.',
  )

  return {
    user: data.user,
    accessToken: data.accessToken,
  }
}

export async function getCurrentUser(): Promise<UserSchema | null> {
  try {
    const { data, error } = await insforge.auth.getCurrentUser()

    if (error) {
      const appError = toAppError(error, 'No se pudo comprobar la sesión.')

      if (isInvalidSessionError(appError)) {
        notifySessionExpired()
        return null
      }

      throw appError
    }

    return data.user
  } catch (error) {
    const appError = toAppError(error, 'No se pudo comprobar la sesión.')

    if (isInvalidSessionError(appError)) {
      notifySessionExpired()
      return null
    }

    throw appError
  }
}

export async function requireCurrentUserId(): Promise<string> {
  const user = await getCurrentUser()

  if (!user) {
    notifySessionExpired()
    throw new AppError(
      'unauthenticated',
      'Tu sesión no es válida. Inicia sesión nuevamente.',
    )
  }

  return user.id
}

export async function signOut(): Promise<void> {
  await runInsForgeAction(() => insforge.auth.signOut(), 'No se pudo cerrar la sesión.')
}

export function onAuthStateChange(callback: AuthStateChangeCallback): () => void {
  return insforge.auth.onAuthStateChange(callback)
}

export async function resendVerificationEmail(
  input: VerificationEmailRequest,
): Promise<void> {
  const parsed = parseInput(verificationEmailRequestSchema, input)
  await runInsForgeAction(
    () =>
      insforge.auth.resendVerificationEmail({
        email: parsed.email.trim(),
        ...(parsed.redirectTo ? { redirectTo: parsed.redirectTo } : {}),
      }),
    'No se pudo reenviar el correo de verificación.',
  )
}

export async function verifyEmail(
  input: EmailVerificationInput,
): Promise<SignInResult> {
  const parsed = parseInput(emailVerificationInputSchema, input)
  const data = await runInsForge(
    () =>
      insforge.auth.verifyEmail({
        email: parsed.email.trim(),
        otp: parsed.otp,
      }),
    'No se pudo verificar el correo electrónico.',
  )

  return {
    user: data.user,
    accessToken: data.accessToken,
  }
}

export async function sendPasswordResetEmail(
  input: PasswordResetRequest,
): Promise<void> {
  const parsed = parseInput(passwordResetRequestSchema, input)
  await runInsForgeAction(
    () =>
      insforge.auth.sendResetPasswordEmail({
        email: parsed.email.trim(),
        ...(parsed.redirectTo ? { redirectTo: parsed.redirectTo } : {}),
      }),
    'No se pudo enviar el correo de recuperación.',
  )
}

export async function exchangeResetPasswordToken(
  input: PasswordResetExchange,
): Promise<ResetPasswordToken> {
  const parsed = parseInput(passwordResetExchangeSchema, input)
  return runInsForge(
    () =>
      insforge.auth.exchangeResetPasswordToken({
        email: parsed.email.trim(),
        code: parsed.code,
      }),
    'No se pudo validar el código de recuperación.',
  )
}

export async function resetPassword(input: PasswordReset): Promise<void> {
  const parsed = parseInput(passwordResetSchema, input)
  await runInsForgeAction(
    () =>
      insforge.auth.resetPassword({
        newPassword: parsed.newPassword,
        otp: parsed.token,
      }),
    'No se pudo actualizar la contraseña.',
  )
}

export async function getPublicAuthConfig(): Promise<PublicAuthConfig> {
  return runInsForge(
    () => insforge.auth.getPublicAuthConfig(),
    'No se pudo cargar la configuración de autenticación.',
  )
}

export function getRedirectUrl(path: string): string | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  return new URL(path, window.location.origin).toString()
}
