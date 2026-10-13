import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../../../stores/authStore'
import { DocumentViewer } from './DocumentViewer'

// react-pdf/pdfjs necesitan canvas real (no disponible en jsdom) — se mockea el módulo
// completo, igual que se haría con cualquier librería de terceros con efectos de canvas/DOM
// pesados: estos tests verifican CÓMO DocumentViewer usa react-pdf (props pasadas, botones
// condicionados por rol), no el renderizado real de pdf.js.
vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
  Document: ({ children, onLoadSuccess }: { children: React.ReactNode; onLoadSuccess?: (r: { numPages: number }) => void }) => {
    // Simula la carga asíncrona real de react-pdf (onLoadSuccess se dispara DESPUÉS del
    // render, nunca durante) — llamarlo directamente en el cuerpo del mock dispara el aviso de
    // React "Cannot update a component while rendering a different component".
    React.useEffect(() => {
      onLoadSuccess?.({ numPages: 3 })
    }, [onLoadSuccess])
    return <div data-testid="pdf-document">{children}</div>
  },
  Page: ({ pageNumber, renderTextLayer, renderAnnotationLayer }: { pageNumber: number; renderTextLayer: boolean; renderAnnotationLayer: boolean }) => (
    <div
      data-testid="pdf-page"
      data-page-number={pageNumber}
      data-render-text-layer={String(renderTextLayer)}
      data-render-annotation-layer={String(renderAnnotationLayer)}
    />
  ),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}))

const mockBlob = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' })
const getDocumentVisorBlobMock = vi.fn()

vi.mock('../../../api/endpoints/documents.api', () => ({
  getDocumentVisorBlob: (id: string) => getDocumentVisorBlobMock(id),
}))

function renderViewer(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <DocumentViewer documentoId="doc-001" />
      </QueryClientProvider>,
    ),
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
})

describe('DocumentViewer', () => {
  it('muestra el spinner de carga mientras se obtiene el PDF', () => {
    getDocumentVisorBlobMock.mockReturnValue(new Promise(() => {})) // nunca resuelve
    renderViewer()

    expect(screen.getByText('visor.generandoVistaPrevia')).toBeInTheDocument()
  })

  it('renderiza la página con renderTextLayer y renderAnnotationLayer en false', async () => {
    getDocumentVisorBlobMock.mockResolvedValue(mockBlob)
    renderViewer()

    await waitFor(() => expect(screen.getByTestId('pdf-page')).toBeInTheDocument())
    const page = screen.getByTestId('pdf-page')
    expect(page).toHaveAttribute('data-render-text-layer', 'false')
    expect(page).toHaveAttribute('data-render-annotation-layer', 'false')
  })

  it('no renderiza ningún botón de descarga', async () => {
    getDocumentVisorBlobMock.mockResolvedValue(mockBlob)
    renderViewer()

    await waitFor(() => expect(screen.getByTestId('pdf-document')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /descargar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument()
  })

  it('el botón de imprimir aparece solo para JEFE_CONTROL_DOCUMENTARIO', async () => {
    getDocumentVisorBlobMock.mockResolvedValue(mockBlob)
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'u1', rol: 'JEFE_CONTROL_DOCUMENTARIO' } as never,
    })
    renderViewer()

    await waitFor(() => expect(screen.getByTestId('pdf-document')).toBeInTheDocument())
    expect(screen.getByText('visor.imprimir')).toBeInTheDocument()
  })

  it('el botón de imprimir aparece solo para ALTA_DIRECCION', async () => {
    getDocumentVisorBlobMock.mockResolvedValue(mockBlob)
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'u2', rol: 'ALTA_DIRECCION' } as never,
    })
    renderViewer()

    await waitFor(() => expect(screen.getByTestId('pdf-document')).toBeInTheDocument())
    expect(screen.getByText('visor.imprimir')).toBeInTheDocument()
  })

  it('el botón de imprimir NO aparece para OPERARIO', async () => {
    getDocumentVisorBlobMock.mockResolvedValue(mockBlob)
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'u3', rol: 'OPERARIO' } as never,
    })
    renderViewer()

    await waitFor(() => expect(screen.getByTestId('pdf-document')).toBeInTheDocument())
    expect(screen.queryByText('visor.imprimir')).not.toBeInTheDocument()
  })

  it('el botón de imprimir NO aparece para JEFE_CALIDAD_SYST', async () => {
    getDocumentVisorBlobMock.mockResolvedValue(mockBlob)
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'u4', rol: 'JEFE_CALIDAD_SYST' } as never,
    })
    renderViewer()

    await waitFor(() => expect(screen.getByTestId('pdf-document')).toBeInTheDocument())
    expect(screen.queryByText('visor.imprimir')).not.toBeInTheDocument()
  })

  it('navega a la página siguiente al hacer clic', async () => {
    getDocumentVisorBlobMock.mockResolvedValue(mockBlob)
    renderViewer()

    await waitFor(() => expect(screen.getByTestId('pdf-page')).toHaveAttribute('data-page-number', '1'))
    const siguiente = screen.getByLabelText('visor.paginaSiguiente')
    siguiente.click()

    await waitFor(() => expect(screen.getByTestId('pdf-page')).toHaveAttribute('data-page-number', '2'))
  })

  it('muestra un estado de error genérico cuando la solicitud falla sin cuerpo de error reconocible', async () => {
    getDocumentVisorBlobMock.mockRejectedValue(new Error('network down'))
    renderViewer()

    await waitFor(() => expect(screen.getByText('visor.errorGenerico')).toBeInTheDocument())
  })

  // fix-log-refresco-inmediato
  it('al cargar exitosamente, invalida documents.detail(id) exactamente una vez y no vuelve a pedir el blob', async () => {
    getDocumentVisorBlobMock.mockResolvedValue(mockBlob)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    renderViewer(queryClient)

    await waitFor(() => expect(screen.getByTestId('pdf-document')).toBeInTheDocument())

    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['documents', 'detail', 'doc-001'] }),
    )
    expect(getDocumentVisorBlobMock).toHaveBeenCalledTimes(1)
  })

  it('si la carga del visor falla, no invalida documents.detail', async () => {
    getDocumentVisorBlobMock.mockRejectedValue(new Error('network down'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    renderViewer(queryClient)

    await waitFor(() => expect(screen.getByText('visor.errorGenerico')).toBeInTheDocument())

    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
