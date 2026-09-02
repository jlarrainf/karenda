import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RecurringTaskForm } from './RecurringTaskForm.tsx'

const existingTask = {
  calendarEnabled: false,
  color: null,
  createdAt: '2026-09-01T12:00:00.000Z',
  description: null,
  dueTime: null,
  durationMinutes: null,
  endDate: null,
  id: '11111111-1111-4111-8111-111111111111',
  nextDueDate: '2026-09-03',
  ownerId: '22222222-2222-4222-8222-222222222222',
  personalGroupId: null,
  schedule: {
    anchorDate: null,
    dayOfMonth: null,
    interval: 1,
    unit: 'day' as const,
    weekdays: [],
  },
  startDate: '2026-09-01',
  status: 'active' as const,
  subjectId: null,
  title: 'Revisar presupuesto',
  updatedAt: '2026-09-01T12:00:00.000Z',
}

describe('RecurringTaskForm', () => {
  it('submits a monthly task with its duration', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <RecurringTaskForm
        isLoading={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        personalGroups={[]}
        subjects={[]}
      />,
    )

    await user.type(screen.getByLabelText(/^Título/), 'Revisar presupuesto')
    await user.selectOptions(screen.getByLabelText('Frecuencia'), 'monthly')
    await user.clear(screen.getByLabelText('Día del mes'))
    await user.type(screen.getByLabelText('Día del mes'), '15')
    await user.type(screen.getByLabelText(/Duración opcional/), '30')
    await user.click(screen.getByRole('button', { name: 'Guardar tarea' }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMinutes: 30,
        schedule: expect.objectContaining({
          dayOfMonth: 15,
          unit: 'month',
        }),
        title: 'Revisar presupuesto',
      }),
    )
  })

  it('submits a future rule without submitting task metadata', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onSubmitFuture = vi.fn().mockResolvedValue(undefined)

    render(
      <RecurringTaskForm
        isLoading={false}
        mode="future"
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        onSubmitFuture={onSubmitFuture}
        personalGroups={[]}
        subjects={[]}
        task={existingTask}
      />,
    )

    await user.selectOptions(screen.getByLabelText('Frecuencia'), 'weekly')
    await user.click(screen.getByRole('button', { name: 'Guardar regla futura' }))

    await vi.waitFor(() => expect(onSubmitFuture).toHaveBeenCalledOnce())
    expect(onSubmitFuture).toHaveBeenCalledWith(
      expect.objectContaining({
        recurringTaskId: existingTask.id,
        schedule: expect.objectContaining({ unit: 'week', weekdays: [1] }),
      }),
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
