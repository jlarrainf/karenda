import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasPage } from './CanvasPage.tsx'

const mocks = vi.hoisted(() => ({
  applyCanvasReview: vi.fn(),
  connectCanvas: vi.fn(),
  disconnectCanvas: vi.fn(),
  getCanvasConnection: vi.fn(),
  listCandidateEvents: vi.fn(),
  listCanvasCourseLinks: vi.fn(),
  listCanvasReviews: vi.fn(),
  listCanvasSyncRuns: vi.fn(),
  listSubjects: vi.fn(),
  synchronizeCanvas: vi.fn(),
}))

vi.mock('../../../services/canvasService.ts', () => mocks)
vi.mock('../../../services/subjectService.ts', () => ({ listSubjects: mocks.listSubjects }))

const connection = {
  id: '11111111-1111-4111-8111-111111111111',
  canvasBaseUrl: 'https://cursos.canvas.uc.cl',
  authMode: 'personal_access_token' as const,
  status: 'connected' as const,
  timeZone: 'America/Santiago',
  tokenExpiresAt: '2026-11-30T12:00:00.000Z',
  lastSyncAt: '2026-09-04T10:00:00.000Z',
  nextSyncAt: '2026-09-05T09:00:00.000Z',
  lastErrorCode: null,
  lastErrorMessage: null,
}

const review = {
  id: '22222222-2222-4222-8222-222222222222',
  courseLinkId: '33333333-3333-4333-8333-333333333333',
  canvasCourseId: '42',
  canvasItemType: 'assignment',
  canvasItemId: '99',
  reviewKind: 'event_create' as const,
  title: 'Control 2',
  sourceUrl: 'https://cursos.canvas.uc.cl/courses/42/assignments/99',
  sourceExcerpt: 'Materia: capítulos 4 y 5.',
  academicActivityType: 'test' as const,
  proposedData: {
    title: 'Control 2',
    start_at: '2026-09-10T15:00:00.000Z',
    location: 'Sala 12',
  },
  candidateEventIds: ['44444444-4444-4444-8444-444444444444'],
  createdAt: '2026-09-04T12:00:00.000Z',
}

const candidate = {
  id: '44444444-4444-4444-8444-444444444444',
  ownerId: '55555555-5555-4555-8555-555555555555',
  kind: 'academic' as const,
  title: 'Control 2 de Cálculo',
  subjectId: '66666666-6666-4666-8666-666666666666',
  personalGroupId: null,
  startAt: '2026-09-10T15:00:00.000Z',
  endAt: null,
  isAllDay: false,
  status: 'pending' as const,
  location: null,
  description: null,
  academicActivityType: 'test' as const,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
}

describe('CanvasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCanvasConnection.mockResolvedValue(connection)
    mocks.listCanvasCourseLinks.mockResolvedValue([{ id: review.courseLinkId }])
    mocks.listCanvasReviews.mockResolvedValue([review])
    mocks.listCanvasSyncRuns.mockResolvedValue([])
    mocks.listSubjects.mockResolvedValue([])
    mocks.listCandidateEvents.mockResolvedValue([candidate])
    mocks.applyCanvasReview.mockResolvedValue(undefined)
    mocks.synchronizeCanvas.mockResolvedValue({ runId: 'run', status: 'completed', counts: {} })
  })

  it('shows Canvas and Karenda side by side before any creation', async () => {
    render(<CanvasPage />)

    expect(await screen.findByRole('heading', { name: 'Control 2' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Información de Canvas' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Evento de Karenda' })).toBeVisible()
    expect(screen.getByText('Control 2 de Cálculo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vincular con existente' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Crear evento' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /crear todos/i })).not.toBeInTheDocument()
  })

  it('applies an explicit link decision with the confirmed category', async () => {
    const user = userEvent.setup()
    render(<CanvasPage />)
    await screen.findByRole('heading', { name: 'Control 2' })

    await user.click(screen.getByRole('button', { name: 'Vincular con existente' }))

    await waitFor(() => {
      expect(mocks.applyCanvasReview).toHaveBeenCalledWith(
        review.id,
        'link_existing',
        candidate.id,
        expect.objectContaining({ academic_activity_type: 'test' }),
      )
    })
  })
})
