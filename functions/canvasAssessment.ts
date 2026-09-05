export type CanvasAcademicActivityType =
  | 'control'
  | 'assignment'
  | 'activity'
  | 'project'
  | 'submission'
  | 'test'
  | 'exam'
  | 'seminar'
  | 'graded_discussion'
  | 'quiz'
  | 'oral_assessment'
  | 'other'

const LEGACY_ACTIVITY_TYPES: Record<string, CanvasAcademicActivityType> = {
  assignment: 'assignment',
  graded_discussion: 'activity',
  quiz: 'test',
  oral_assessment: 'test',
  test: 'test',
  exam: 'exam',
  other: 'activity',
  control: 'control',
  activity: 'activity',
  project: 'project',
  submission: 'submission',
  seminar: 'seminar',
}

export const CANVAS_ACTIVITY_TYPES = new Set(Object.keys(LEGACY_ACTIVITY_TYPES))

export function canonicalizeActivityType(value: unknown): CanvasAcademicActivityType | null {
  if (typeof value !== 'string') return null
  return LEGACY_ACTIVITY_TYPES[value] ?? null
}

function normalized(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
}

export function classifyAssessment(
  value: string,
  fallback: CanvasAcademicActivityType = 'activity',
): CanvasAcademicActivityType {
  const text = normalized(value)
  if (/\b(examen|exam)\b/.test(text)) return 'exam'
  if (/\b(seminario|seminar)\b/.test(text)) return 'seminar'
  if (/\b(proyecto|proyect|project)\b/.test(text)) return 'project'
  if (/\b(entrega|entregable|submission|submit)\b/.test(text)) return 'submission'
  if (/\b(control)\b/.test(text)) return 'control'
  if (/\b(interrogacion|prueba|quiz|test|oral)\b/.test(text)) return 'test'
  if (/\b(tarea|assignment)\b/.test(text)) return 'assignment'
  if (/\b(actividad|activity)\b/.test(text)) return 'activity'
  return canonicalizeActivityType(fallback) ?? 'activity'
}

interface AssessmentCodeMatch {
  code: string
  activityType: CanvasAcademicActivityType
}

const CODE_PATTERNS: Array<{ regex: RegExp; prefix: string; activityType: CanvasAcademicActivityType }> = [
  { regex: /\bAC\s*(\d{1,3})\b/i, prefix: 'AC', activityType: 'activity' },
  { regex: /\b(?:interrogaci[oó]n|interrogacion)(?:\s+(?:n[°º.]?\s*)?)(\d{1,3})\b/i, prefix: 'I', activityType: 'test' },
  { regex: /\bI\s*(\d{1,3})\b/i, prefix: 'I', activityType: 'test' },
  { regex: /\b(?:prueba|test)(?:\s+(?:n[°º.]?\s*)?)(\d{1,3})\b/i, prefix: 'P', activityType: 'test' },
  { regex: /\bP\s*(\d{1,3})\b/i, prefix: 'P', activityType: 'test' },
  { regex: /\bcontrol(?:\s+(?:n[°º.]?\s*)?)(\d{1,3})\b/i, prefix: 'C', activityType: 'control' },
  { regex: /\bC\s*(\d{1,3})\b/i, prefix: 'C', activityType: 'control' },
  { regex: /\btarea(?:\s+(?:n[°º.]?\s*)?)(\d{1,3})\b/i, prefix: 'T', activityType: 'assignment' },
  { regex: /\bT\s*(\d{1,3})\b/i, prefix: 'T', activityType: 'assignment' },
  { regex: /\bentrega(?:\s+(?:n[°º.]?\s*)?)(\d{1,3})\b/i, prefix: 'E', activityType: 'submission' },
  { regex: /\bE\s*(\d{1,3})\b/i, prefix: 'E', activityType: 'submission' },
  { regex: /\bactividad(?:\s+(?:n[°º.]?\s*)?)(\d{1,3})\b/i, prefix: 'AC', activityType: 'activity' },
  { regex: /\bproyecto(?:\s+(?:n[°º.]?\s*)?)(\d{1,3})\b/i, prefix: 'PROY', activityType: 'project' },
  { regex: /\bseminario(?:\s+(?:n[°º.]?\s*)?)(\d{1,3})\b/i, prefix: 'S', activityType: 'seminar' },
]

export function extractAssessmentCode(value: string): AssessmentCodeMatch | null {
  for (const pattern of CODE_PATTERNS) {
    const match = value.match(pattern.regex)
    if (match?.[1]) return { code: `${pattern.prefix}${match[1]}`, activityType: pattern.activityType }
  }
  return null
}

interface LocalDateParts {
  year: number
  month: number
  day: number
}

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
}

function localDateParts(value: string): LocalDateParts {
  const date = new Date(value)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(Number.isNaN(date.getTime()) ? new Date() : date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
  return { year: values.year, month: values.month, day: values.day }
}

function addDays(value: LocalDateParts, days: number): LocalDateParts {
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day + days))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

function extractDate(value: string, referenceDate: string): LocalDateParts | null {
  const reference = localDateParts(referenceDate)
  const text = normalized(value)
  if (/\bhoy\b/.test(text)) return reference
  if (/\bmanana\b/.test(text)) return addDays(reference, 1)

  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (numeric) {
    const year = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : reference.year
    const month = Number(numeric[2])
    const day = Number(numeric[1])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { year, month, day }
  }

  const named = text.match(/\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?\b/)
  if (named) {
    const month = MONTHS[named[2]]
    const day = Number(named[1])
    if (month && day >= 1 && day <= 31) return { year: named[3] ? Number(named[3]) : reference.year, month, day }
  }
  return null
}

interface LocalTimeParts {
  hour: number
  minute: number
}

function extractTime(value: string): LocalTimeParts | null {
  const text = normalized(value)
  const match = text.match(/\b(?:a\s+las?\s*)?(\d{1,2})(?::|\.)(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm|de la manana|de la tarde|de la noche)?\b/i)
    ?? text.match(/\b(?:a\s+las?\s*)?(\d{1,2})\s*(?:h|hrs?|horas?)\b/i)
  if (!match) return null
  let hour = Number(match[1])
  const minute = match[2] ? Number(match[2]) : 0
  const meridiem = match[3] ?? ''
  if (/p\.?\s*m\.?|pm|de la tarde|de la noche/i.test(meridiem) && hour < 12) hour += 12
  if (/a\.?\s*m\.?|am|de la manana/i.test(meridiem) && hour === 12) hour = 0
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : null
}

const NUMBER_WORDS: Record<string, number> = {
  una: 1, un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
}

function extractDuration(value: string): number | null {
  const text = normalized(value)
  const match = text.match(/\b(?:dura|duracion|durara)\s+(\d+(?:[.,]\d+)?|una|un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(horas?|hrs?|h|minutos?|mins?|m)\b/i)
    ?? text.match(/(?<![:\d])\b(\d+(?:[.,]\d+)?|una|un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(horas?|hrs?|h|minutos?|mins?|m)\b/i)
  if (!match) return null
  const amount = NUMBER_WORDS[match[1]] ?? Number(match[1].replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) return null
  return /minutos?|mins?|m$/i.test(match[2]) ? Math.round(amount) : Math.round(amount * 60)
}

function extractLocation(value: string): string | null {
  const match = value.match(/\b((?:sala|aula|auditorio|laboratorio|edificio)\s*(?:n[°º.]?\s*)?[^\n.;,]{1,80})/i)
  return match?.[1]?.trim() || null
}

function localToUtc(date: LocalDateParts, time: LocalTimeParts): string {
  let result = new Date(Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute))
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = localDateTimeParts(result)
    const desired = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute)
    const actual = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second)
    result = new Date(result.getTime() + desired - actual)
  }
  return result.toISOString()
}

function localDateTimeParts(value: Date): LocalDateParts & { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(value)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute, second: values.second }
}

export interface CanvasAssessmentExtraction {
  activityType: CanvasAcademicActivityType | null
  assessmentCode: string | null
  startAt: string | null
  endAt: string | null
  durationMinutes: number | null
  location: string | null
  hasActivity: boolean
}

export function extractCanvasAssessment(title: string, content: string, referenceDate: string): CanvasAssessmentExtraction {
  const combined = `${title} ${content}`
  const codeMatch = extractAssessmentCode(combined)
  const activityType = codeMatch?.activityType ?? classifyAssessment(combined, 'activity')
  const date = extractDate(content, referenceDate)
  const time = extractTime(content)
  const durationMinutes = extractDuration(content)
  // A message that gives only a time (for example, "nos vemos a las 17:30")
  // refers to the day on which Canvas published it. This keeps the activity
  // actionable while still avoiding a guessed date when no time is present.
  const startAt = time ? localToUtc(date ?? localDateParts(referenceDate), time) : null
  const endAt = startAt && durationMinutes ? new Date(Date.parse(startAt) + durationMinutes * 60_000).toISOString() : null
  const location = extractLocation(content)

  return {
    activityType: codeMatch || activityType !== 'activity' ? activityType : null,
    assessmentCode: codeMatch?.code ?? null,
    startAt,
    endAt,
    durationMinutes,
    location,
    hasActivity: Boolean(codeMatch || startAt || durationMinutes || location || activityType !== 'activity'),
  }
}
