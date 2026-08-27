import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../../../stores/authStore'
import { NCDocumentosVinculadosSection } from './NCDocumentosVinculadosSection'
import type { NoConformidad } from '../types/nonconformity.types'

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

function makeNc(overrides: Partial<NoConformidad>): NoConformidad {
  return {
    id: 'nc-001',
    numero: 'NC-CAL-2025-001',
    dominio: 'CALIDAD',
    origen: 'INSPECCION_INTERNA',
    tipo: 'PROCESO',
    severidad: 'MEDIA',
    estado: 'ABIERTA',
    descripcion: 'Descripción de prueba',
    areaId: 'area-001',
    empresaId: 'empresa-001',
    reportadoPorId: 'user-001',
    fechaDeteccion: '2026-01-01T08:00:00.000Z',
    fechaReporte: '2026-01-01T08:00:00.000Z',
    accionesCorrectivas: [],
    documentosVinculados: [],
    adjuntos: [],
    auditTrail: [],
    creadoEn: '2026-01-01T08:00:00.000Z',
    actualizadoEn: '2026-01-01T08:00:00.000Z',
    ...overrides,
  }
}

function renderSection(nc: NoConformidad, canEdit: boolean) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <NCDocumentosVinculadosSection nc={nc} canEdit={canEdit} />
    </QueryClientProvider>,
  )
}

describe('NCDocumentosVinculadosSection', () => {
  it('muestra el estado vacío cuando no hay documentos vinculados', () => {
    renderSection(makeNc({}), true)
    expect(screen.getByText('documentosVinculados.vacio')).toBeInTheDocument()
  })

  it('lista los documentos vinculados con su código y título', () => {
    const nc = makeNc({
      documentosVinculados: [{ id: 'doc-002', codigo: 'PRC-CD-001', titulo: 'Procedimiento de Control de Documentos y Registros', estado: 'PUBLICADO' }],
    })
    renderSection(nc, true)
    expect(screen.getByText('PRC-CD-001')).toBeInTheDocument()
    expect(screen.getByText('Procedimiento de Control de Documentos y Registros')).toBeInTheDocument()
  })

  it('oculta el combobox de agregar cuando canEdit es false', () => {
    renderSection(makeNc({}), false)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('muestra el combobox de agregar cuando canEdit es true', () => {
    renderSection(makeNc({}), true)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
