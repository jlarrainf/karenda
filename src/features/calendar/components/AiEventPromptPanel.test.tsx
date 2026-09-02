import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventInput } from '../../../services/validation.ts'
import { AiEventPromptPanel } from './AiEventPromptPanel.tsx'
import { requestAiEventDrafts } from '../../../services/aiEventService.ts'

vi.mock('../../../services/aiEventService.ts', () => ({
  requestAiEventDrafts: vi.fn(),
}))

const subjectId = '11111111-1111-4111-8111-111111111111'
const groupId = '33333333-3333-4333-8333-333333333333'

const subject = {
  abbreviation: 'ALG',
  code: 'MAT-101',
  id: subjectId,
  name: 'Álgebra',
}

const personalGroup = {
  id: groupId,
  name: 'Salud',
}

const academicInput: EventInput = {
  description: 'Repasar derivadas.',
  endAt: null,
  isAllDay: false,
  kind: 'academic',
  location: 'Sala 12',
  personalGroupId: null,
  startAt: '2026-09-04T10:00',
  status: 'pending',
  subjectId,
  title: 'Control de Álgebra',
}

const personalInput: EventInput = {
  description: null,
  endAt: null,
  isAllDay: false,
  kind: 'personal',
  location: null,
  personalGroupId: groupId,
  startAt: '2026-09-05T09:30',
  status: 'pending',
  subjectId: null,
  title: 'Cita médica',
}

const defaultProps = {
  onCancel: vi.fn(),
  onSave: vi.fn(),
  personalGroups: [personalGroup],
  subjects: [subject],
}

describe('AiEventPromptPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('previews several drafts and only saves after explicit confirmation', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({ created: 2, failedIndexes: [] })
    vi.mocked(requestAiEventDrafts).mockResolvedValue([
      {
        draftId: 'ai-draft-1',
        input: academicInput,
        newPersonalGroupName: null,
        reviewFlags: [],
      },
      {
        draftId: 'ai-draft-2',
        input: personalInput,
        newPersonalGroupName: null,
        reviewFlags: [],
      },
    ])

    render(<AiEventPromptPanel {...defaultProps} onSave={onSave} />)

    await user.type(
      screen.getByLabelText('Describe tus eventos'),
      'Tengo un control y una cita médica.',
    )
    await user.click(screen.getByRole('button', { name: 'Preparar borradores' }))

    expect(await screen.findByText('Revisa tus borradores')).toBeVisible()
    expect(screen.getByText('Control de Álgebra')).toBeVisible()
    expect(screen.getByText('Cita médica')).toBeVisible()
    expect(onSave).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Guardar eventos (2)' }))

    expect(onSave).toHaveBeenCalledWith([
      {
        draftId: 'ai-draft-1',
        input: academicInput,
        newPersonalGroupName: null,
        reviewFlags: [],
      },
      {
        draftId: 'ai-draft-2',
        input: personalInput,
        newPersonalGroupName: null,
        reviewFlags: [],
      },
    ])
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Se agregaron 2 eventos al calendario.',
    )
  })

  it('blocks saving until an incomplete academic draft is corrected', async () => {
    const user = userEvent.setup()
    vi.mocked(requestAiEventDrafts).mockResolvedValue([
      {
        draftId: 'ai-draft-1',
        input: { ...academicInput, subjectId: null },
        newPersonalGroupName: null,
        reviewFlags: ['missing_subject'],
      },
    ])

    render(<AiEventPromptPanel {...defaultProps} />)

    await user.type(screen.getByLabelText('Describe tus eventos'), 'Control el viernes.')
    await user.click(screen.getByRole('button', { name: 'Preparar borradores' }))

    expect(await screen.findByText('Falta asignar una asignatura.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Guardar eventos (1)' })).toBeDisabled()
  })

  it('keeps failed drafts visible after a partial save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({
      created: 1,
      errorMessage: 'No se pudo guardar el segundo evento.',
      failedIndexes: [1],
    })

    vi.mocked(requestAiEventDrafts).mockResolvedValue([
      {
        draftId: 'ai-draft-1',
        input: academicInput,
        newPersonalGroupName: null,
        reviewFlags: [],
      },
      {
        draftId: 'ai-draft-2',
        input: personalInput,
        newPersonalGroupName: null,
        reviewFlags: [],
      },
    ])

    render(<AiEventPromptPanel {...defaultProps} onSave={onSave} />)

    await user.type(screen.getByLabelText('Describe tus eventos'), 'Dos eventos.')
    await user.click(screen.getByRole('button', { name: 'Preparar borradores' }))
    await screen.findByText('Revisa tus borradores')
    await user.click(screen.getByRole('button', { name: 'Guardar eventos (2)' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo guardar el segundo evento.',
    )
    expect(screen.queryByText('Control de Álgebra')).not.toBeInTheDocument()
    expect(screen.getByText('Cita médica')).toBeVisible()
  })

  it('requires a second confirmation before creating a proposed personal group', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({
      created: 1,
      createdGroups: 1,
      failedIndexes: [],
    })
    const proposedInput: EventInput = {
      ...personalInput,
      personalGroupId: null,
      title: 'Control médico',
    }

    vi.mocked(requestAiEventDrafts).mockResolvedValue([
      {
        draftId: 'ai-draft-1',
        input: proposedInput,
        newPersonalGroupName: 'Salud',
        reviewFlags: ['new_personal_group'],
      },
    ])

    render(<AiEventPromptPanel {...defaultProps} onSave={onSave} />)

    await user.type(screen.getByLabelText('Describe tus eventos'), 'Cita médica.')
    await user.click(screen.getByRole('button', { name: 'Preparar borradores' }))

    expect(await screen.findByText(/Nuevo grupo personal: Salud/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(await screen.findByText(/Pulsa «Confirmar y guardar»/)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Guardar eventos (1)' }))

    expect(onSave).toHaveBeenCalledWith([
      {
        draftId: 'ai-draft-1',
        input: proposedInput,
        newPersonalGroupName: 'Salud',
        reviewFlags: ['new_personal_group'],
      },
    ])
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Se agregó 1 evento al calendario. También se creó 1 grupo personal.',
    )
  })
})
