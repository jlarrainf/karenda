import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NoteTargetNavigation } from './NoteTargetNavigation.tsx'

describe('NoteTargetNavigation', () => {
  it('groups destinations and reports the selected target', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <NoteTargetNavigation
        onSelect={onSelect}
        personalGroups={[{ color: null, id: 'group-1', name: 'Salud' }]}
        subjects={[
          {
            abbreviation: 'ALG',
            code: 'MAT-101',
            color: '#2F625A',
            id: 'subject-1',
            name: 'Álgebra',
          },
        ]}
        target={{ targetId: 'subject-1', targetType: 'subject' }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Asignaturas' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Grupos personales' })).toBeVisible()
    expect(screen.getByRole('button', { name: /Todos los ramos/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /Álgebra/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: /Todos los ramos/ }))

    expect(onSelect).toHaveBeenCalledWith({ targetType: 'all_subjects' })

    await user.click(screen.getByRole('button', { name: 'Salud' }))

    expect(onSelect).toHaveBeenCalledWith({
      targetId: 'group-1',
      targetType: 'personal_group',
    })
  })
})
