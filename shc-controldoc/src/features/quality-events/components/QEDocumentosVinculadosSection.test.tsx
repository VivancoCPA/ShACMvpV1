import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../../../stores/authStore'
import { QEDocumentosVinculadosSection } from './QEDocumentosVinculadosSection'
import type { QualityEvent } from '../types/qualityEvent.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join('|')}` : key,
    i18n: { language: 'es-PE' },
  }),
}))

afterEach(() => {
  cleanup()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})

function makeQe(overrides: Partial<QualityEvent>): QualityEvent {
  return {
    id: 'qe-2026-001',
    numero: 'QE-2026-001',
    origen: 'O4_REPORTE_EXTERNO',
    tipo: 'CALIDAD',
    severidad: 'MEDIA',
    estado: 'EN_EJECUCION',
    ciclo: 1,
    descripcion: 'Descripción de prueba',
    areaId: 'area-001',
    empresaId: 'empresa-001',
    turno: 'DIA',
    fechaHoraEvento: '2026-01-01T08:00:00.000Z',
    fechaHoraReporte: '2026-01-01T08:00:00.000Z',
    reportadoPorId: 'user-001',
    documentosVinculados: [],
    requiereEvaluacionRiesgos: false,
    solicitudesAC: 0,
    accionesCorrectivas: [],
    auditTrail: [],
    creadoEn: '2026-01-01T08:00:00.000Z',
    actualizadoEn: '2026-01-01T08:00:00.000Z',
    ...overrides,
  }
}

function renderSection(qe: QualityEvent) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <QEDocumentosVinculadosSection qe={qe} />
    </QueryClientProvider>,
  )
}

describe('QEDocumentosVinculadosSection', () => {
  it('muestra el estado vacío cuando no hay documentos vinculados', () => {
    renderSection(makeQe({}))
    expect(screen.getByText('documentosVinculados.vacio')).toBeInTheDocument()
  })

  it('lista los documentos vinculados con su código y título', () => {
    const qe = makeQe({
      documentosVinculados: [{ id: 'doc-001', codigo: 'POL-CD-001', titulo: 'Política de Calidad', estado: 'PUBLICADO' }],
    })
    renderSection(qe)
    expect(screen.getByText('POL-CD-001')).toBeInTheDocument()
    expect(screen.getByText('Política de Calidad')).toBeInTheDocument()
  })

  it('oculta el combobox de agregar para un rol sin permiso', () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-999', rol: 'OPERARIO' } as never })
    renderSection(makeQe({ estado: 'EN_EJECUCION' }))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('muestra el combobox de agregar para JEFE_CALIDAD_SYST en estado activo', () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-999', rol: 'JEFE_CALIDAD_SYST' } as never })
    renderSection(makeQe({ estado: 'EN_EJECUCION' }))
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('oculta el combobox cuando el QE está CERRADO, incluso para JEFE_CALIDAD_SYST', () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-999', rol: 'JEFE_CALIDAD_SYST' } as never })
    renderSection(makeQe({ estado: 'CERRADO' }))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('oculta el combobox cuando readOnly es true', () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user-999', rol: 'JEFE_CALIDAD_SYST' } as never })
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <QEDocumentosVinculadosSection qe={makeQe({ estado: 'EN_EJECUCION' })} readOnly />
      </QueryClientProvider>,
    )
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
