export interface CanvasResourceFailure {
  code?: string
  remoteStatus?: number
}

const RESOURCE_LABELS: Record<string, string> = {
  pages: 'páginas',
}

export function isCanvasResourceMissing(failure: CanvasResourceFailure): boolean {
  return failure.remoteStatus === 404
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
  const label = RESOURCE_LABELS[resource] ?? resource
  if (failure.code === 'CANVAS_FORBIDDEN' || failure.remoteStatus === 403) {
    return `Canvas bloqueó ${label} de ${subject}: tu cuenta no tiene permiso para esa colección.`
  }
  if (failure.code === 'CANVAS_RATE_LIMITED' || failure.remoteStatus === 429) {
    return `Canvas limitó temporalmente la lectura de ${label} de ${subject}; se reintentará en la próxima ejecución.`
  }
  if (failure.remoteStatus === 404) {
    return `Canvas no ofrece ${label} de ${subject} en este curso.`
  }
  if (failure.code === 'CANVAS_INVALID_RESPONSE') {
    return `Canvas devolvió una respuesta inesperada al leer ${label} de ${subject}.`
  }
  return `Canvas no permitió leer ${label} de ${subject}; se continuará con el resto.`
}
