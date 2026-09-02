import { z } from 'zod'

const localDatePattern = /^\d{4}-\d{2}-\d{2}$/

function isValidLocalDate(value: string): boolean {
  if (!localDatePattern.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export const habitLocalDateSchema = z
  .string()
  .refine(isValidLocalDate, 'La fecha local no es válida.')

export const habitWeekdaySchema = z
  .number()
  .int('El día de la semana debe ser entero.')
  .min(1, 'El día de la semana no es válido.')
  .max(7, 'El día de la semana no es válido.')
export const habitScheduleUnitSchema = z.enum(['day', 'week', 'month'])
export const habitTrackingTypeSchema = z.enum(['boolean', 'count', 'duration'])
export const habitEvaluationModeSchema = z.enum([
  'scheduled_occurrence',
  'period_quota',
])
export const habitMissPolicySchema = z.enum(['mark_missed', 'keep_pending'])
export const habitLifecycleStatusSchema = z.enum(['active', 'paused', 'archived'])
export const habitNotePolicySchema = z.enum(['none', 'general', 'daily', 'both'])
export const habitLogStatusSchema = z.enum(['completed', 'partial', 'skipped'])
export const habitLogSourceSchema = z.enum(['manual', 'koreader'])
export const habitQuotaPeriodSchema = z.enum(['day', 'week', 'month'])

export const habitScheduleSchema = z
  .object({
    unit: habitScheduleUnitSchema,
    interval: z
      .number()
      .int('El intervalo debe ser entero.')
      .positive('El intervalo debe ser positivo.'),
    weekdays: z
      .array(habitWeekdaySchema)
      .max(7, 'No puedes seleccionar más de siete días.')
      .default([]),
    dayOfMonth: z
      .number()
      .int('El día del mes debe ser entero.')
      .min(1, 'El día del mes no es válido.')
      .max(31, 'El día del mes no es válido.')
      .nullable()
      .default(null),
    anchorDate: habitLocalDateSchema.nullable().default(null),
  })
  .superRefine((value, context) => {
    const uniqueWeekdays = new Set(value.weekdays)

    if (uniqueWeekdays.size !== value.weekdays.length) {
      context.addIssue({
        code: 'custom',
        path: ['weekdays'],
        message: 'No repitas días de la semana.',
      })
    }

    if (value.unit === 'week' && value.weekdays.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['weekdays'],
        message: 'Selecciona al menos un día de la semana.',
      })
    }

    if (value.unit === 'month' && value.dayOfMonth === null) {
      context.addIssue({
        code: 'custom',
        path: ['dayOfMonth'],
        message: 'Indica el día del mes.',
      })
    }

    if (value.unit !== 'month' && value.dayOfMonth !== null) {
      context.addIssue({
        code: 'custom',
        path: ['dayOfMonth'],
        message: 'El día del mes solo aplica a reglas mensuales.',
      })
    }

    if (value.unit === 'day' && value.interval > 1 && value.anchorDate === null) {
      context.addIssue({
        code: 'custom',
        path: ['anchorDate'],
        message: 'Los intervalos de días necesitan una fecha ancla.',
      })
    }

    if (value.unit !== 'day' && value.anchorDate !== null) {
      context.addIssue({
        code: 'custom',
        path: ['anchorDate'],
        message: 'La fecha ancla solo aplica a intervalos diarios.',
      })
    }
  })

export const habitCalendarScheduleSchema = z
  .object({
    mode: z.enum(['rule', 'active_days', 'custom']),
    weekdays: z
      .array(habitWeekdaySchema)
      .max(7, 'No puedes seleccionar más de siete días.')
      .default([]),
    dates: z
      .array(habitLocalDateSchema)
      .max(366, 'No puedes seleccionar más de 366 fechas.')
      .default([]),
  })
  .superRefine((value, context) => {
    if (
      value.mode === 'custom' &&
      value.weekdays.length === 0 &&
      value.dates.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['dates'],
        message: 'Selecciona al menos un día para la proyección.',
      })
    }
  })

const optionalColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe tener formato #RRGGBB.')
  .nullable()
  .default(null)

const optionalRelationSchema = z
  .string()
  .uuid('La relación no es válida.')
  .nullable()
  .default(null)

const habitInputObjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre del hábito es obligatorio.')
    .max(160, 'El nombre del hábito es demasiado largo.'),
  description: z
    .string()
    .max(2000, 'La descripción es demasiado larga.')
    .nullable()
    .default(null),
  color: optionalColorSchema,
  subjectId: optionalRelationSchema,
  personalGroupId: optionalRelationSchema,
  trackingType: habitTrackingTypeSchema,
  unit: z
    .string()
    .trim()
    .max(80, 'La unidad es demasiado larga.')
    .nullable()
    .default(null),
  goalValue: z.number().finite().nonnegative('La meta no puede ser negativa.'),
  evaluationMode: habitEvaluationModeSchema.default('scheduled_occurrence'),
  quotaPeriod: habitQuotaPeriodSchema.nullable().default(null),
  missPolicy: habitMissPolicySchema.default('mark_missed'),
  schedule: habitScheduleSchema,
  startDate: habitLocalDateSchema,
  endDate: habitLocalDateSchema.nullable().default(null),
  lifecycleStatus: habitLifecycleStatusSchema.default('active'),
  statsEnabled: z.boolean().default(true),
  notePolicy: habitNotePolicySchema.default('none'),
  calendarEnabled: z.boolean().default(false),
  calendarSchedule: habitCalendarScheduleSchema.nullable().default(null),
})

export const habitInputSchema = habitInputObjectSchema.superRefine((value, context) => {
  if (value.subjectId !== null && value.personalGroupId !== null) {
    context.addIssue({
      code: 'custom',
      path: ['personalGroupId'],
      message: 'Un hábito puede relacionarse con una asignatura o un grupo, no ambos.',
    })
  }

  if (value.trackingType === 'boolean') {
    if (value.unit !== null) {
      context.addIssue({
        code: 'custom',
        path: ['unit'],
        message: 'Los hábitos booleanos no necesitan unidad.',
      })
    }

    if (value.goalValue !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['goalValue'],
        message: 'La meta de un hábito booleano debe ser 1.',
      })
    }
  } else {
    if (!value.unit) {
      context.addIssue({
        code: 'custom',
        path: ['unit'],
        message: 'Indica la unidad de medida.',
      })
    }

    if (value.goalValue <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['goalValue'],
        message: 'La meta debe ser positiva.',
      })
    }
  }

  if (value.evaluationMode === 'period_quota' && value.quotaPeriod === null) {
    context.addIssue({
      code: 'custom',
      path: ['quotaPeriod'],
      message: 'Selecciona el periodo de la cuota.',
    })
  }

  if (value.evaluationMode === 'scheduled_occurrence' && value.quotaPeriod !== null) {
    context.addIssue({
      code: 'custom',
      path: ['quotaPeriod'],
      message: 'Las cuotas solo aplican al modo por periodo.',
    })
  }

  if (value.endDate !== null && value.endDate < value.startDate) {
    context.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'La fecha final no puede ser anterior al inicio.',
    })
  }

  if (value.calendarEnabled && value.calendarSchedule === null) {
    context.addIssue({
      code: 'custom',
      path: ['calendarSchedule'],
      message: 'Configura los días de proyección.',
    })
  }
})

export const habitPatchSchema = habitInputObjectSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Debes modificar al menos un campo.',
  )

export const habitScheduleVersionInputSchema = z.object({
  habitId: z.string().uuid('El hábito no es válido.'),
  schedule: habitScheduleSchema,
  evaluationMode: habitEvaluationModeSchema,
  goalValue: z.number().finite().positive('La meta debe ser positiva.'),
  quotaPeriod: habitQuotaPeriodSchema.nullable(),
  missPolicy: habitMissPolicySchema,
  effectiveFrom: habitLocalDateSchema,
})

export const habitLogInputSchema = z
  .object({
    habitId: z.string().uuid('El hábito no es válido.'),
    localDate: habitLocalDateSchema,
    value: z.number().finite().nonnegative('El valor no puede ser negativo.'),
    status: habitLogStatusSchema.default('completed'),
    source: habitLogSourceSchema.default('manual'),
    externalId: z
      .string()
      .trim()
      .max(240, 'El identificador externo es demasiado largo.')
      .nullable()
      .default(null),
  })
  .superRefine((value, context) => {
    if (value.source === 'koreader' && !value.externalId) {
      context.addIssue({
        code: 'custom',
        path: ['externalId'],
        message: 'Los registros importados necesitan un identificador externo.',
      })
    }
  })

export const habitRangeSchema = z
  .object({
    startDate: habitLocalDateSchema,
    endDate: habitLocalDateSchema,
  })
  .refine((value) => value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'El rango de fechas no es válido.',
  })

export const habitNoteInputSchema = z.object({
  habitId: z.string().uuid('El hábito no es válido.'),
  entryDate: habitLocalDateSchema.nullable().default(null),
  title: z.string().trim().min(1, 'El título de la nota es obligatorio.').max(240),
  contentMarkdown: z
    .string()
    .trim()
    .min(1, 'El contenido de la nota es obligatorio.')
    .max(100000, 'El contenido de la nota es demasiado largo.'),
})

export const habitNotePatchSchema = habitNoteInputSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Debes modificar al menos un campo.',
  )

const recurringTaskInputObjectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'El título de la tarea es obligatorio.')
    .max(240, 'El título de la tarea es demasiado largo.'),
  description: z
    .string()
    .max(2000, 'La descripción es demasiado larga.')
    .nullable()
    .default(null),
  color: optionalColorSchema,
  subjectId: optionalRelationSchema,
  personalGroupId: optionalRelationSchema,
  schedule: habitScheduleSchema,
  startDate: habitLocalDateSchema,
  endDate: habitLocalDateSchema.nullable().default(null),
  nextDueDate: habitLocalDateSchema,
  dueTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'La hora no es válida.')
    .nullable()
    .default(null),
  durationMinutes: z
    .number()
    .int('La duración debe ser entera.')
    .positive('La duración debe ser positiva.')
    .nullable()
    .default(null),
  status: habitLifecycleStatusSchema.default('active'),
  calendarEnabled: z.boolean().default(false),
})

export const recurringTaskInputSchema = recurringTaskInputObjectSchema.superRefine(
  (value, context) => {
    if (value.subjectId !== null && value.personalGroupId !== null) {
      context.addIssue({
        code: 'custom',
        path: ['personalGroupId'],
        message:
          'Una tarea puede relacionarse con una asignatura o un grupo, no ambos.',
      })
    }

    if (value.endDate !== null && value.endDate < value.startDate) {
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'La fecha final no puede ser anterior al inicio.',
      })
    }

    if (value.nextDueDate < value.startDate) {
      context.addIssue({
        code: 'custom',
        path: ['nextDueDate'],
        message: 'La próxima fecha no puede ser anterior al inicio.',
      })
    }
  },
)

export const recurringTaskPatchSchema = recurringTaskInputObjectSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Debes modificar al menos un campo.',
  )

export const recurringTaskScheduleVersionInputSchema = z.object({
  recurringTaskId: z.string().uuid('La tarea recurrente no es válida.'),
  schedule: habitScheduleSchema,
  effectiveFrom: habitLocalDateSchema,
})

export type HabitInput = z.input<typeof habitInputSchema>
export type HabitPatch = z.input<typeof habitPatchSchema>
export type HabitScheduleVersionInput = z.input<typeof habitScheduleVersionInputSchema>
export type HabitLogInput = z.input<typeof habitLogInputSchema>
export type HabitRange = z.input<typeof habitRangeSchema>
export type HabitNoteInput = z.input<typeof habitNoteInputSchema>
export type HabitNotePatch = z.input<typeof habitNotePatchSchema>
export type RecurringTaskInput = z.input<typeof recurringTaskInputSchema>
export type RecurringTaskPatch = z.input<typeof recurringTaskPatchSchema>
export type RecurringTaskScheduleVersionInput = z.input<
  typeof recurringTaskScheduleVersionInputSchema
>
