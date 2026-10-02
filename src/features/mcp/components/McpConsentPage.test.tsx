import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { McpConsentPage } from './McpConsentPage.tsx'

const mocks = vi.hoisted(() => ({
  getCurrentAccessToken: vi.fn(() => 'access-token'),
}))

vi.mock('../../../lib/insforge/client.ts', () => mocks)

const requestId = '11111111-1111-4111-8111-111111111111'
const consentRequest = {
  client_name: 'Codex',
  expires_at: '2026-10-02T20:00:00.000Z',
  redirect_host: '127.0.0.1',
  request_id: requestId,
  requested_scopes: [
    'profile:read',
    'events:delete',
    'catalogs:write',
    'unknown:scope',
  ],
}

describe('McpConsentPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_KARENDA_MCP_URL', 'https://mcp.example/karenda-mcp')
    mocks.getCurrentAccessToken.mockReturnValue('access-token')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => consentRequest,
        ok: true,
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('selects and clears every visible requested permission without approving the grant', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={[`/mcp/consent?request_id=${requestId}`]}>
        <McpConsentPage />
      </MemoryRouter>,
    )

    expect(
      await screen.findByText('1 de 3 permisos seleccionados.'),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(screen.getByRole('checkbox', { name: /Contexto de cuenta/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Eliminar eventos/ })).not.toBeChecked()

    await user.click(
      screen.getByRole('button', { name: 'Seleccionar todos los permisos' }),
    )

    expect(screen.getByText('3 de 3 permisos seleccionados.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Eliminar eventos/ })).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: /Modificar asignaturas y grupos/ }),
    ).toBeChecked()
    expect(
      screen.getByRole('button', { name: 'Quitar selección de todos los permisos' }),
    ).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)

    await user.click(
      screen.getByRole('button', { name: 'Quitar selección de todos los permisos' }),
    )

    expect(screen.getByText('0 de 3 permisos seleccionados.')).toBeInTheDocument()
    expect(
      screen
        .getAllByRole('checkbox')
        .every((checkbox) => !(checkbox as HTMLInputElement).checked),
    ).toBe(true)
    expect(screen.getByRole('button', { name: 'Autorizar Karenda' })).toBeDisabled()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
