import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DocumentDetailPage } from './DocumentDetailPage'
import type { Documento, AuditTrailEntry } from '../../../types/documents.types'
import type { UserRole } from '../../../types/auth.types'

// resumen-info-publicacion: contenido de la pestaña Resumen — tarjeta "Documento publicado",
// "Motivo del cambio" y "Vigente desde". Archivo dedicado (en vez de ampliar
// DocumentDetailPage.test.tsx) porque necesita un mock de `t` que sí interpole las claves nuevas
// con sus opciones ({{nombre}}, {{fecha}}, {{version}}) para poder verificar el contenido real.

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      switch (key) {
        case 'detail.sinDescripcion':
          return 'Sin descripción'
        case 'detail.publicado.titulo':
          return 'Documento publicado'
        case 'detail.publicado.firmadoPor':
          return `Firmado por ${options?.nombre} · ${options?.fecha}`
        case 'detail.publicado.obsoletoDesde':
          return `Versión obsoleta desde ${options?.fecha}`
        case 'detail.publicado.copiarHash':
          return 'Copiar hash'
        case 'detail.motivoCambio':
          return `Motivo del cambio (v${options?.version})`
        case 'detail.vigenteDesde':
          return 'Vigente desde'
        case 'visor.verDocumento':
          return 'Ver documento'
        default:
          return key
      }
    },
    i18n: { language: 'es-PE' },
  }),
}))

let mockDocumento: Documento | undefined
let mockUserId = 'user-other'
let mockUserRol: UserRole = 'OPERARIO'

vi.mock('../hooks/useDocumentDetail', () => ({
  useDocumentDetail: () => ({ documento: mockDocumento, isLoading: false, isError: false }),
}))

vi.mock('../hooks/useDocumentVersiones', () => ({
  useDocumentVersiones: () => ({ data: { items: [{ id: 'v1' }] } }),
}))

vi.mock('../../areas/hooks/useAreas', () => ({
  useArea: () => ({ data: { nombre: 'Calidad' } }),
}))

vi.mock('../../users/hooks/useUserNames', () => ({
  useUserNames: () => ({
    getName: (id?: string | null) => (id === 'user-jefedocs-001' ? 'Sofía Vargas' : id ?? ''),
    getUser: () => undefined,
  }),
}))

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { id: string; rol: UserRole } | null }) => unknown) =>
    sel({ user: { id: mockUserId, rol: mockUserRol } }),
}))

const noopMutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }

vi.mock('../hooks/useDocumentActions', () => ({
  useChangeStatus: () => noopMutation,
  useDeleteDocument: () => noopMutation,
  useRestaurarDocumento: () => noopMutation,
  useExportarPdfControlado: () => ({ exportar: vi.fn(), isLoading: false }),
  useGetArchivoOriginalUrl: () => ({ abrirArchivoOriginal: vi.fn(), isLoading: false }),
  useVincularQE: () => noopMutation,
  useDesvincularQE: () => noopMutation,
  useVincularNC: () => noopMutation,
  useDesvincularNC: () => noopMutation,
}))

function firma(overrides: Partial<AuditTrailEntry> = {}): AuditTrailEntry {
  return {
    id: 'audit-firma',
    accion: 'FIRMA_REGISTRADA',
    realizadoPorId: 'user-jefedocs-001',
    realizadoPorNombre: 'Sofía Vargas',
    timestamp: '2026-01-15T08:00:00.000Z',
    valorNuevo: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    generadoPorIA: false,
    ...overrides,
  }
}

function makeDocumento(overrides: Partial<Documento> = {}): Documento {
  return {
    id: 'doc-001',
    codigo: 'PRC-CD-013',
    titulo: 'Control de documentos',
    tipo: 'PRC',
    version: 'v2.0',
    estado: 'PUBLICADO',
    areaId: 'area-007',
    empresaId: 'empresa-001',
    confidencialidad: 'PUBLICO',
    autorId: 'user-autor-001',
    archivoOriginalUrl: null,
    archivoOriginalNombre: null,
    archivoOriginalBloqueado: false,
    archivoDistribucionUrl: null,
    qeVinculados: [],
    ncVinculados: [],
    auditTrail: [],
    creadoEn: '2026-01-01T08:00:00.000Z',
    actualizadoEn: '2026-01-01T08:00:00.000Z',
    ...overrides,
  }
}

function renderPage(initialEntry = '/documentos/doc-001') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/documentos/:id" element={<DocumentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('DocumentDetailPage — pestaña Resumen: tarjeta Documento publicado', () => {
  afterEach(() => {
    mockUserId = 'user-other'
    mockUserRol = 'OPERARIO'
  })

  it('PUBLICADO con FIRMA_REGISTRADA: muestra firmante, fecha/hora, hash abreviado y botón Ver', () => {
    mockDocumento = makeDocumento({ estado: 'PUBLICADO', auditTrail: [firma()] })
    renderPage()

    expect(screen.getByText('Documento publicado')).toBeInTheDocument()
    expect(screen.getByText(/Firmado por Sofía Vargas/)).toBeInTheDocument()
    expect(screen.getByText('a1b2…a1b2')).toBeInTheDocument()
    expect(screen.getByTitle('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2')).toBeInTheDocument()
    // "Ver documento" aparece tanto en la sidebar como en la tarjeta nueva — misma acción, dos lugares.
    expect(screen.getAllByText('Ver documento').length).toBeGreaterThanOrEqual(2)
  })

  it('PUBLICADO sin FIRMA_REGISTRADA pero con aprobadorId+fechaEmision: usa el fallback, sin hash', () => {
    mockDocumento = makeDocumento({
      estado: 'PUBLICADO',
      auditTrail: [],
      aprobadorId: 'user-jefedocs-001',
      fechaEmision: '2026-02-01T00:00:00.000Z',
    })
    expect(() => renderPage()).not.toThrow()

    expect(screen.getByText('Documento publicado')).toBeInTheDocument()
    expect(screen.getByText(/Firmado por Sofía Vargas/)).toBeInTheDocument()
    expect(screen.queryByText('Copiar hash')).not.toBeInTheDocument()
  })

  it('OBSOLETO: incluye la línea "Versión obsoleta desde"', () => {
    mockUserRol = 'JEFE_CONTROL_DOCUMENTARIO'
    mockDocumento = makeDocumento({
      estado: 'OBSOLETO',
      fechaObsolescencia: '2026-03-01T00:00:00.000Z',
      auditTrail: [firma()],
    })
    renderPage()

    expect(screen.getByText(/Versión obsoleta desde/)).toBeInTheDocument()
  })

  it('BORRADOR, EN_REVISION, EN_APROBACION: no muestra la tarjeta de publicado ni Vigente desde', () => {
    for (const estado of ['BORRADOR', 'EN_REVISION', 'EN_APROBACION'] as const) {
      mockDocumento = makeDocumento({ estado, auditTrail: [firma()], fechaVigencia: '2026-01-01T00:00:00.000Z' })
      const { unmount } = renderPage()

      expect(screen.queryByText('Documento publicado')).not.toBeInTheDocument()
      expect(screen.queryByText('Vigente desde')).not.toBeInTheDocument()
      unmount()
    }
  })
})

describe('DocumentDetailPage — pestaña Resumen: motivo del cambio y vigente desde', () => {
  afterEach(() => {
    mockUserId = 'user-other'
    mockUserRol = 'OPERARIO'
  })

  it('muestra "Motivo del cambio" cuando motivoVersion está presente', () => {
    mockDocumento = makeDocumento({ estado: 'PUBLICADO', version: 'v2.0', motivoVersion: 'Cambio de alcance.' })
    renderPage()

    expect(screen.getByText('Motivo del cambio (vv2.0)')).toBeInTheDocument()
    expect(screen.getByText('Cambio de alcance.')).toBeInTheDocument()
  })

  it('no muestra "Motivo del cambio" cuando motivoVersion no está presente', () => {
    mockDocumento = makeDocumento({ estado: 'PUBLICADO', motivoVersion: undefined })
    renderPage()

    expect(screen.queryByText(/Motivo del cambio/)).not.toBeInTheDocument()
  })

  it('muestra "Vigente desde" en PUBLICADO con fechaVigencia', () => {
    mockDocumento = makeDocumento({ estado: 'PUBLICADO', fechaVigencia: '2026-01-15T08:00:00.000Z' })
    renderPage()

    expect(screen.getByText('Vigente desde')).toBeInTheDocument()
  })

  it('no muestra "Vigente desde" en OBSOLETO aunque fechaVigencia exista', () => {
    mockUserRol = 'JEFE_CONTROL_DOCUMENTARIO'
    mockDocumento = makeDocumento({ estado: 'OBSOLETO', fechaVigencia: '2026-01-15T08:00:00.000Z' })
    renderPage()

    expect(screen.queryByText('Vigente desde')).not.toBeInTheDocument()
  })

  it('muestra "Sin descripción" en muted cuando no hay descripcion', () => {
    mockDocumento = makeDocumento({ descripcion: undefined })
    renderPage()

    expect(screen.getByText('Sin descripción')).toBeInTheDocument()
  })
})
