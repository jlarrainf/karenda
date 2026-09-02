import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HabitForm } from './HabitForm.tsx'

async function moveToFinalStep(user: ReturnType<typeof userEvent.setup>) {
  for (let step = 1; step < 5; step += 1) {
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
  }
}

describe('HabitForm', () => {
  it('shows Spanish validation and keeps the form on invalid input', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <HabitForm
        isLoading={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        personalGroups={[]}
        subjects={[]}
      />,
    )

    await moveToFinalStep(user)
    await user.click(screen.getByRole('button', { name: 'Guardar hábito' }))

    expect(
      await screen.findByText('El nombre del hábito es obligatorio.'),
    ).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a binary habit using the progressive form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <HabitForm
        isLoading={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        personalGroups={[]}
        subjects={[]}
      />,
    )

    await user.type(screen.getByLabelText(/^Nombre/), 'Leer')
    await moveToFinalStep(user)
    await user.click(screen.getByRole('button', { name: 'Guardar hábito' }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarEnabled: false,
        goalValue: 1,
        name: 'Leer',
        trackingType: 'boolean',
      }),
    )
  })
})
