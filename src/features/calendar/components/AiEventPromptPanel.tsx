import { useMemo, useState, type FormEvent } from 'react'
import type { AiEventDraft, AiReviewFlag } from '../../../types/aiEvents.ts'
import type { PersonalGroup, Subject } from '../../../types/domain.ts'
import { toAppError } from '../../../services/errors.ts'
import {
  eventInputSchema,
  type EventInput,
} from '../../../services/validation.ts'
import { requestAiEventDrafts } from '../../../services/aiEventService.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { TextAreaField } from '../../../components/ui/FormField.tsx'
import { EventForm } from './EventForm.tsx'

const reviewFlagLabels: Record<AiReviewFlag, string> = {
  missing_subject: 'Falta asignar una asignatura.',
  unknown_subject: 'No se identificó la asignatura.',
  unknown_personal_group: 'No se identificó el grupo personal.',
  missing_time: 'No se indicó una hora; se propuso todo el día.',
  ambiguous_date: 'La fecha es ambigua.',
  guessed_date: 'La fecha fue inferida a partir del contexto.',
  uncertain_duration: 'La duración o fecha de término necesita revisión.',
  invalid_status: 'El estado no era claro; se dejó como Pendiente.',
  new_personal_group: 'Se propondrá crear un grupo personal nuevo.',
}

export interface AiEventSaveResult {
  created: number
  createdGroups?: number
  failedIndexes: number[]
  errorMessage?: string
}

interface AiEventPromptPanelProps {
  onCancel: () => void
  onSave: (drafts: AiEventDraft[]) => Promise<AiEventSaveResult>
  personalGroups: Pick<PersonalGroup, 'id' | 'name'>[]
  subjects: Pick<Subject, 'abbreviation' | 'code' | 'id' | 'name'>[]
}

function normalizeGroupName(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
}

function formatDraftDate(input: EventInput): string {
  if (input.isAllDay) {
    return input.endAt
      ? `${input.startAt} a ${input.endAt} · Todo el día`
      : `${input.startAt} · Todo el día`
  }

  const start = new Date(input.startAt)
  const end = input.endAt ? new Date(input.endAt) : null
  const formatter = new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  if (Number.isNaN(start.getTime())) {
    return input.startAt
  }

  return end && !Number.isNaN(end.getTime())
    ? `${formatter.format(start)} a ${formatter.format(end)}`
    : formatter.format(start)
}

function getRelationLabel(
  draft: AiEventDraft,
  subjects: Pick<Subject, 'id' | 'name'>[],
  personalGroups: Pick<PersonalGroup, 'id' | 'name'>[],
): string {
  const input = draft.input

  if (input.kind === 'academic') {
    return subjects.find((subject) => subject.id === input.subjectId)?.name ??
      'Asignatura pendiente'
  }

  if (draft.newPersonalGroupName) {
    return `Nuevo grupo personal: ${draft.newPersonalGroupName}`
  }

  return personalGroups.find((group) => group.id === input.personalGroupId)?.name ??
    'Sin grupo personal'
}

function getDraftValidationError(draft: AiEventDraft): string | null {
  const result = eventInputSchema.safeParse(draft.input)
  return result.success
    ? null
    : result.error.issues[0]?.message ?? 'Revisa los datos de este evento.'
}

function getReviewMessages(flags: AiReviewDraftFlags): string[] {
  return [...new Set(flags)]
    .map((flag) => reviewFlagLabels[flag])
    .filter((message): message is string => Boolean(message))
}

type AiReviewDraftFlags = AiReviewFlag[]

export function AiEventPromptPanel({
  onCancel,
  onSave,
  personalGroups,
  subjects,
}: AiEventPromptPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [drafts, setDrafts] = useState<AiEventDraft[]>([])
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [hasConfirmedNewGroups, setHasConfirmedNewGroups] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const validationErrors = useMemo(
    () =>
      new Map(
        drafts
          .map((draft) => [draft.draftId, getDraftValidationError(draft)] as const)
          .filter((entry): entry is [string, string] => entry[1] !== null),
      ),
    [drafts],
  )
  const editingDraft = drafts.find((draft) => draft.draftId === editingDraftId) ?? null
  const proposedGroupNames = useMemo(() => {
    const names = new Map<string, string>()

    for (const draft of drafts) {
      const name = draft.newPersonalGroupName?.trim()

      if (name) {
        names.set(normalizeGroupName(name), name)
      }
    }

    return [...names.values()]
  }, [drafts])
  const isBusy = isGenerating || isSaving
  const canSave = drafts.length > 0 && validationErrors.size === 0 && !isBusy

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setHasGenerated(true)
    setHasConfirmedNewGroups(false)

    if (!prompt.trim()) {
      setError('Describe al menos un evento.')
      return
    }

    setIsGenerating(true)

    try {
      const nextDrafts = await requestAiEventDrafts({
        personalGroupIds: personalGroups.map((group) => group.id),
        prompt,
        subjectIds: subjects.map((subject) => subject.id),
      })
      setDrafts(nextDrafts)
      setEditingDraftId(null)
    } catch (generationError) {
      setDrafts([])
      setError(
        toAppError(generationError, 'No se pudieron preparar los eventos.').message,
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!canSave) {
      setError('Revisa los borradores marcados antes de guardarlos.')
      return
    }

    if (proposedGroupNames.length > 0 && !hasConfirmedNewGroups) {
      setHasConfirmedNewGroups(true)
      setError(null)
      setSuccessMessage(
        `Se propondrá crear ${proposedGroupNames.length === 1 ? 'el grupo' : 'los grupos'} ${proposedGroupNames.map((name) => `«${name}»`).join(', ')}. Pulsa «Confirmar y guardar» para continuar.`,
      )
      return
    }

    setError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      const result = await onSave(drafts)
      const failedIndexes = new Set(result.failedIndexes)
      const remainingDrafts = drafts.filter((_, index) => failedIndexes.has(index))

      setDrafts(remainingDrafts)
      setEditingDraftId(null)
      setHasConfirmedNewGroups(false)

      if (result.failedIndexes.length > 0) {
        setError(
          result.errorMessage ??
            `Se agregaron ${result.created} eventos, pero no se pudieron guardar todos.`,
        )
        return
      }

      const eventMessage =
        result.created === 1
          ? 'Se agregó 1 evento al calendario.'
          : `Se agregaron ${result.created} eventos al calendario.`
      const groupMessage = result.createdGroups
        ? result.createdGroups === 1
          ? ' También se creó 1 grupo personal.'
          : ` También se crearon ${result.createdGroups} grupos personales.`
        : ''

      setSuccessMessage(`${eventMessage}${groupMessage}`)
      setHasGenerated(false)
    } catch (saveError) {
      setHasConfirmedNewGroups(false)
      setError(toAppError(saveError, 'No se pudieron guardar los eventos.').message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDraftEdit = (draftId: string, input: EventInput) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.draftId === draftId
          ? {
              ...draft,
              input,
              newPersonalGroupName:
                input.kind === 'personal' && input.personalGroupId === null
                  ? draft.newPersonalGroupName
                  : null,
              reviewFlags:
                input.kind === 'personal' &&
                input.personalGroupId === null &&
                draft.newPersonalGroupName
                  ? ['new_personal_group']
                  : [],
            }
          : draft,
      ),
    )
    setEditingDraftId(null)
    setHasConfirmedNewGroups(false)
    setError(null)
  }

  const handleUseNoGroup = (draftId: string) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.draftId === draftId
          ? {
              ...draft,
              newPersonalGroupName: null,
              reviewFlags: draft.reviewFlags.filter(
                (flag) => flag !== 'new_personal_group',
              ),
            }
          : draft,
      ),
    )
    setHasConfirmedNewGroups(false)
    setSuccessMessage(null)
  }

  const handleRemoveDraft = (draftId: string) => {
    setDrafts((currentDrafts) =>
      currentDrafts.filter((item) => item.draftId !== draftId),
    )
    setHasConfirmedNewGroups(false)
    setSuccessMessage(null)
  }

  return (
    <aside
      aria-label="Agregar eventos con IA"
      className="rounded-panel border border-border bg-surface p-5 sm:p-6"
    >
      {editingDraft ? (
        <EventForm
          heading="Revisar evento"
          initialInput={editingDraft.input}
          isLoading={isSaving}
          kind={editingDraft.input.kind}
          onCancel={() => setEditingDraftId(null)}
          onSubmit={async (input) => handleDraftEdit(editingDraft.draftId, input)}
          personalGroups={personalGroups}
          subjects={subjects}
          submitLabel="Aplicar cambios"
        />
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink">
              Agregar eventos con IA
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Describe uno o varios compromisos y recibirás borradores para revisar.
            </p>
          </div>

          <form aria-busy={isGenerating} onSubmit={(event) => void handleGenerate(event)}>
            <TextAreaField
              disabled={isBusy}
              id="ai-event-prompt"
              label="Describe tus eventos"
              maxLength={4000}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="El viernes tengo un control de cálculo a las 10:00 y el sábado una cita médica a las 9:30…"
              value={prompt}
              hint="La descripción se procesa de forma temporal para preparar borradores; revisa todo antes de guardar."
            />
            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <Button disabled={isBusy} onClick={onCancel} variant="ghost">
                Cancelar
              </Button>
              <Button
                isLoading={isGenerating}
                loadingLabel="Preparando borradores…"
                type="submit"
              >
                Preparar borradores
              </Button>
            </div>
          </form>

          {error ? (
            <p aria-live="assertive" className="rounded-control bg-danger-soft px-4 py-3 text-sm leading-6 text-danger" role="alert">
              {error}
            </p>
          ) : null}

          {successMessage ? (
            <p aria-live="polite" className="rounded-control bg-success-soft px-4 py-3 text-sm leading-6 text-success" role="status">
              {successMessage}
            </p>
          ) : null}

          {hasGenerated && !isGenerating && drafts.length === 0 && !error ? (
            <p aria-live="polite" className="text-sm leading-6 text-ink-muted">
              No se encontraron eventos. Prueba con fechas, horarios o títulos más concretos.
            </p>
          ) : null}

          {drafts.length > 0 ? (
            <section aria-labelledby="ai-event-drafts-title" className="space-y-4">
              <div className="flex items-baseline justify-between gap-4 border-t border-border pt-5">
                <h3 className="text-lg font-semibold text-ink" id="ai-event-drafts-title">
                  Revisa tus borradores
                </h3>
                <span className="text-sm text-ink-muted">
                  {drafts.length} {drafts.length === 1 ? 'evento' : 'eventos'}
                </span>
              </div>

              <ol className="divide-y divide-border border-y border-border">
                {drafts.map((draft) => {
                  const reviewMessages = getReviewMessages(draft.reviewFlags)
                  const validationError = validationErrors.get(draft.draftId)

                  return (
                    <li className="space-y-3 py-4 first:pt-0 last:pb-0" key={draft.draftId}>
                      <div>
                        <p className="font-semibold text-ink">{draft.input.title}</p>
                        <p className="mt-1 text-sm leading-6 text-ink-muted">
                          {draft.input.kind === 'academic' ? 'Académico' : 'Personal'} ·{' '}
                          {getRelationLabel(draft, subjects, personalGroups)} ·{' '}
                          {formatDraftDate(draft.input)} ·{' '}
                          {draft.input.status === 'completed' ? 'Completado' : 'Pendiente'}
                        </p>
                      </div>

                      {reviewMessages.length > 0 ? (
                        <p className="text-sm leading-6 text-warning" role="status">
                          {reviewMessages.join(' ')}
                        </p>
                      ) : null}

                      {validationError ? (
                        <p className="text-sm leading-6 text-danger" role="alert">
                          {validationError}
                        </p>
                      ) : null}

                      {draft.newPersonalGroupName ? (
                        <p className="text-sm leading-6 text-warning" role="status">
                          Se propondrá crear el grupo «{draft.newPersonalGroupName}» al guardar.
                        </p>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          aria-label={`Editar borrador ${draft.input.title}`}
                          disabled={isBusy}
                          onClick={() => setEditingDraftId(draft.draftId)}
                          variant="secondary"
                        >
                          Editar
                        </Button>
                        <Button
                          aria-label={`Quitar borrador ${draft.input.title}`}
                          disabled={isBusy}
                          onClick={() => handleRemoveDraft(draft.draftId)}
                          variant="ghost"
                        >
                          Quitar
                        </Button>
                        {draft.newPersonalGroupName ? (
                          <Button
                            aria-label={`No crear grupo para ${draft.input.title}`}
                            disabled={isBusy}
                            onClick={() => handleUseNoGroup(draft.draftId)}
                            variant="ghost"
                          >
                            Usar sin grupo
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ol>

              {proposedGroupNames.length > 0 ? (
                <p className="border-t border-border pt-4 text-sm leading-6 text-warning" role="status">
                  Al guardar se crearán, previa confirmación, los grupos personales:{' '}
                  {proposedGroupNames.map((name) => `«${name}»`).join(', ')}.
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <Button disabled={isBusy} onClick={onCancel} variant="ghost">
                  Cancelar
                </Button>
                <Button disabled={!canSave} isLoading={isSaving} onClick={() => void handleSave()}>
                  {proposedGroupNames.length > 0 && !hasConfirmedNewGroups
                    ? 'Confirmar y guardar'
                    : `Guardar eventos (${drafts.length})`}
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </aside>
  )
}
