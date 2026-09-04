import { useState, type FormEvent } from 'react'
import type { Habit, PersonalGroup, Subject } from '../../../types/domain.ts'
import type { HabitInput } from '../../../services/habitValidation.ts'
import type { AiHabitAnswer, AiHabitDraft, AiHabitQuestionSet } from '../../../types/aiHabits.ts'
import { requestAiHabitPlan } from '../../../services/aiHabitService.ts'
import { toAppError } from '../../../services/errors.ts'
import { describeSchedule, formatHabitGoal } from '../utils/habitRecurrence.ts'
import { Button } from '../../../components/ui/Button.tsx'
import { TextAreaField } from '../../../components/ui/FormField.tsx'
import { HabitForm } from './HabitForm.tsx'

interface AiHabitPromptPanelProps {
  onCancel: () => void
  onSave: (drafts: AiHabitDraft[]) => Promise<{ created: number; failedIndexes: number[] }>
  personalGroups: Pick<PersonalGroup, 'id' | 'name'>[]
  subjects: Pick<Subject, 'id' | 'name'>[]
}

const flagLabels: Record<string, string> = {
  unknown_subject: 'No se identificó la asignatura.',
  unknown_personal_group: 'No se identificó el grupo personal.',
  ambiguous_date: 'La fecha necesita revisión.',
  guessed_schedule: 'La frecuencia fue inferida; revísala.',
  invalid_tracking_type: 'El tipo de seguimiento fue corregido.',
}

function draftSummary(input: HabitInput): string {
  const schedule = { ...input.schedule, weekdays: input.schedule.weekdays ?? [], dayOfMonth: input.schedule.dayOfMonth ?? null, anchorDate: input.schedule.anchorDate ?? null } as Habit['schedule']
  return `${formatHabitGoal(input.trackingType, input.goalValue, input.unit ?? null)} · ${describeSchedule(schedule)}`
}

export function AiHabitPromptPanel({ onCancel, onSave, personalGroups, subjects }: AiHabitPromptPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<'quick' | 'guided'>('quick')
  const [drafts, setDrafts] = useState<AiHabitDraft[]>([])
  const [questionSet, setQuestionSet] = useState<AiHabitQuestionSet | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<AiHabitAnswer[]>([])
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [otherText, setOtherText] = useState('')
  const [noPreference, setNoPreference] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const editingDraft = drafts.find((draft) => draft.draftId === editingId) ?? null
  const busy = isGenerating || isSaving

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(null); setSuccess(null); setHasGenerated(true)
    if (!prompt.trim()) { setError('Describe al menos un hábito.'); return }
    setIsGenerating(true)
    try {
      const plan = await requestAiHabitPlan({ mode, prompt, personalGroupIds: personalGroups.map((group) => group.id), subjectIds: subjects.map((subject) => subject.id) })
      if (!Array.isArray(plan)) { setQuestionSet(plan); setQuestionIndex(0); setAnswers([]); setSelectedOptionId(null); setOtherText(''); setNoPreference(false) }
      else { setDrafts(plan); setEditingId(null) }
    }
    catch (generationError) { setDrafts([]); setError(toAppError(generationError, 'No se pudieron preparar los hábitos.').message) }
    finally { setIsGenerating(false) }
  }

  const activeQuestionSet = questionSet
  const currentQuestion = activeQuestionSet?.questions[questionIndex] ?? null
  const submitQuestion = async () => {
    if (!currentQuestion || !activeQuestionSet || isGenerating) return
    if (!noPreference && !selectedOptionId && !otherText.trim()) { setError('Selecciona una alternativa, escribe otra respuesta o elige «No me importa».'); return }
    const nextAnswers = [...answers, { questionId: currentQuestion.id, optionId: selectedOptionId, otherText: otherText.trim() || null, noPreference }]
    if (questionIndex < activeQuestionSet.questions.length - 1) { setAnswers(nextAnswers); setQuestionIndex((index) => index + 1); setSelectedOptionId(null); setOtherText(''); setNoPreference(false); setError(null); return }
    setIsGenerating(true); setError(null)
    try {
      const plan = await requestAiHabitPlan({ answers: nextAnswers, mode: 'guided', prompt, personalGroupIds: personalGroups.map((group) => group.id), subjectIds: subjects.map((subject) => subject.id) })
      if (!Array.isArray(plan)) throw new Error('unexpected questions')
      setDrafts(plan); setQuestionSet(null); setAnswers([]); setEditingId(null)
    } catch (generationError) { setError(toAppError(generationError, 'No se pudieron preparar los hábitos.').message) }
    finally { setIsGenerating(false) }
  }

  const save = async () => {
    if (!drafts.length || busy) return
    setError(null); setSuccess(null); setIsSaving(true)
    try { const result = await onSave(drafts); const failed = new Set(result.failedIndexes); setDrafts((current) => current.filter((_, index) => failed.has(index))); setEditingId(null); if (failed.size) setError(`Se crearon ${result.created} hábitos, pero algunos no se pudieron guardar.`); else { setSuccess(`Se crearon ${result.created} ${result.created === 1 ? 'hábito' : 'hábitos'}.`); setHasGenerated(false) } }
    catch (saveError) { setError(toAppError(saveError, 'No se pudieron guardar los hábitos.').message) }
    finally { setIsSaving(false) }
  }

  if (editingDraft) return <HabitForm heading="Revisar hábito" initialInput={editingDraft.input} isLoading={isSaving} onCancel={() => setEditingId(null)} onSubmit={async (input) => { setDrafts((current) => current.map((draft) => draft.draftId === editingDraft.draftId ? { ...draft, input, reviewFlags: [] } : draft)); setEditingId(null) }} personalGroups={personalGroups} subjects={subjects} />

  if (currentQuestion && activeQuestionSet) return <aside aria-label="Preguntas para preparar el hábito" className="rounded-panel border border-border bg-surface p-5 sm:p-6"><div className="space-y-6" role="dialog" aria-labelledby="ai-habit-question-title"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">Pregunta {questionIndex + 1} de {activeQuestionSet.questions.length}</p><h2 className="mt-2 text-xl font-bold tracking-tight text-ink" id="ai-habit-question-title">{currentQuestion.question}</h2></div><div className="grid gap-2">{currentQuestion.options.map((option) => <button aria-pressed={selectedOptionId === option.id && !noPreference} className={`min-h-11 rounded-control border px-4 py-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft ${selectedOptionId === option.id && !noPreference ? 'border-brand bg-brand-soft text-brand' : 'border-border text-ink hover:bg-surface-subtle'}`} key={option.id} onClick={() => { setSelectedOptionId(option.id); setNoPreference(false) }} type="button">{option.label}</button>)}{currentQuestion.allowsOther ? <><button aria-pressed={selectedOptionId === null && Boolean(otherText) && !noPreference} className={`min-h-11 rounded-control border px-4 py-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft ${selectedOptionId === null && otherText && !noPreference ? 'border-brand bg-brand-soft text-brand' : 'border-border text-ink hover:bg-surface-subtle'}`} onClick={() => { setSelectedOptionId(null); setNoPreference(false) }} type="button">Otro</button><input aria-label="Otra respuesta" className="min-h-11 rounded-control border border-border bg-surface px-3 text-sm text-ink" onChange={(event) => { setOtherText(event.target.value); setSelectedOptionId(null); setNoPreference(false) }} placeholder="Escribe tu respuesta" value={otherText} /></> : null}<button aria-pressed={noPreference} className={`min-h-11 rounded-control border px-4 py-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft ${noPreference ? 'border-brand bg-brand-soft text-brand' : 'border-border text-ink hover:bg-surface-subtle'}`} onClick={() => { setNoPreference(true); setSelectedOptionId(null); setOtherText('') }} type="button">No me importa</button></div>{error ? <p aria-live="assertive" className="rounded-control bg-danger-soft px-4 py-3 text-sm leading-6 text-danger" role="alert">{error}</p> : null}<div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end"><Button disabled={isGenerating} onClick={onCancel} variant="ghost">Cancelar</Button><Button isLoading={isGenerating} loadingLabel="Preparando hábito…" onClick={() => void submitQuestion()}>{questionIndex === activeQuestionSet.questions.length - 1 ? 'Preparar hábito' : 'Continuar'}</Button></div></div></aside>

  return <aside aria-label="Agregar hábitos con IA" className="rounded-panel border border-border bg-surface p-5 sm:p-6">
    <div className="space-y-6">
      <div><h2 className="text-xl font-bold tracking-tight text-ink">Agregar hábitos con IA</h2><p className="mt-2 text-sm leading-6 text-ink-muted">Describe uno o varios hábitos y recibirás borradores para revisar antes de guardarlos.</p></div>
      <div aria-label="Modo de creación" className="flex items-center justify-between gap-4 rounded-control border border-border bg-surface-subtle px-4 py-3"><div><p className="text-sm font-semibold text-ink">Creación guiada</p><p className="text-xs leading-5 text-ink-muted">Responde preguntas para ajustar mejor la meta y frecuencia.</p></div><button aria-checked={mode === 'guided'} aria-label="Cambiar entre creación rápida y guiada" className={`relative h-7 w-12 rounded-full transition-colors duration-state focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-soft ${mode === 'guided' ? 'bg-brand' : 'bg-surface-strong'}`} onClick={() => setMode((current) => current === 'quick' ? 'guided' : 'quick')} role="switch" type="button"><span className={`absolute top-1 size-5 rounded-full bg-surface transition-transform duration-state ${mode === 'guided' ? 'translate-x-6' : 'translate-x-1'}`} /></button></div>
      <form aria-busy={isGenerating} onSubmit={(event) => void generate(event)}>
        <TextAreaField disabled={busy} id="ai-habit-prompt" label="Describe tus hábitos" maxLength={4000} onChange={(event) => setPrompt(event.target.value)} placeholder="Leer 20 páginas de lunes a viernes y hacer ejercicio 30 minutos tres veces por semana…" value={prompt} hint="La descripción se procesa temporalmente; revisa cada regla antes de guardar." />
        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end"><Button disabled={busy} onClick={onCancel} variant="ghost">Cancelar</Button><Button isLoading={isGenerating} loadingLabel="Preparando borradores…" type="submit">Preparar borradores</Button></div>
      </form>
      {error ? <p aria-live="assertive" className="rounded-control bg-danger-soft px-4 py-3 text-sm leading-6 text-danger" role="alert">{error}</p> : null}
      {success ? <p aria-live="polite" className="rounded-control bg-success-soft px-4 py-3 text-sm leading-6 text-success" role="status">{success}</p> : null}
      {hasGenerated && !busy && !drafts.length && !error ? <p className="text-sm text-ink-muted" role="status">No se encontraron hábitos. Prueba con una meta y frecuencia más concretas.</p> : null}
      {drafts.length ? <section aria-labelledby="ai-habit-drafts-title" className="space-y-4"><div className="flex items-baseline justify-between gap-4 border-t border-border pt-5"><h3 className="text-lg font-semibold text-ink" id="ai-habit-drafts-title">Revisa tus borradores</h3><span className="text-sm text-ink-muted">{drafts.length} {drafts.length === 1 ? 'hábito' : 'hábitos'}</span></div><ol className="divide-y divide-border border-y border-border">{drafts.map((draft) => <li className="space-y-3 py-4 first:pt-0 last:pb-0" key={draft.draftId}><div><p className="font-semibold text-ink">{draft.input.name}</p><p className="mt-1 text-sm leading-6 text-ink-muted">{draftSummary(draft.input)} · Inicio {draft.input.startDate}</p></div>{draft.reviewFlags.length ? <p className="text-sm leading-6 text-warning" role="status">{draft.reviewFlags.map((flag) => flagLabels[flag] ?? 'Revisa este borrador.').join(' ')}</p> : null}<div className="flex flex-wrap gap-2"><Button aria-label={`Editar borrador ${draft.input.name}`} disabled={busy} onClick={() => setEditingId(draft.draftId)} variant="secondary">Editar</Button><Button aria-label={`Quitar borrador ${draft.input.name}`} disabled={busy} onClick={() => setDrafts((current) => current.filter((item) => item.draftId !== draft.draftId))} variant="ghost">Quitar</Button></div></li>)}</ol><div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end"><Button disabled={busy} onClick={onCancel} variant="ghost">Cancelar</Button><Button disabled={busy} isLoading={isSaving} onClick={() => void save()}>Guardar hábitos ({drafts.length})</Button></div></section> : null}
    </div>
  </aside>
}
