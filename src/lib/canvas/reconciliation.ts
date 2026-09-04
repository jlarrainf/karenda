import type { AcademicActivityType, EventStatus } from '../../types/domain.ts'

export interface CanvasIntervalInput {
  type: 'assignment' | 'graded_discussion' | 'quiz' | 'calendar_event'
  dueAt?: string | null
  unlockAt?: string | null
  lockAt?: string | null
  startAt?: string | null
  endAt?: string | null
}

export interface CandidateInput {
  id: string
  title: string
  startAt: string
  academicActivityType?: AcademicActivityType | null
}

export function classifyAcademicActivity(
  title: string,
  fallback: AcademicActivityType = 'other',
): AcademicActivityType {
  const value = title.toLocaleLowerCase('es')
  if (/\b(examen|exam)\b/.test(value)) return 'exam'
  if (/\b(control|prueba|test)\b/.test(value)) return 'test'
  if (/\b(interrogaci[oó]n|oral)\b/.test(value)) return 'oral_assessment'
  if (/\b(quiz|cuestionario)\b/.test(value)) return 'quiz'
  return fallback
}

export function normalizeCanvasInterval(input: CanvasIntervalInput): {
  startAt: string | null
  endAt: string | null
} {
  if (input.type === 'calendar_event') {
    return { startAt: input.startAt ?? null, endAt: input.endAt ?? null }
  }
  if (input.type === 'quiz') {
    const startAt = input.unlockAt ?? input.dueAt ?? null
    const candidateEnd = input.unlockAt ? input.lockAt ?? input.dueAt ?? null : null
    const endAt = startAt && candidateEnd && Date.parse(candidateEnd) > Date.parse(startAt)
      ? candidateEnd
      : null
    return { startAt, endAt }
  }
  if (
    input.unlockAt &&
    input.dueAt &&
    Date.parse(input.unlockAt) < Date.parse(input.dueAt)
  ) {
    return { startAt: input.unlockAt, endAt: input.dueAt }
  }
  return { startAt: input.dueAt ?? null, endAt: null }
}

function words(value: string): string[] {
  return value.toLocaleLowerCase('es').match(/\d+|[a-záéíóúüñ]+/g) ?? []
}

export function rankCanvasCandidates(
  title: string,
  startAt: string,
  activityType: AcademicActivityType,
  candidates: CandidateInput[],
): string[] {
  const wanted = new Set(words(title))
  const center = Date.parse(startAt)
  return candidates
    .filter((candidate) => Math.abs(Date.parse(candidate.startAt) - center) <= 7 * 86_400_000)
    .map((candidate) => {
      const candidateWords = words(candidate.title)
      const shared = candidateWords.filter((word) => wanted.has(word)).length
      const matchingNumbers = candidateWords.filter(
        (word) => /^\d+$/.test(word) && wanted.has(word),
      ).length
      const sameType = candidate.academicActivityType === activityType ? 3 : 0
      const distance = Math.abs(Date.parse(candidate.startAt) - center) / 86_400_000
      return { id: candidate.id, score: shared + matchingNumbers * 4 + sameType - distance }
    })
    .sort((left, right) => right.score - left.score)
    .map((candidate) => candidate.id)
}

export function reconcileCanvasSnapshots(
  base: Record<string, unknown>,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): { changes: Record<string, unknown>; conflicts: string[] } {
  const changes: Record<string, unknown> = {}
  const conflicts: string[] = []
  for (const field of Object.keys(remote)) {
    const baseValue = base[field] ?? null
    const localValue = local[field] ?? null
    const remoteValue = remote[field] ?? null
    if (Object.is(remoteValue, baseValue)) continue
    if (field === 'status' && localValue === 'completed') continue
    if (Object.is(localValue, baseValue) || Object.is(localValue, remoteValue)) {
      changes[field] = remoteValue
    } else {
      conflicts.push(field)
    }
  }
  return { changes, conflicts }
}

export function monotonicCompletion(local: EventStatus, remote: EventStatus): EventStatus {
  return local === 'completed' || remote === 'completed' ? 'completed' : 'pending'
}

export function appendUniqueCanvasText(existing: string | null, addition: string): string {
  const next = addition.trim()
  if (!next) return existing?.trim() ?? ''
  const current = existing?.trim() ?? ''
  if (!current) return next
  return current.includes(next) ? current : `${current}\n\n${next}`
}

export function parseCanvasNextLink(header: string | null): string | null {
  if (!header) return null
  for (const part of header.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/)
    if (match?.[2] !== 'next') continue
    try {
      const url = new URL(match[1])
      if (url.origin !== 'https://cursos.canvas.uc.cl' || !url.pathname.startsWith('/api/v1/')) {
        return null
      }
      return url.toString()
    } catch {
      return null
    }
  }
  return null
}

export function canvasResponseAction(status: number): 'accept' | 'reconnect' | 'skip' | 'retry' | 'fail' {
  if (status >= 200 && status < 300) return 'accept'
  if (status === 401) return 'reconnect'
  if (status === 403) return 'skip'
  if (status === 429) return 'retry'
  return 'fail'
}

export function sanitizeCanvasHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function validateCanvasAiProposal(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proposal = value as Record<string, unknown>
  if (proposal.has_activity !== true) return proposal.has_activity === false
  const category = proposal.academic_activity_type
  const validCategory = category === null || (
    typeof category === 'string' && [
      'assignment', 'graded_discussion', 'quiz', 'oral_assessment',
      'test', 'exam', 'other',
    ].includes(category)
  )
  const validNullableString = (field: string) =>
    proposal[field] === null || typeof proposal[field] === 'string'
  return validCategory && ['event_title', 'start_at', 'end_at', 'location', 'topic_summary']
    .every(validNullableString)
}

function santiagoParts(date: Date): Record<string, number> {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )
}

function santiagoLocalToUtc(year: number, month: number, day: number, hour: number): Date {
  let result = new Date(Date.UTC(year, month - 1, day, hour))
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = santiagoParts(result)
    const desired = Date.UTC(year, month - 1, day, hour)
    const observed = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    )
    result = new Date(result.getTime() + desired - observed)
  }
  return result
}

export function nextSantiagoSix(now: Date): string {
  const parts = santiagoParts(now)
  const localDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  if (parts.hour >= 6) localDay.setUTCDate(localDay.getUTCDate() + 1)
  return santiagoLocalToUtc(
    localDay.getUTCFullYear(),
    localDay.getUTCMonth() + 1,
    localDay.getUTCDate(),
    6,
  ).toISOString()
}
