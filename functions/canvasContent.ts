import { sanitizeCanvasHtml } from './canvasText.ts'

const ACADEMIC_DETAIL_PATTERN = /\b(?:evaluaci[oó]n|prueba|interrogaci[oó]n|control|tarea|actividad|proyecto|entrega|examen|seminario|temario|materia|contenido|pregunta|formulario|definici[oó]n|teorema|demostraci[oó]n|enunciado|rendir|sala|aula|laboratorio|hora|fecha|duraci[oó]n|plazo|venc(?:e|imiento)?|subir|entregar|archivo|zip|readme|piane|tolerancia|llegar|atraso)\b/i
const IRRELEVANT_DETAIL_PATTERN = /\b(?:dato\s+freak|tibur[oó]n|feliz|agua|vasos?|ps\s*\d*|eca|saludos?|esperando\s+que|nos\s+vemos\s+en\s+clases?)\b/i

function compact(value: unknown, max: number): string | null {
  const clean = sanitizeCanvasHtml(value)
  return clean ? clean.slice(0, max) : null
}

export function filterAcademicDetails(value: unknown): string | null {
  const clean = sanitizeCanvasHtml(value)
  if (!clean) return null
  const parts = clean.split(/(?<=[.!?;:])\s+|\r?\n+/)
  const relevant = parts.filter((part) => ACADEMIC_DETAIL_PATTERN.test(part) && !IRRELEVANT_DETAIL_PATTERN.test(part))
  return compact(relevant.join('. '), 1000)
}

export function normalizeAcademicLocation(value: unknown): string | null {
  const clean = compact(value, 240)
  if (!clean) return null
  if (clean.length <= 40 && !/[.!?;]/.test(clean)) return clean
  const rooms = [...clean.matchAll(/\b(?:en|sala(?:s)?|aula(?:s)?|laboratorio(?:s)?|auditorio(?:s)?)\s*(?::|-)?\s*(?:la|el|de)?\s*([A-Z]{1,4}\d{1,4}|\d{1,4})\b/gi)]
    .map((match) => match[1].toUpperCase())
  return [...new Set(rooms)].join(', ') || clean
}
