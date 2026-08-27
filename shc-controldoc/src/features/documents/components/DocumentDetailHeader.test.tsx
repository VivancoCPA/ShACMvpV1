import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../../../stores/authStore'
import { DocumentDetailHeader } from './DocumentDetailHeader'
import type { Documento } from '../../../types/documents.types'

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

function makeDocumento(overrides: Partial<Documento>): Documento {
  return {
    id: 'doc-001',
    codigo: 'PRC-CD-001',
    titulo: 'Procedimiento de prueba',
    tipo: 'PRC',
    version: 'v1.0',
    estado: 'PUBLICADO',
    areaId: 'area-007',
    empresaId: 'empresa-001',
    confidencialidad: 'INTERNO',
    autorId: 'user-001',
    archivoOriginalUrl: null,
    archivoOriginalNombre: null,
    archivoOriginalBloqueado: false,
    archivoDistribucionUrl: null,
    qeVinculados: [],
    ncVinculados: [],
    historialVersiones: [],
    auditTrail: [],
    creadoEn: '2026-01-01T08:00:00.000Z',
    actualizadoEn: '2026-01-01T08:00:00.000Z',
    ...overrides,
  }
}

function renderHeader(documento: Documento) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentDetailHeader documento={documento} />
    </QueryClientProvider>,
  )
}

describe('DocumentDetailHeader — banner de QE vinculados', () => {
  it('muestra el número del QE, no el id crudo', () => {
    const documento = makeDocumento({
      qeVinculados: [
        { id: 'qe-2026-003', numero: 'QE-2026-003', tipo: 'ADUANERO', severidad: 'MEDIA', estado: 'PENDIENTE_CIERRE' },
      ],
    })

    renderHeader(documento)

    expect(screen.getByText('detail.banners.qeVinculados:QE-2026-003')).toBeInTheDocument()
  })

  it('lista todos los números cuando hay más de un QE vinculado', () => {
    const documento = makeDocumento({
      qeVinculados: [
        { id: 'qe-2026-002', numero: 'QE-2026-002', tipo: 'CALIDAD', severidad: 'ALTA', estado: 'CERRADO' },
        { id: 'qe-2026-007', numero: 'QE-2026-007', tipo: 'CALIDAD', severidad: 'MEDIA', estado: 'ANALISIS_COMPLETADO' },
      ],
    })

    renderHeader(documento)

    expect(screen.getByText('detail.banners.qeVinculados:QE-2026-002, QE-2026-007')).toBeInTheDocument()
  })

  it('no muestra el banner cuando no hay QE vinculados', () => {
    const documento = makeDocumento({ qeVinculados: [] })

    renderHeader(documento)

    expect(screen.queryByText(/detail\.banners\.qeVinculados/)).not.toBeInTheDocument()
  })
})
