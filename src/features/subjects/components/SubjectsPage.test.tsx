import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCatalogStore } from '../../../stores/catalogStore.ts'
import { SubjectsPage } from './SubjectsPage.tsx'

const canvasServiceMock = vi.hoisted(() => ({
  listCanvasCourseLinks: vi.fn(),
  unlinkCanvasCourse: vi.fn(),
}))

vi.mock('../../../services/canvasService.ts', () => canvasServiceMock)

const subject = {
  abbreviation: 'ALG',
  code: 'MAT-101',
  color: '#2F625A',
  createdAt: '2026-09-01T10:00:00.000Z',
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Algoritmos',
  ownerId: '22222222-2222-4222-8222-222222222222',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

const courseLink = {
  canvasCode: 'MAT-101',
  canvasCourseId: '105794',
  canvasName: 'Diseño y Análisis de Algoritmos',
  canvasTermName: '2026-2',
  id: '66666666-6666-4666-8666-666666666666',
  subjectId: subject.id,
}

describe('SubjectsPage', () => {
  beforeEach(() => {
    useCatalogStore.getState().reset()
    useCatalogStore.setState({
      error: null,
      isLoaded: true,
      isLoading: false,
      isSaving: false,
      load: vi.fn().mockResolvedValue(undefined),
      subjects: [subject],
    })
    vi.resetAllMocks()
    canvasServiceMock.listCanvasCourseLinks.mockResolvedValue([courseLink])
    canvasServiceMock.unlinkCanvasCourse.mockResolvedValue(undefined)
  })

  it('shows linked Canvas courses and lets the user unlink them from edit', async () => {
    const user = userEvent.setup()

    render(<SubjectsPage />)

    expect(await screen.findByText(/Canvas vinculado:/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await user.click(screen.getByRole('button', { name: 'Desvincular' }))
    await user.click(screen.getByRole('button', { name: 'Desvincular curso' }))

    expect(canvasServiceMock.unlinkCanvasCourse).toHaveBeenCalledWith(courseLink.id)
    expect(await screen.findByText(/Los eventos históricos se conservaron/)).toBeVisible()
  })
})
