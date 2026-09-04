import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PersonalGroup, Subject } from '../../../types/domain.ts'
import { EventForm } from './EventForm.tsx'

const subject: Subject = {
  abbreviation: 'ALG',
  code: 'MAT-101',
  color: '#2F625A',
  createdAt: '2026-08-30T10:00:00.000Z',
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Álgebra',
  ownerId: '22222222-2222-4222-8222-222222222222',
  updatedAt: '2026-08-30T10:00:00.000Z',
}

const personalGroup: PersonalGroup = {
  color: '#8A5A20',
  createdAt: '2026-08-30T10:00:00.000Z',
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Salud',
  ownerId: '22222222-2222-4222-8222-222222222222',
  updatedAt: '2026-08-30T10:00:00.000Z',
}

const defaultProps = {
  isLoading: false,
  kind: 'academic' as const,
  onCancel: vi.fn(),
  personalGroups: [],
  subjects: [subject],
}

describe('EventForm', () => {
  it('allows choosing the event kind while creating', async () => {
    const user = userEvent.setup()
    const onKindChange = vi.fn()

    render(
      <EventForm
        {...defaultProps}
        onKindChange={onKindChange}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.selectOptions(screen.getByLabelText('Tipo de evento'), 'personal')

    expect(onKindChange).toHaveBeenCalledWith('personal')
  })

  it('shows required academic field errors before submitting', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<EventForm {...defaultProps} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Guardar evento' }))

    expect(
      await screen.findByText('El título del evento es obligatorio.'),
    ).toBeVisible()
    expect(
      await screen.findByText('Los eventos académicos requieren una asignatura.'),
    ).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a valid academic event with optional fields normalized', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<EventForm {...defaultProps} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/^Título/), 'Control 1')
    await user.selectOptions(screen.getByLabelText(/^Asignatura/), subject.id)
    fireEvent.change(screen.getByLabelText(/^Fecha de inicio/), {
      target: { value: '2026-09-01' },
    })
    fireEvent.change(screen.getByLabelText(/^Hora de inicio/), {
      target: { value: '10:00' },
    })
    await user.type(screen.getByLabelText(/^Lugar/), 'Sala 12')

    await user.click(screen.getByRole('button', { name: 'Guardar evento' }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith({
      description: null,
      endAt: null,
      isAllDay: false,
      kind: 'academic',
      location: 'Sala 12',
      personalGroupId: null,
      startAt: '2026-09-01T10:00',
      status: 'pending',
      subjectId: subject.id,
      title: 'Control 1',
    })
  })

  it('submits a personal event with an optional group and no subject', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <EventForm
        {...defaultProps}
        kind="personal"
        onSubmit={onSubmit}
        personalGroups={[personalGroup]}
        subjects={[]}
      />,
    )

    await user.type(screen.getByLabelText(/^Título/), 'Consulta médica')
    await user.selectOptions(screen.getByLabelText(/^Grupo personal/), personalGroup.id)
    fireEvent.change(screen.getByLabelText(/^Fecha de inicio/), {
      target: { value: '2026-09-02' },
    })
    fireEvent.change(screen.getByLabelText(/^Hora de inicio/), {
      target: { value: '09:30' },
    })

    await user.click(screen.getByRole('button', { name: 'Guardar evento' }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'personal',
        personalGroupId: personalGroup.id,
        subjectId: null,
        title: 'Consulta médica',
      }),
    )
  })

  it('keeps local dates for an all-day event and hides time controls', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<EventForm {...defaultProps} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/^Título/), 'Semana de estudio')
    await user.selectOptions(screen.getByLabelText(/^Asignatura/), subject.id)
    fireEvent.change(screen.getByLabelText(/^Fecha de inicio/), {
      target: { value: '2026-09-10' },
    })
    await user.click(screen.getByRole('checkbox', { name: /Evento de todo el día/ }))
    fireEvent.change(screen.getByLabelText(/^Fecha de término/), {
      target: { value: '2026-09-12' },
    })

    expect(screen.queryByLabelText(/^Hora de inicio/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Hora de término/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guardar evento' }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        endAt: '2026-09-12',
        isAllDay: true,
        startAt: '2026-09-10',
      }),
    )
  })

  it('rejects an end time that is not after the start time', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<EventForm {...defaultProps} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/^Título/), 'Control 2')
    await user.selectOptions(screen.getByLabelText(/^Asignatura/), subject.id)
    fireEvent.change(screen.getByLabelText(/^Fecha de inicio/), {
      target: { value: '2026-09-10' },
    })
    fireEvent.change(screen.getByLabelText(/^Hora de inicio/), {
      target: { value: '10:00' },
    })
    fireEvent.change(screen.getByLabelText(/^Fecha de término/), {
      target: { value: '2026-09-10' },
    })
    fireEvent.change(screen.getByLabelText(/^Hora de término/), {
      target: { value: '09:00' },
    })

    await user.click(screen.getByRole('button', { name: 'Guardar evento' }))

    expect(
      await screen.findByText('El término debe ser posterior al inicio.'),
    ).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
