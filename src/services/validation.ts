import { z } from 'zod'
import { validationError } from './errors.ts'

const nonEmptyText = (message: string, maxLength = 500) =>
  z
    .string()
    .min(1, message)
    .max(maxLength, 'El texto es demasiado largo.')
    .refine((value) => value.trim().length > 0, message)

const emailSchema = z
  .string()
  .trim()
  .superRefine((value, context) => {
    if (!value) {
      context.addIssue({
        code: 'custom',
        message: 'Ingresa tu correo electrónico.',
      })
      return
    }

    if (!z.email().safeParse(value).success) {
      context.addIssue({
        code: 'custom',
        message: 'Ingresa un correo electrónico válido.',
      })
    }
  })

const passwordSchema = z
  .string()
  .min(6, 'La contraseña debe tener al menos 6 caracteres.')

export const entityIdSchema = z.string().uuid('El identificador no es válido.')

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().max(120, 'El nombre es demasiado largo.').optional(),
  redirectTo: z.string().url('La dirección de redirección no es válida.').optional(),
})

export const signInInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresa tu contraseña.'),
})

export const emailVerificationInputSchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos.'),
})

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
  redirectTo: z.string().url('La dirección de redirección no es válida.').optional(),
})

export const verificationEmailRequestSchema = z.object({
  email: emailSchema,
  redirectTo: z.string().url('La dirección de redirección no es válida.').optional(),
})

export const passwordResetExchangeSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos.'),
})

export const passwordResetSchema = z.object({
  newPassword: passwordSchema,
  token: z.string().min(1, 'El token de recuperación es obligatorio.'),
})

export const subjectInputSchema = z.object({
  name: nonEmptyText('El nombre de la asignatura es obligatorio.', 160),
  code: nonEmptyText('La sigla de la asignatura es obligatoria.', 40),
  abbreviation: nonEmptyText('La abreviación de la asignatura es obligatoria.', 40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe tener formato #RRGGBB.'),
})

export const subjectPatchSchema = subjectInputSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Debes modificar al menos un campo.',
  )

export const personalGroupInputSchema = z.object({
  name: nonEmptyText('El nombre del grupo es obligatorio.', 160),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe tener formato #RRGGBB.')
    .nullable()
    .optional(),
})

export const personalGroupPatchSchema = personalGroupInputSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Debes modificar al menos un campo.',
  )

const eventKindSchema = z.enum(['academic', 'personal'])
export const eventStatusSchema = z.enum(['pending', 'completed'])
export const academicActivityTypeSchema = z.enum([
  'assignment',
  'graded_discussion',
  'quiz',
  'oral_assessment',
  'test',
  'exam',
  'other',
])
export const noteTargetTypeSchema = z.enum(['subject', 'personal_group'])

export const aiReviewFlagSchema = z.enum([
  'missing_subject',
  'unknown_subject',
  'unknown_personal_group',
  'missing_time',
  'ambiguous_date',
  'guessed_date',
  'uncertain_duration',
  'invalid_status',
  'new_subject',
  'new_personal_group',
])

export const eventDateSchema = z
  .string()
  .min(1, 'La fecha del evento es obligatoria.')
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    'La fecha del evento no es válida.',
  )

function hasTimeComponent(value: string): boolean {
  return /T\d{2}:\d{2}/.test(value)
}

function comparableEventValue(value: string, isAllDay: boolean): number | string {
  return isAllDay ? value.slice(0, 10) : Date.parse(value)
}

const eventInputBaseSchema = z.object({
  kind: eventKindSchema,
  title: nonEmptyText('El título del evento es obligatorio.', 240),
  subjectId: entityIdSchema.nullable().optional(),
  personalGroupId: entityIdSchema.nullable().optional(),
  startAt: eventDateSchema,
  endAt: eventDateSchema.nullable().optional(),
  isAllDay: z.boolean().default(false),
  status: eventStatusSchema.default('pending'),
  location: z.string().max(240, 'El lugar es demasiado largo.').nullable().optional(),
  description: z
    .string()
    .max(5000, 'La descripción es demasiado larga.')
    .nullable()
    .optional(),
  academicActivityType: academicActivityTypeSchema.nullable().optional(),
})

export const eventInputSchema = eventInputBaseSchema.superRefine((value, context) => {
  const subjectId = value.subjectId ?? null
  const personalGroupId = value.personalGroupId ?? null

  if (value.kind === 'academic' && subjectId === null) {
    context.addIssue({
      code: 'custom',
      path: ['subjectId'],
      message: 'Los eventos académicos requieren una asignatura.',
    })
  }

  if (value.kind === 'academic' && personalGroupId !== null) {
    context.addIssue({
      code: 'custom',
      path: ['personalGroupId'],
      message: 'Los eventos académicos no pueden tener un grupo personal.',
    })
  }

  if (value.kind === 'personal' && subjectId !== null) {
    context.addIssue({
      code: 'custom',
      path: ['subjectId'],
      message: 'Los eventos personales no pueden tener una asignatura.',
    })
  }

  if (value.kind === 'personal' && value.academicActivityType) {
    context.addIssue({
      code: 'custom',
      path: ['academicActivityType'],
      message: 'Los eventos personales no usan una categoría académica.',
    })
  }

  if (!value.isAllDay && !hasTimeComponent(value.startAt)) {
    context.addIssue({
      code: 'custom',
      path: ['startAt'],
      message: 'Los eventos con hora requieren una hora de inicio.',
    })
  }

  if (
    !value.isAllDay &&
    value.endAt !== null &&
    value.endAt !== undefined &&
    !hasTimeComponent(value.endAt)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['endAt'],
      message: 'Los eventos con hora requieren una hora de término.',
    })
  }

  if (value.isAllDay && !/^\d{4}-\d{2}-\d{2}/.test(value.startAt)) {
    context.addIssue({
      code: 'custom',
      path: ['startAt'],
      message: 'Los eventos de todo el día requieren una fecha local válida.',
    })
  }

  if (value.endAt !== null && value.endAt !== undefined) {
    if (value.isAllDay && !/^\d{4}-\d{2}-\d{2}/.test(value.endAt)) {
      context.addIssue({
        code: 'custom',
        path: ['endAt'],
        message: 'La fecha local de término no es válida.',
      })
    }

    const start = comparableEventValue(value.startAt, value.isAllDay)
    const end = comparableEventValue(value.endAt, value.isAllDay)

    if (end <= start) {
      context.addIssue({
        code: 'custom',
        path: ['endAt'],
        message: 'El término debe ser posterior al inicio.',
      })
    }
  }
})

export const eventPatchSchema = eventInputBaseSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Debes modificar al menos un campo.',
  )

const aiEventDraftSchema = z
  .object({
    kind: eventKindSchema,
    title: nonEmptyText('El título del evento es obligatorio.', 240),
    subject_id: entityIdSchema.nullable(),
    personal_group_id: entityIdSchema.nullable(),
    start_at: eventDateSchema,
    end_at: eventDateSchema.nullable(),
    is_all_day: z.boolean(),
    status: eventStatusSchema.default('pending'),
    location: z
      .string()
      .max(240, 'El lugar es demasiado largo.')
      .nullable(),
    description: z
      .string()
      .max(5000, 'La descripción es demasiado larga.')
      .nullable(),
    new_subject_name: z
      .string()
      .trim()
      .min(1, 'El nombre de la asignatura no puede estar vacío.')
      .max(160, 'El nombre de la asignatura es demasiado largo.')
      .nullable()
      .default(null),
    new_personal_group_name: z
      .string()
      .trim()
      .min(1, 'El nombre del grupo personal no puede estar vacío.')
      .max(160, 'El nombre del grupo personal es demasiado largo.')
      .nullable(),
    review_flags: z.array(aiReviewFlagSchema).max(8).default([]),
  })
  .superRefine((value, context) => {
    if (value.is_all_day && !/^\d{4}-\d{2}-\d{2}$/.test(value.start_at)) {
      context.addIssue({
        code: 'custom',
        path: ['start_at'],
        message: 'Los eventos de todo el día requieren una fecha local válida.',
      })
    }

    if (!value.is_all_day && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value.start_at)) {
      context.addIssue({
        code: 'custom',
        path: ['start_at'],
        message: 'Los eventos con hora requieren una fecha y hora local válida.',
      })
    }

    if (value.end_at !== null) {
      const endPattern = value.is_all_day
        ? /^\d{4}-\d{2}-\d{2}$/
        : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

      if (!endPattern.test(value.end_at)) {
        context.addIssue({
          code: 'custom',
          path: ['end_at'],
          message: 'La fecha de término no tiene un formato local válido.',
        })
      } else {
        const startValue = value.is_all_day
          ? value.start_at
          : Date.parse(`${value.start_at}:00Z`)
        const endValue = value.is_all_day
          ? value.end_at
          : Date.parse(`${value.end_at}:00Z`)

        if (endValue <= startValue) {
          context.addIssue({
            code: 'custom',
            path: ['end_at'],
            message: 'El término debe ser posterior al inicio.',
          })
        }
      }
    }

    if (value.kind === 'academic' && value.personal_group_id !== null) {
      context.addIssue({
        code: 'custom',
        path: ['personal_group_id'],
        message: 'Los eventos académicos no pueden tener un grupo personal.',
      })
    }

    if (value.kind === 'personal' && value.subject_id !== null) {
      context.addIssue({
        code: 'custom',
        path: ['subject_id'],
        message: 'Los eventos personales no pueden tener una asignatura.',
      })
    }

    if (value.kind === 'personal' && value.new_subject_name !== null) {
      context.addIssue({
        code: 'custom',
        path: ['new_subject_name'],
        message: 'Los eventos personales no pueden proponer una asignatura.',
      })
    }

    if (value.subject_id !== null && value.new_subject_name !== null) {
      context.addIssue({
        code: 'custom',
        path: ['new_subject_name'],
        message: 'Un evento no puede usar una asignatura existente y proponer otra.',
      })
    }

    if (value.kind === 'academic' && value.new_personal_group_name !== null) {
      context.addIssue({
        code: 'custom',
        path: ['new_personal_group_name'],
        message: 'Los eventos académicos no pueden proponer un grupo personal.',
      })
    }

    if (value.personal_group_id !== null && value.new_personal_group_name !== null) {
      context.addIssue({
        code: 'custom',
        path: ['new_personal_group_name'],
        message: 'Un evento no puede usar un grupo existente y proponer otro.',
      })
    }

    if (
      value.review_flags.includes('new_personal_group') &&
      value.new_personal_group_name === null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['new_personal_group_name'],
        message: 'La propuesta de grupo personal requiere un nombre.',
      })
    }

    if (
      value.review_flags.includes('new_subject') &&
      value.new_subject_name === null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['new_subject_name'],
        message: 'La propuesta de asignatura requiere un nombre.',
      })
    }
  })

export const aiEventDraftResponseSchema = z.object({
  events: z.array(aiEventDraftSchema).max(20),
})

export const noteInputSchema = z.object({
  targetType: noteTargetTypeSchema,
  targetId: entityIdSchema,
  title: nonEmptyText('El título de la nota es obligatorio.', 240),
  contentMarkdown: nonEmptyText('El contenido de la nota es obligatorio.', 100000),
})

export const notePatchSchema = noteInputSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Debes modificar al menos un campo.',
  )

export const eventRangeSchema = z
  .object({
    startAt: eventDateSchema,
    endAt: eventDateSchema,
  })
  .refine((value) => Date.parse(value.endAt) > Date.parse(value.startAt), {
    path: ['endAt'],
    message: 'El rango de consulta no es válido.',
  })

export function parseInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input)

  if (!result.success) {
    throw validationError(
      result.error.issues[0]?.message ?? 'Los datos no son válidos.',
    )
  }

  return result.data
}

export type RegisterInput = z.input<typeof registerInputSchema>
export type SignInInput = z.input<typeof signInInputSchema>
export type EmailVerificationInput = z.input<typeof emailVerificationInputSchema>
export type PasswordResetRequest = z.input<typeof passwordResetRequestSchema>
export type VerificationEmailRequest = z.input<typeof verificationEmailRequestSchema>
export type PasswordResetExchange = z.input<typeof passwordResetExchangeSchema>
export type PasswordReset = z.input<typeof passwordResetSchema>
export type SubjectInput = z.input<typeof subjectInputSchema>
export type SubjectPatch = z.input<typeof subjectPatchSchema>
export type PersonalGroupInput = z.input<typeof personalGroupInputSchema>
export type PersonalGroupPatch = z.input<typeof personalGroupPatchSchema>
export type EventInput = z.input<typeof eventInputSchema>
export type NormalizedEventInput = z.output<typeof eventInputSchema>
export type EventPatch = z.input<typeof eventPatchSchema>
export type NoteInput = z.input<typeof noteInputSchema>
export type NotePatch = z.input<typeof notePatchSchema>
export type EventRange = z.input<typeof eventRangeSchema>
export type AiEventDraftResponse = z.input<typeof aiEventDraftResponseSchema>
