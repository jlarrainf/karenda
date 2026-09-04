import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SubjectForm } from './SubjectForm.tsx'

describe('SubjectForm', () => {
  it('shows required validation messages without submitting', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <SubjectForm
        isLoading={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        subject={null}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Guardar asignatura' }))

    expect(
      await screen.findByText('El nombre de la asignatura es obligatorio.'),
    ).toBeVisible()
    expect(screen.getByText('La sigla de la asignatura es obligatoria.')).toBeVisible()
    expect(
      screen.getByText('La abreviación de la asignatura es obligatoria.'),
    ).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a valid subject and supports cancelling', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <SubjectForm
        isLoading={false}
        onCancel={onCancel}
        onSubmit={onSubmit}
        subject={null}
      />,
    )

    await user.type(screen.getByLabelText(/^Nombre/), 'Álgebra')
    await user.type(screen.getByLabelText(/^Sigla/), 'MAT-101')
    await user.type(screen.getByLabelText(/^Abreviación/), 'ALG')
    await user.click(screen.getByRole('button', { name: 'Guardar asignatura' }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledWith({
      abbreviation: 'ALG',
      code: 'MAT-101',
      color: '#2F625A',
      name: 'Álgebra',
    })

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows Canvas links while editing and exposes unlink action', async () => {
    const user = userEvent.setup()
    const onUnlinkCanvasCourse = vi.fn()
    const courseLink = {
      canvasCode: 'MAT-101',
      canvasCourseId: '105794',
      canvasName: 'Diseño y Análisis de Algoritmos',
      canvasTermName: '2026-2',
      id: '66666666-6666-4666-8666-666666666666',
      subjectId: '11111111-1111-4111-8111-111111111111',
    }

    render(
      <SubjectForm
        canvasLinks={[courseLink]}
        isLoading={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onUnlinkCanvasCourse={onUnlinkCanvasCourse}
        subject={{
          abbreviation: 'ALG',
          code: 'MAT-101',
          color: '#2F625A',
          createdAt: '2026-09-01T10:00:00.000Z',
          id: courseLink.subjectId,
          name: 'Algoritmos',
          ownerId: '22222222-2222-4222-8222-222222222222',
          updatedAt: '2026-09-01T10:00:00.000Z',
        }}
      />,
    )

    expect(screen.getByText('Diseño y Análisis de Algoritmos')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Desvincular' }))

    expect(onUnlinkCanvasCourse).toHaveBeenCalledWith(courseLink)
  })
})
