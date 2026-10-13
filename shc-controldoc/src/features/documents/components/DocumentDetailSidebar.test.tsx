// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DocumentDetailSidebar } from './DocumentDetailSidebar'
import type { DocumentActionsAvailability } from '../hooks/useDocumentActionsAvailability'
import type { DocumentActionsController } from '../hooks/useDocumentActionsController'
import type { Documento } from '../../../types/documents.types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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
    version: 'v2.0',
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

const EMPTY_AVAILABILITY: DocumentActionsAvailability = {
  isDeleted: false,
  canRestore: false,
  canVerDocumento: false,
  canDescargarCopia: false,
  faltaAsignacion: false,
  canSendToReview: false,
  canSendToReviewBloqueadoPorAsignacion: false,
  canDelete: false,
  canApproveReview: false,
  canRejectReview: false,
  canCancelReview: false,
  canSign: false,
  canRejectAprobacion: false,
  canStartPeriodic: false,
  canCreateVersion: false,
  canStartNewVersion: false,
  otraVersionEnProceso: undefined,
  hasAnyAction: false,
}

function makeAvailability(overrides: Partial<DocumentActionsAvailability>): DocumentActionsAvailability {
  return { ...EMPTY_AVAILABILITY, ...overrides }
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

function renderSidebar(props: {
  documento: Documento
  availability: DocumentActionsAvailability
  controller: DocumentActionsController
  getName?: (id?: string | null) => string
  getUser?: (id?: string | null) => { nombre: string; apellido: string; avatarUrl?: string } | undefined
  onVerLog?: () => void
}) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentDetailSidebar
        documento={props.documento}
        availability={props.availability}
        controller={props.controller}
        getName={props.getName ?? ((id) => id ?? '')}
        getUser={props.getUser ?? (() => undefined)}
        onVerLog={props.onVerLog ?? vi.fn()}
      />
    </QueryClientProvider>,
  )
}

describe('DocumentDetailSidebar — acciones de lectura', () => {
  it('muestra Ver documento y Descargar copia cuando ambas están disponibles', () => {
    renderSidebar({
      documento: makeDocumento({}),
      availability: makeAvailability({ canVerDocumento: true, canDescargarCopia: true }),
      controller: makeController(),
    })

    expect(screen.getByText('visor.verDocumento')).toBeInTheDocument()
    expect(screen.getByText('actions.descargarCopia')).toBeInTheDocument()
  })

  it('sin ninguna acción de lectura, muestra el texto de "sin acciones"', () => {
    renderSidebar({
      documento: makeDocumento({}),
      availability: makeAvailability({}),
      controller: makeController(),
    })

    expect(screen.getByText('detail.noActionsAvailable')).toBeInTheDocument()
  })

  it('click en Ver documento llama a setShowVisor(true)', () => {
    const controller = makeController()
    renderSidebar({
      documento: makeDocumento({}),
      availability: makeAvailability({ canVerDocumento: true }),
      controller,
    })

    fireEvent.click(screen.getByText('visor.verDocumento'))

    expect(controller.setShowVisor).toHaveBeenCalledWith(true)
  })

  it('no renderiza nada cuando el documento está eliminado', () => {
    const { container } = renderSidebar({
      documento: makeDocumento({ deletedAt: '2026-01-01T00:00:00.000Z' }),
      availability: makeAvailability({ isDeleted: true, canRestore: true }),
      controller: makeController(),
    })

    expect(container.querySelector('aside')).not.toBeInTheDocument()
  })
})

describe('DocumentDetailSidebar — ficha', () => {
  it('muestra versión vigente y "—" cuando nunca se publicó', () => {
    renderSidebar({
      documento: makeDocumento({ version: 'v1.0', estado: 'BORRADOR', auditTrail: [] }),
      availability: makeAvailability({}),
      controller: makeController(),
    })

    expect(screen.getByText('v1.0')).toBeInTheDocument()
    expect(screen.getByText('detail.ficha.sinPublicar')).toBeInTheDocument()
  })

  it('muestra la fecha de publicación derivada de FIRMA_REGISTRADA', () => {
    renderSidebar({
      documento: makeDocumento({
        auditTrail: [
          {
            id: 'a1',
            accion: 'FIRMA_REGISTRADA',
            realizadoPorId: 'user-jefedocs-001',
            realizadoPorNombre: 'Sofía Vargas',
            timestamp: '2026-09-12T10:42:00.000Z',
            generadoPorIA: false,
          },
        ],
      }),
      availability: makeAvailability({}),
      controller: makeController(),
    })

    expect(screen.queryByText('detail.ficha.sinPublicar')).not.toBeInTheDocument()
  })

  it('resumen-info-publicacion: muestra fecha de publicación vía fallback aprobadorId+fechaEmision sin audit trail', () => {
    renderSidebar({
      documento: makeDocumento({
        auditTrail: [],
        aprobadorId: 'user-aprobador-001',
        fechaEmision: '2026-03-01T00:00:00.000Z',
      }),
      availability: makeAvailability({}),
      controller: makeController(),
    })

    expect(screen.queryByText('detail.ficha.sinPublicar')).not.toBeInTheDocument()
  })

  it('muestra "Sin asignar" cuando falta el revisor', () => {
    renderSidebar({
      documento: makeDocumento({ revisorId: undefined, aprobadorId: 'user-aprobador-001' }),
      availability: makeAvailability({}),
      controller: makeController(),
    })

    expect(screen.getAllByText('detail.ficha.sinAsignar').length).toBeGreaterThanOrEqual(1)
  })

  it('con getUser resolviendo, pasa nombre/apellido/avatarUrl a UserAvatar (muestra iniciales sin foto)', () => {
    renderSidebar({
      documento: makeDocumento({ autorId: 'user-autor-001' }),
      availability: makeAvailability({}),
      controller: makeController(),
      getName: (id) => (id === 'user-autor-001' ? 'Carlos Autor' : id ?? ''),
      getUser: (id) => (id === 'user-autor-001' ? { nombre: 'Carlos', apellido: 'Autor' } : undefined),
    })

    expect(screen.getByText('Carlos Autor')).toBeInTheDocument()
    expect(screen.getByText('CA')).toBeInTheDocument()
  })
})

describe('DocumentDetailSidebar — actividad reciente', () => {
  function entry(id: string, accion: string, timestamp: string) {
    return {
      id,
      accion,
      realizadoPorId: 'user-x',
      realizadoPorNombre: 'Pedro Huamán',
      timestamp,
      generadoPorIA: false,
    }
  }

  it('muestra como máximo las 5 entradas más recientes', () => {
    const auditTrail = Array.from({ length: 7 }, (_, i) =>
      entry(`a${i}`, 'VISUALIZACION', `2026-01-0${(i % 9) + 1}T10:00:00.000Z`),
    )
    renderSidebar({
      documento: makeDocumento({ auditTrail }),
      availability: makeAvailability({}),
      controller: makeController(),
    })

    expect(screen.getAllByText(/Pedro Huamán/).length).toBe(5)
  })

  it('"Ver log" invoca el callback onVerLog', () => {
    const onVerLog = vi.fn()
    renderSidebar({
      documento: makeDocumento({ auditTrail: [entry('a1', 'VISUALIZACION', '2026-01-01T10:00:00.000Z')] }),
      availability: makeAvailability({}),
      controller: makeController(),
      onVerLog,
    })

    fireEvent.click(screen.getByText('detail.actividadReciente.verLog'))

    expect(onVerLog).toHaveBeenCalled()
  })

  it('muestra el estado vacío cuando no hay audit trail', () => {
    renderSidebar({
      documento: makeDocumento({ auditTrail: [] }),
      availability: makeAvailability({}),
      controller: makeController(),
    })

    expect(screen.getByText('detail.actividadReciente.vacio')).toBeInTheDocument()
  })
})
