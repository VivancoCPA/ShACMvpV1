import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useExportarPdfControlado } from './useDocumentActions'
import { useAuthStore } from '../../../stores/authStore'
import type { Documento } from '../../../types/documents.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const apiPostMock = vi.fn()
vi.mock('../../../lib/axios', () => ({
  default: {
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}))

// jsdom no implementa createObjectURL/revokeObjectURL — el hook los llama al disparar la
// descarga, sin relación con lo que este test verifica (la invalidación).
URL.createObjectURL = vi.fn(() => 'blob:mock-url')
URL.revokeObjectURL = vi.fn()

function makeDocumento(overrides: Partial<Documento> = {}): Documento {
  return {
    id: 'doc-001',
    codigo: 'PRC-CD-001',
    titulo: 'Procedimiento de prueba',
    tipo: 'PRC',
    version: 'v1.0',
    estado: 'PUBLICADO',
    areaId: 'Calidad',
    empresaId: 'empresa-001',
    confidencialidad: 'INTERNO',
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

afterEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})

// fix-log-refresco-inmediato: sin esta invalidación, el audit trail del detalle no muestra la
// entrada DESCARGA hasta recargar la página (refetchOnWindowFocus está apagado globalmente).
describe('useExportarPdfControlado — invalidación del detalle tras descargar', () => {
  it('invalida documents.detail(id) en onSuccess', async () => {
    useAuthStore.setState({ user: { id: 'user-001', nombre: 'Ana', apellido: 'Pérez' } as never })
    const blob = new Blob(['pdf'], { type: 'application/pdf' })
    apiPostMock.mockResolvedValueOnce({ data: blob, headers: {} })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useExportarPdfControlado(), {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    })

    await act(async () => {
      await result.current.exportar(makeDocumento())
    })

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['documents', 'detail', 'doc-001'] }),
      ),
    )
  })

  it('no invalida nada si la exportación falla', async () => {
    useAuthStore.setState({ user: { id: 'user-001', nombre: 'Ana', apellido: 'Pérez' } as never })
    apiPostMock.mockRejectedValueOnce(new Error('network error'))

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useExportarPdfControlado(), {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    })

    await act(async () => {
      await result.current.exportar(makeDocumento())
    })

    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
