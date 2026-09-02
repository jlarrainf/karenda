import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { NoteDraft } from '../../../stores/noteStore.ts'
import { NoteEditor } from './NoteEditor.tsx'

const target = {
  targetId: '11111111-1111-4111-8111-111111111111',
  targetType: 'subject' as const,
}

function TestEditor({ onSave }: { onSave: () => Promise<void> }) {
  const [draft, setDraft] = useState<NoteDraft>({ contentMarkdown: '', title: '' })

  return (
    <NoteEditor
      draft={draft}
      error={null}
      isEditing={false}
      onCancel={vi.fn()}
      onChange={(field, value) =>
        setDraft((current) => ({ ...current, [field]: value }))
      }
      onSave={onSave}
      saveStatus="idle"
      target={target}
      targetLabel="Álgebra (MAT-101)"
    />
  )
}

describe('NoteEditor', () => {
  it('validates required fields before saving', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(<TestEditor onSave={onSave} />)

    await user.click(screen.getByRole('button', { name: 'Guardar nota' }))

    expect(
      await screen.findByText('El título de la nota es obligatorio.'),
    ).toBeVisible()
    expect(
      await screen.findByText('El contenido de la nota es obligatorio.'),
    ).toBeVisible()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('supports Markdown preview and saves a valid draft', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(<TestEditor onSave={onSave} />)

    await user.type(screen.getByLabelText(/^Título/), 'Apunte de Álgebra')
    await user.type(screen.getByLabelText(/^Contenido Markdown/), '**Derivadas**')
    await user.click(screen.getByRole('button', { name: 'Vista previa' }))

    expect(screen.getByRole('heading', { name: 'Apunte de Álgebra' })).toBeVisible()
    expect(screen.getByText('Derivadas')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Guardar nota' }))

    expect(onSave).toHaveBeenCalledOnce()
  })
})
