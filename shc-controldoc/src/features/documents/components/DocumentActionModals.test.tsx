// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DocumentActionModals } from './DocumentActionModals'
import type { DocumentActionsController } from '../hooks/useDocumentActionsController'
import type { Documento } from '../../../types/documents.types'

// Portado de DocumentActionPanel.test.tsx — "preview de PDF muestra el nombre del aprobador"
// (nombres-usuarios-reales): esa lógica ahora vive en DocumentActionModals, montado una sola
// vez por la página y controlado por `showPdfPreview` del controller en vez de un setState
// propio de DocumentActionPanel.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join('|')}` : key,
    i18n: { language: 'es-PE' },
  }),
}))

afterEach(() => {
  cleanup()
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

function makeController(overrides: Partial<DocumentActionsController> = {}): DocumentActionsController {
  const base = {
    modal: 'none',
    setModal: vi.fn(),
    showVisor: false,
    setShowVisor: vi.fn(),
    showPdfPreview: false,
    setShowPdfPreview: vi.fn(),
    showRestoreConfirm: false,
    setShowRestoreConfirm: vi.fn(),
    changeStatus: { isPending: false } as DocumentActionsController['changeStatus'],
    deleteDocument: { isPending: false } as DocumentActionsController['deleteDocument'],
    restaurar: { isPending: false, mutate: vi.fn() } as unknown as DocumentActionsController['restaurar'],
    exportar: vi.fn(),
    isLoadingExportar: false,
    handleConfirm: vi.fn(),
    handleConfirmDelete: vi.fn(),
  }
  return { ...base, ...overrides } as DocumentActionsController
}

function renderModals(props: {
  documento: Documento
  controller: DocumentActionsController
  getName?: (id?: string | null) => string
}) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentActionModals
        documento={props.documento}
        controller={props.controller}
        getName={props.getName ?? ((id) => id ?? '')}
      />
    </QueryClientProvider>,
  )
}

describe('DocumentActionModals — preview de PDF muestra el nombre del aprobador', () => {
  it('muestra el nombre resuelto por getName en "Aprobado por"', () => {
    renderModals({
      documento: makeDocumento({ aprobadorId: 'user-aprobador-001' }),
      controller: makeController({ showPdfPreview: true }),
      getName: (id) => (id === 'user-aprobador-001' ? 'Luis Paredes' : (id ?? '')),
    })

    expect(screen.getByText('Luis Paredes')).toBeInTheDocument()
  })

  it('muestra el texto genérico cuando getName no resuelve al aprobador', () => {
    renderModals({
      documento: makeDocumento({ aprobadorId: 'user-desconocido' }),
      controller: makeController({ showPdfPreview: true }),
      getName: () => 'common:userNames.noDisponible',
    })

    expect(screen.getByText('common:userNames.noDisponible')).toBeInTheDocument()
    expect(screen.queryByText('user-desconocido')).not.toBeInTheDocument()
  })

  it('no se renderiza cuando showPdfPreview es false', () => {
    renderModals({
      documento: makeDocumento({ aprobadorId: 'user-aprobador-001' }),
      controller: makeController({ showPdfPreview: false }),
      getName: () => 'Luis Paredes',
    })

    expect(screen.queryByText('pdf.previewTitle')).not.toBeInTheDocument()
  })
})

describe('DocumentActionModals — confirmaciones inline', () => {
  it('confirm-send pide confirmación y, al confirmar, llama a handleConfirm', async () => {
    const controller = makeController({ modal: 'confirm-send' })
    renderModals({ documento: makeDocumento({}), controller })

    expect(screen.getByText('detail.confirmSendToReview')).toBeInTheDocument()

    fireEvent.click(screen.getByText('detail.confirm'))

    expect(controller.handleConfirm).toHaveBeenCalledWith('EN_REVISION')
  })

  it('confirm-delete llama a handleConfirmDelete al confirmar', () => {
    const controller = makeController({ modal: 'confirm-delete' })
    renderModals({ documento: makeDocumento({}), controller })

    fireEvent.click(screen.getByText('detail.confirm'))

    expect(controller.handleConfirmDelete).toHaveBeenCalled()
  })

  it('cancelar cierra el diálogo (setModal(\'none\'))', () => {
    const controller = makeController({ modal: 'confirm-cancel' })
    renderModals({ documento: makeDocumento({}), controller })

    fireEvent.click(screen.getByText('detail.cancel'))

    expect(controller.setModal).toHaveBeenCalledWith('none')
  })
})

describe('DocumentActionModals — visor', () => {
  it('no se renderiza cuando showVisor es false', () => {
    renderModals({ documento: makeDocumento({}), controller: makeController({ showVisor: false }) })

    expect(screen.queryByText('visor.tituloModal')).not.toBeInTheDocument()
  })
})
