import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { setupServer } from 'msw/node'
import { http, HttpResponse, delay } from 'msw'
import { describe, expect, it, beforeAll, afterEach, afterAll } from 'vitest'
import i18n from '../../../i18n'
import { HeatmapIncidentesWidget } from './HeatmapIncidentesWidget'
import type { Local, Incidente } from '../../incidents/types/incident.types'

const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000
function daysAgo(n: number): string {
  return new Date(NOW - n * DAY).toISOString()
}

const LOCALES_FIXTURE: Local[] = [
  {
    id: 'loc-001',
    nombre: 'Almacén Principal',
    codigo: 'LOC-001',
    activo: true,
    planoPngUrl: '/mock/plano-1.png',
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  },
  {
    id: 'loc-002',
    nombre: 'Patio de Minerales',
    codigo: 'LOC-002',
    activo: true,
    planoPngUrl: '/mock/plano-2.png',
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  },
]

function makeIncidente(overrides: Partial<Incidente> & Pick<Incidente, 'id'>): Incidente {
  return {
    numero: `INC-2026-${overrides.id}`,
    tipo: 'INCIDENTE',
    estado: 'ABIERTO',
    severidad: 'BAJA',
    descripcion: 'Incidente de prueba con descripción suficientemente larga para pasar validaciones.',
    areaId: 'area-001',
    turno: 'DIA',
    fechaEvento: daysAgo(10),
    fechaReporte: daysAgo(10),
    reportadoPorId: 'user-001',
    huboLesionados: false,
    auditTrail: [],
    creadoEn: daysAgo(10),
    actualizadoEn: daysAgo(10),
    localId: 'loc-001',
    zonaId: 'zon-001',
    zonaNombre: 'Zona de Recepción',
    ubicacion: { x: 50, y: 50 },
    ...overrides,
  }
}

let fetchCount = 0
let incidentesActuales: Incidente[] = []

function useFixture(incidentes: Incidente[]) {
  incidentesActuales = incidentes
}

const server = setupServer(
  http.get('/api/locales', async ({ request }) => {
    await delay(0)
    const url = new URL(request.url)
    const activo = url.searchParams.get('activo')
    const result =
      activo !== null
        ? LOCALES_FIXTURE.filter((l) => l.activo === (activo === 'true'))
        : LOCALES_FIXTURE
    return HttpResponse.json({ success: true, data: result })
  }),
  http.get('/api/incidents', async () => {
    fetchCount++
    await delay(0)
    return HttpResponse.json({
      success: true,
      data: {
        items: incidentesActuales,
        pagination: { page: 1, pageSize: 10, totalItems: incidentesActuales.length, totalPages: 1 },
      },
    })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  fetchCount = 0
  incidentesActuales = []
})
afterAll(() => server.close())

function renderWidget() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <HeatmapIncidentesWidget />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

describe('HeatmapIncidentesWidget', () => {
  it('pasa los incidentes filtrados del local por defecto a IncidentMapCanvas (clúster de 6)', async () => {
    useFixture(
      Array.from({ length: 6 }, (_, i) =>
        makeIncidente({ id: `c${i}`, localId: 'loc-001', ubicacion: { x: 50, y: 50 } }),
      ),
    )
    renderWidget()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '6 incidentes' })).toBeInTheDocument(),
    )
  })

  it('cambiar el selector de local no dispara un nuevo fetch de incidentes', async () => {
    useFixture(
      Array.from({ length: 6 }, (_, i) =>
        makeIncidente({ id: `c${i}`, localId: 'loc-001', ubicacion: { x: 50, y: 50 } }),
      ),
    )
    const user = userEvent.setup()
    renderWidget()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '6 incidentes' })).toBeInTheDocument(),
    )
    expect(fetchCount).toBe(1)

    await user.selectOptions(screen.getByLabelText(i18n.t('dashboard:heatmapIncidentes.localSelector.label')), 'loc-002')

    await waitFor(() =>
      expect(screen.getByText(i18n.t('incidents:map.noIncidents'))).toBeInTheDocument(),
    )
    expect(fetchCount).toBe(1)
  })

  it('muestra el estado vacío de IncidentMapCanvas cuando el local seleccionado no tiene incidentes con ubicación', async () => {
    useFixture(
      Array.from({ length: 3 }, (_, i) =>
        makeIncidente({ id: `u${i}`, localId: 'loc-001', ubicacion: { x: 50, y: 50 } }),
      ),
    )
    const user = userEvent.setup()
    renderWidget()

    await waitFor(() => expect(screen.getByLabelText(i18n.t('dashboard:heatmapIncidentes.localSelector.label'))).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText(i18n.t('dashboard:heatmapIncidentes.localSelector.label')), 'loc-002')

    await waitFor(() =>
      expect(screen.getByText(i18n.t('incidents:map.noIncidents'))).toBeInTheDocument(),
    )
  })

  it('cambiar el rango de período filtra los incidentes por fechaEvento', async () => {
    useFixture([
      ...Array.from({ length: 3 }, (_, i) =>
        makeIncidente({ id: `recent${i}`, ubicacion: { x: 10, y: 10 }, fechaEvento: daysAgo(10) }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        makeIncidente({ id: `mid${i}`, ubicacion: { x: 80, y: 80 }, fechaEvento: daysAgo(150) }),
      ),
    ])
    const user = userEvent.setup()
    renderWidget()

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: '3 incidentes' })).toHaveLength(2),
    )

    await user.click(
      screen.getByRole('button', { name: i18n.t('dashboard:heatmapIncidentes.rango.opciones.3') }),
    )

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: '3 incidentes' })).toHaveLength(1),
    )
  })

  it('muestra el badge de incidentes sin ubicación con el conteo correcto', async () => {
    useFixture(
      Array.from({ length: 4 }, (_, i) =>
        makeIncidente({ id: `su${i}`, ubicacion: undefined, fechaEvento: daysAgo(5) }),
      ),
    )
    renderWidget()

    await waitFor(() =>
      expect(
        screen.getByText(i18n.t('dashboard:heatmapIncidentes.sinUbicacion', { count: 4 })),
      ).toBeInTheDocument(),
    )
  })

  it('oculta el badge de incidentes sin ubicación cuando el conteo es 0', async () => {
    useFixture(
      Array.from({ length: 2 }, (_, i) =>
        makeIncidente({ id: `cu${i}`, ubicacion: { x: 30, y: 30 }, fechaEvento: daysAgo(5) }),
      ),
    )
    renderWidget()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '2 incidentes' })).toBeInTheDocument(),
    )
    expect(
      screen.queryByText(i18n.t('dashboard:heatmapIncidentes.sinUbicacion', { count: 0 })),
    ).not.toBeInTheDocument()
  })

  it('onGroupClick es un no-op: hacer clic en un grupo no navega ni abre un panel lateral', async () => {
    useFixture(
      Array.from({ length: 6 }, (_, i) =>
        makeIncidente({ id: `c${i}`, localId: 'loc-001', ubicacion: { x: 50, y: 50 } }),
      ),
    )
    const user = userEvent.setup()
    renderWidget()

    const marker = await screen.findByRole('button', { name: '6 incidentes' })
    await user.click(marker)

    expect(screen.getByRole('button', { name: '6 incidentes' })).toBeInTheDocument()
  })
})
