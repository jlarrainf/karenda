export interface CanvasResourceFailure {
  code?: string
  remoteStatus?: number
}

export function cleanCanvasCourseName(value: unknown, max = 160): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\s+/g, ' ').trim().slice(0, max)
  if (!normalized) return null
  const cleaned = normalized.replace(/\s*[([{]\s*$/, '').trim()
  return cleaned || normalized
}

export function formatCanvasResourceWarning(
  resource: string,
  courseName: string,
  failure: CanvasResourceFailure,
): string {
  const subject = cleanCanvasCourseName(courseName) ?? courseName
  if (failure.code === 'CANVAS_FORBIDDEN' || failure.remoteStatus === 403) {
    return `Canvas bloqueó ${resource} de ${subject}: tu cuenta no tiene permiso para esa colección.`
  }
  if (failure.code === 'CANVAS_RATE_LIMITED' || failure.remoteStatus === 429) {
    return `Canvas limitó temporalmente la lectura de ${resource} de ${subject}; se reintentará en la próxima ejecución.`
  }
  if (failure.remoteStatus === 404) {
    return `Canvas no ofrece ${resource} de ${subject} en este curso.`
  }
  if (failure.code === 'CANVAS_INVALID_RESPONSE') {
    return `Canvas devolvió una respuesta inesperada al leer ${resource} de ${subject}.`
  }
  return `Canvas no permitió leer ${resource} de ${subject}; se continuará con el resto.`
}
