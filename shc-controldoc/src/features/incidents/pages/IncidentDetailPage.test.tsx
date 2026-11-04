import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { IncidentDetailPage } from './IncidentDetailPage'
import type { Incidente, Local } from '../types/incident.types'
import type { UserRole } from '../../../types/auth.types'

afterEach(() => {
  cleanup()
  mockLocales = []
  mockPlanoUrl = null
  mockPlanoLoading = false
  mockIncidentLoading = false
  mockQualityEventNumero = undefined
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-PE' } }),
}))

vi.mock('../components/IncidentACSection', () => ({
  IncidentACSection: () => <div data-testid="incident-ac-section" />,
}))

vi.mock('../components/EscaladoBanner', () => ({
  EscaladoBanner: () => null,
}))

let mockLocales: Local[] = []
let mockPlanoUrl: string | null = null
let mockPlanoLoading = false

vi.mock('../hooks/useLocales', async () => {
  const { useMemo } = await vi.importActual<typeof import('react')>('react')
  return {
    useLocales: () => ({ locales: mockLocales, isLoading: false, isError: false }),
    // proteccion-documental (design.md D7) — el plano ya no es una URL estática. El mock llama un
    // hook real (useMemo) a propósito, igual que el hook real: si la página lo invocara después de
    // un return anticipado, el test de regresión de hooks lo detecta.
    usePlanoBlob: () => {
      const planoUrl = useMemo(() => mockPlanoUrl, [])
      return { planoUrl, isLoading: mockPlanoLoading, isError: false }
    },
  }
})

vi.mock('../../areas/hooks/useAreas', () => ({
  useArea: () => ({ data: undefined }),
}))

let mockIncident: Incidente | undefined
let mockIncidentLoading = false
let mockRole: UserRole | undefined = 'SUPERVISOR'
const navigateMock = vi.fn()

vi.mock('../hooks/useIncidents', () => ({
  useIncident: () => ({ data: mockIncidentLoading ? undefined : mockIncident, isLoading: mockIncidentLoading, isError: false }),
  useDeleteIncident: () => ({ mutate: vi.fn(), isPending: false }),
  // proteccion-documental (design.md D8) — una evidencia ya no es una URL estática.
  useEvidenciaBlob: () => ({ blobUrl: null, isLoading: false, isError: false }),
}))

let mockQualityEventNumero: string | undefined

// incidentes-qe-estado-alertas (D11) — número del QE vinculado. Llama un hook real (useMemo),
// igual que usePlanoBlob arriba, para que el test de regresión de hooks detecte si la página lo
// invocara después de un return anticipado.
vi.mock('../../quality-events/hooks/useQualityEvent', async () => {
  const { useMemo } = await vi.importActual<typeof import('react')>('react')
  return {
    useQualityEvent: (id: string) => {
      const data = useMemo(() => (id && mockQualityEventNumero ? { id, numero: mockQualityEventNumero } : undefined), [id])
      return { data }
    },
  }
})

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { rol: UserRole } | null }) => unknown) =>
    sel({ user: mockRole ? { rol: mockRole } : null }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

function makeIncidente(overrides: Partial<Incidente> = {}): Incidente {
  return {
    id: 'inc-003',
    numero: 'INC-2026-003',
    tipo: 'INCIDENTE',
    estado: 'EN_INVESTIGACION',
    severidad: 'MEDIA',
    descripcion: 'Descripción de prueba para el incidente',
    areaId: 'SyST',
    empresaId: 'empresa-001',
    turno: 'DIA',
    fechaEvento: '2026-01-01T00:00:00Z',
    fechaReporte: '2026-01-01T00:00:00Z',
    reportadoPorId: 'user-1',
    huboLesionados: false,
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/incidents/inc-003']}>
      <Routes>
        <Route path="/incidents/:id" element={<IncidentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('IncidentDetailPage — botón Crear QE', () => {
  it('is visible for SUPERVISOR on an active incident without a linked QE', () => {
    mockIncident = makeIncidente()
    mockRole = 'SUPERVISOR'
    renderPage()
    expect(screen.getByText('detail.actions.crearQE')).toBeInTheDocument()
  })

  it('is absent when the incident already has a linked QE', () => {
    mockIncident = makeIncidente({ qeId: 'qe-2026-005' })
    mockRole = 'SUPERVISOR'
    renderPage()
    expect(screen.queryByText('detail.actions.crearQE')).not.toBeInTheDocument()
  })

  it('is absent for OPERARIO', () => {
    mockIncident = makeIncidente()
    mockRole = 'OPERARIO'
    renderPage()
    expect(screen.queryByText('detail.actions.crearQE')).not.toBeInTheDocument()
  })

  it('navigates with the correct vinculación query params on click', async () => {
    mockIncident = makeIncidente()
    mockRole = 'SUPERVISOR'
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByText('detail.actions.crearQE'))

    expect(navigateMock).toHaveBeenCalledWith(
      '/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO&incidenteId=inc-003&incidenteNumero=INC-2026-003&incidenteArea=SyST',
    )
  })
})

describe('IncidentDetailPage — RN-INC-006 y estado gobernado por el QE (incidentes-qe-estado-alertas)', () => {
  it('sin QE y con el plazo vencido muestra el badge "Sin QE vinculado" junto a "Crear QE"', () => {
    mockIncident = makeIncidente({
      tipo: 'ACCIDENTE',
      estado: 'ABIERTO',
      fechaEvento: new Date(Date.now() - 30 * 3_600_000).toISOString(),
    })
    mockRole = 'SUPERVISOR'
    renderPage()

    const badge = screen.getByText('list.sinQEBadge.label')
    const crearQE = screen.getByText('detail.actions.crearQE')
    expect(badge.parentElement).toBe(crearQE.parentElement)
    expect(screen.queryByText('detail.qeGobiernaEstado')).not.toBeInTheDocument()
  })

  it('sin QE y dentro del plazo no muestra el badge', () => {
    mockIncident = makeIncidente({ tipo: 'ACCIDENTE', estado: 'ABIERTO', fechaEvento: new Date().toISOString() })
    mockRole = 'SUPERVISOR'
    renderPage()

    expect(screen.queryByText('list.sinQEBadge.label')).not.toBeInTheDocument()
  })

  it('con QE vinculado muestra el aviso con enlace al QE y sin badge', () => {
    mockIncident = makeIncidente({ qeId: 'qe-2026-010', fechaEvento: '2026-01-01T00:00:00Z' })
    mockQualityEventNumero = 'QE-2026-010'
    mockRole = 'SUPERVISOR'
    renderPage()

    const aviso = screen.getByText('detail.qeGobiernaEstado')
    expect(aviso.closest('a')).toHaveAttribute('href', '/quality-events/qe-2026-010')
    expect(screen.queryByText('list.sinQEBadge.label')).not.toBeInTheDocument()
  })
})

describe('IncidentDetailPage — caption de evidencia (m7-ajuste-texto-foto-incidencia)', () => {
  it('evidencia con descripcion muestra el texto bajo su thumbnail', () => {
    mockIncident = makeIncidente({
      evidencias: [
        {
          id: 'ev-001',
          url: 'https://example.com/foto.jpg',
          nombre: 'foto.jpg',
          tipo: 'imagen',
          tamanioKb: 120,
          creadoEn: '2026-01-01T00:00:00Z',
          creadoPor: 'user-1',
          descripcion: 'válvula de escape dañada',
        },
      ],
    })
    mockRole = 'SUPERVISOR'
    renderPage()

    expect(screen.getByText('válvula de escape dañada')).toBeInTheDocument()
  })

  it('evidencia sin descripcion no renderiza ningún texto adicional', () => {
    mockIncident = makeIncidente({
      evidencias: [
        {
          id: 'ev-002',
          url: 'https://example.com/foto2.jpg',
          nombre: 'foto2.jpg',
          tipo: 'imagen',
          tamanioKb: 90,
          creadoEn: '2026-01-01T00:00:00Z',
          creadoPor: 'user-1',
        },
      ],
    })
    mockRole = 'SUPERVISOR'
    renderPage()

    const thumbnail = screen.getByLabelText('foto2.jpg')
    expect(thumbnail.parentElement?.querySelector('p')).not.toBeInTheDocument()
  })
})

const GUID_REPORTANTE = '0192a1b2-0000-7000-8000-000000000001'
const GUID_LOCAL = '0192a1b2-0000-7000-8000-000000000002'
const GUID_ZONA = '0192a1b2-0000-7000-8000-000000000003'

function makeLocal(overrides: Partial<Local> = {}): Local {
  return {
    id: GUID_LOCAL,
    nombre: 'Almacén Principal',
    codigo: 'LOC-001',
    activo: true,
    empresaId: 'empresa-001',
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    planoPngUrl: '/api/locales/plano.png',
    ...overrides,
  }
}

describe('IncidentDetailPage — regresión de hooks (fix-incidentes-detalle-nombres-ubicacion)', () => {
  it('pasa de carga a datos sin lanzar "Rendered more hooks"', () => {
    mockRole = 'SUPERVISOR'
    mockLocales = [makeLocal()]
    mockPlanoUrl = 'blob:plano'
    mockIncident = makeIncidente({ localId: GUID_LOCAL, ubicacion: { x: 10, y: 20 } })
    mockIncidentLoading = true
    const { rerender } = renderPage()
    expect(screen.queryByText('INC-2026-003')).not.toBeInTheDocument()

    mockIncidentLoading = false
    expect(() =>
      rerender(
        <MemoryRouter initialEntries={['/incidents/inc-003']}>
          <Routes>
            <Route path="/incidents/:id" element={<IncidentDetailPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    ).not.toThrow()
    expect(screen.getAllByText('INC-2026-003').length).toBeGreaterThan(0)
  })
})

describe('IncidentDetailPage — nombres en lugar de GUIDs', () => {
  it('muestra los nombres de reportante, local y zona', () => {
    mockIncident = makeIncidente({
      reportadoPorId: GUID_REPORTANTE,
      reportadoPorNombre: 'Juan Pérez',
      localId: GUID_LOCAL,
      localNombre: 'Almacén Principal',
      zonaId: GUID_ZONA,
      zonaNombre: 'Zona de Recepción',
    })
    renderPage()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('Almacén Principal')).toBeInTheDocument()
    expect(screen.getByText('Zona de Recepción')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/0192a1b2-/)
  })

  it('sin nombres muestra los fallbacks y nunca el GUID', () => {
    mockIncident = makeIncidente({ reportadoPorId: GUID_REPORTANTE, localId: GUID_LOCAL, zonaId: GUID_ZONA })
    renderPage()
    expect(screen.getByText('detail.fields.usuarioDesconocido')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(document.body.textContent).not.toMatch(/0192a1b2-/)
  })
})

describe('IncidentDetailPage — plano del local', () => {
  it('local con plano y ubicación: plano con el punto', () => {
    mockLocales = [makeLocal()]
    mockPlanoUrl = 'blob:plano'
    mockIncident = makeIncidente({ localId: GUID_LOCAL, localNombre: 'Almacén Principal', ubicacion: { x: 45, y: 30 } })
    renderPage()
    expect(screen.getByAltText('Almacén Principal')).toHaveAttribute('src', 'blob:plano')
    const pin = screen.getByTestId('plano-pin')
    expect(pin).toHaveStyle({ left: '45%', top: '30%' })
    expect(pin).toHaveClass('bg-coral')
    expect(screen.queryByText('detail.ubicacion.sinPunto')).not.toBeInTheDocument()
  })

  it('local con plano y sin ubicación: plano sin punto y aviso', () => {
    mockLocales = [makeLocal()]
    mockPlanoUrl = 'blob:plano'
    mockIncident = makeIncidente({ localId: GUID_LOCAL })
    renderPage()
    expect(screen.getByAltText('detail.fields.local')).toBeInTheDocument()
    expect(screen.queryByTestId('plano-pin')).not.toBeInTheDocument()
    expect(screen.getByText('detail.ubicacion.sinPunto')).toBeInTheDocument()
  })

  it('local sin plano: aviso sin imagen', () => {
    mockLocales = [makeLocal({ planoPngUrl: undefined })]
    mockIncident = makeIncidente({ localId: GUID_LOCAL, ubicacion: { x: 45, y: 30 } })
    renderPage()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('detail.ubicacion.sinPlano')).toBeInTheDocument()
  })

  it('mientras carga el blob muestra un skeleton', () => {
    mockLocales = [makeLocal()]
    mockPlanoLoading = true
    mockIncident = makeIncidente({ localId: GUID_LOCAL })
    renderPage()
    expect(screen.getByTestId('plano-skeleton')).toBeInTheDocument()
    expect(screen.queryByText('detail.ubicacion.sinPlano')).not.toBeInTheDocument()
  })
})
