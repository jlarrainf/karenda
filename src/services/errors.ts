export type AppErrorCode =
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'network'
  | 'unknown'

export const SESSION_EXPIRED_EVENT = 'karenda:session-expired'

export function notifySessionExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
}

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly cause: unknown

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.cause = cause
  }
}

function getProperty(value: unknown, property: string): unknown {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  return (value as Record<string, unknown>)[property]
}

function getStatusCode(error: unknown): number | undefined {
  const statusCode = getProperty(error, 'statusCode')

  if (typeof statusCode === 'number') {
    return statusCode
  }

  const status = getProperty(error, 'status')
  return typeof status === 'number' ? status : undefined
}

function getMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  const message = getProperty(error, 'message')
  return typeof message === 'string' ? message : ''
}

function getErrorCode(error: unknown): string {
  const errorCode = getProperty(error, 'error')
  const code = getProperty(error, 'code')

  return [errorCode, code]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()
}

export function validationError(message: string): AppError {
  return new AppError('validation', message)
}

export function toAppError(
  error: unknown,
  fallback = 'No se pudo completar la operación.',
): AppError {
  if (error instanceof AppError) {
    if (error.code === 'unauthenticated') {
      notifySessionExpired()
    }

    return error
  }

  const statusCode = getStatusCode(error)
  const errorCode = getErrorCode(error)
  const message = getMessage(error).toLowerCase()

  if (
    statusCode === 401 ||
    errorCode.includes('unauthorized') ||
    message.includes('unauthorized') ||
    message.includes('session expired') ||
    message.includes('jwt expired') ||
    message.includes('token expired')
  ) {
    const appError = new AppError(
      'unauthenticated',
      'Tu sesión no es válida. Inicia sesión nuevamente.',
      error,
    )
    notifySessionExpired()
    return appError
  }

  if (statusCode === 403 || errorCode.includes('forbidden')) {
    return new AppError(
      'forbidden',
      'No tienes permiso para realizar esta operación.',
      error,
    )
  }

  if (statusCode === 404 || errorCode.includes('not_found')) {
    return new AppError('not_found', 'No se encontró el recurso solicitado.', error)
  }

  if (
    statusCode === 409 ||
    message.includes('duplicate') ||
    message.includes('unique') ||
    message.includes('conflict') ||
    message.includes('foreign key') ||
    message.includes('violates') ||
    message.includes('associated')
  ) {
    if (
      message.includes('asociad') ||
      (message.includes('foreign key') && fallback.includes('asoci'))
    ) {
      return new AppError(
        'conflict',
        'No se puede eliminar porque tiene eventos o notas asociadas. Resuelve esas asociaciones primero.',
        error,
      )
    }

    return new AppError(
      'conflict',
      'La operación entra en conflicto con datos existentes.',
      error,
    )
  }

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('failed to connect')
  ) {
    return new AppError(
      'network',
      'No se pudo conectar con Karenda. Revisa tu conexión e inténtalo nuevamente.',
      error,
    )
  }

  return new AppError('unknown', fallback, error)
}

interface InsForgeDataResult<T> {
  data?: T | null
  error?: unknown | null
}

interface InsForgeActionResult {
  error?: unknown | null
}

export async function runInsForge<T>(
  operation: () => PromiseLike<InsForgeDataResult<T>>,
  fallback: string,
): Promise<T> {
  try {
    const result = await operation()

    if (result.error) {
      throw result.error
    }

    if (result.data === null || result.data === undefined) {
      throw new AppError('unknown', fallback)
    }

    return result.data
  } catch (error) {
    throw toAppError(error, fallback)
  }
}

export async function runInsForgeOptional<T>(
  operation: () => PromiseLike<InsForgeDataResult<T>>,
  fallback: string,
): Promise<T | null> {
  try {
    const result = await operation()

    if (result.error) {
      throw result.error
    }

    return result.data ?? null
  } catch (error) {
    throw toAppError(error, fallback)
  }
}

export async function runInsForgeAction(
  operation: () => PromiseLike<InsForgeActionResult>,
  fallback: string,
): Promise<void> {
  try {
    const result = await operation()

    if (result.error) {
      throw result.error
    }
  } catch (error) {
    throw toAppError(error, fallback)
  }
}
