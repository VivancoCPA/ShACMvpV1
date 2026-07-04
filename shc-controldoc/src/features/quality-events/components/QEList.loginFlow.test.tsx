import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupServer } from 'msw/node'
import { authHandlers } from '../../../mocks/handlers/auth.handlers'
import { qualityEventHandlers } from '../../../mocks/handlers/quality-events.handlers'
import { useAuthStore } from '../../../stores/authStore'
import { loginUser } from '../../auth/api/auth.api'
import { createQualityEvent } from '../api/quality-events.api'
import type { QualityEventCreateInput } from '../schemas/qualityEventCreate.schema'
import { QEList } from './QEList'

// Regression test for M4-S08: resolveQEEditAccess() passed in isolation, but the Editar
// icon never appeared for a SUPERVISOR whose areasAsignadas matched the QE area, because
// the real create flow (POST /api/quality-events) never set fechaHoraReporte/reportadoPorId,
// which silently broke the RN-QE-010 2h-window check (NaN date) downstream. Tests that hand
// -build the user/QE objects never exercise that gap, so this drives the real handlers.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-PE' },
  }),
}))

const server = setupServer(...authHandlers, ...qualityEventHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})
afterAll(() => server.close())

async function loginReal(email: string) {
  const { user, accessToken } = await loginUser({ email, password: 'Shac2025!' })
  useAuthStore.getState().login({ user, accessToken })
  return user
}

function renderList(searchParams: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/quality-events${searchParams}`]}>
        <Routes>
          <Route path="/quality-events" element={<QEList />} />
          <Route path="/quality-events/:id/editar" element={<div data-testid="edit-page">edit-page</div>} />
          <Route path="/quality-events/:id" element={<div data-testid="detail-page">detail-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('QEList — full login-to-icon flow (RN-QE-010)', () => {
  it('supervisor sees Editar for a freshly created QE whose area is in their areasAsignadas', async () => {
    await loginReal('jefe.calidad@shac.pe')

    const created = await createQualityEvent({
      origen: 'O2_NC_DETECTADA',
      tipo: 'CALIDAD',
      severidad: 'MEDIA',
      descripcion: 'QE creado para validar el flujo completo login -> icono editar',
      areaAfectada: 'Galpón B',
      turno: 'DIA',
      // Distinctive far-future date lets the test isolate this QE via fechaDesde without
      // depending on how many fixture QEs exist or which page they land on.
      fechaHoraEvento: '2099-01-01T08:00:00.000Z',
      ncId: 'NC-2026-001',
    } as unknown as QualityEventCreateInput)

    // The real bug: the create handler left these undefined, so ventanaReporteInicialAbierta()
    // computed NaN and the 2h window silently never opened for anyone but the reporter.
    expect(created.fechaHoraReporte).toBeTruthy()
    expect(Number.isNaN(new Date(created.fechaHoraReporte).getTime())).toBe(false)
    expect(created.reportadoPorId).toBeTruthy()

    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
    await loginReal('supervisor@shac.pe')

    renderList('?fechaDesde=2099-01-01')

    await waitFor(() => expect(screen.getByText(created.numero)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'list.actions.editar' })).toBeInTheDocument()
  })

  it('supervisor.almacen (area not in areasAsignadas) still never sees Editar for the same QE', async () => {
    await loginReal('jefe.calidad@shac.pe')

    const created = await createQualityEvent({
      origen: 'O2_NC_DETECTADA',
      tipo: 'CALIDAD',
      severidad: 'MEDIA',
      descripcion: 'QE creado para validar que otro supervisor sin el área asignada no ve el icono',
      areaAfectada: 'Galpón B',
      turno: 'DIA',
      fechaHoraEvento: '2099-01-02T08:00:00.000Z',
      ncId: 'NC-2026-002',
    } as unknown as QualityEventCreateInput)

    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
    await loginReal('supervisor.almacen@shac.pe')

    renderList('?fechaDesde=2099-01-02')

    await waitFor(() => expect(screen.getByText(created.numero)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'list.actions.editar' })).not.toBeInTheDocument()
  })
})
