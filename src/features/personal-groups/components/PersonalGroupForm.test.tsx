import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PersonalGroupForm } from './PersonalGroupForm.tsx'

describe('PersonalGroupForm', () => {
  it('creates a group without a color when the option is disabled', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <PersonalGroupForm
        group={null}
        isLoading={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    await user.type(screen.getByLabelText(/^Nombre/), 'Salud')
    expect(screen.getByLabelText(/^Color/)).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Guardar grupo' }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledWith({ color: null, name: 'Salud' })
  })

  it('reports an empty group name and enables the optional color', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <PersonalGroupForm
        group={null}
        isLoading={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    await user.click(
      screen.getByRole('checkbox', { name: 'Asignar un color a este grupo' }),
    )
    expect(screen.getByLabelText(/^Color/)).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Guardar grupo' }))

    expect(await screen.findByText('El nombre del grupo es obligatorio.')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
