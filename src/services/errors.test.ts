import { describe, expect, it } from 'vitest'
import { AppError, runInsForge, toAppError } from './errors.ts'

describe('application errors', () => {
  it('maps authentication, permission, not-found and network failures', () => {
    expect(toAppError({ statusCode: 401 }).code).toBe('unauthenticated')
    expect(toAppError({ status: 401 }).code).toBe('unauthenticated')
    expect(toAppError(new Error('JWT expired')).code).toBe('unauthenticated')
    expect(toAppError({ statusCode: 403 }).code).toBe('forbidden')
    expect(toAppError({ statusCode: 404 }).code).toBe('not_found')
    expect(toAppError(new Error('network failure')).code).toBe('network')
  })

  it('explains association conflicts in Spanish', () => {
    const error = toAppError(
      new Error('update or delete violates foreign key constraint'),
      'No se pudo eliminar la asignatura. Resuelve primero sus asociaciones.',
    )

    expect(error).toMatchObject({
      code: 'conflict',
      message:
        'No se puede eliminar porque tiene eventos o notas asociadas. Resuelve esas asociaciones primero.',
    })
  })

  it('preserves domain errors and translates failed SDK results', async () => {
    const domainError = new AppError('validation', 'Los datos no son válidos.')
    expect(toAppError(domainError)).toBe(domainError)

    await expect(
      runInsForge(
        async () => ({ data: null, error: new Error('network failure') }),
        'No se pudo cargar el recurso.',
      ),
    ).rejects.toMatchObject({
      code: 'network',
      message:
        'No se pudo conectar con Karenda. Revisa tu conexión e inténtalo nuevamente.',
    })
  })
})
