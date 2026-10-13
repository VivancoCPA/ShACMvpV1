// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DocumentDetailHeader } from './DocumentDetailHeader'
import type { DocumentActionsAvailability } from '../hooks/useDocumentActionsAvailability'
import type { DocumentActionsController } from '../hooks/useDocumentActionsController'
import type { Documento } from '../../../types/documents.types'

// detalle-documento-dos-columnas: DocumentDetailHeader ya no calcula su propia disponibilidad
// de acciones ni recibe `getName` (la cuadrícula de metadatos se movió a la ficha de la
// sidebar) — availability/controller llegan como props ya resueltos, así que estos tests los
// arman a mano en vez de depender de QueryClientProvider/authStore/MSW.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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
    autorId: 'user-001',
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

function renderHeader(props: {
  documento: Documento
  availability: DocumentActionsAvailability
  controller: DocumentActionsController
}) {
  return render(
    <MemoryRouter>
      <DocumentDetailHeader {...props} />
    </MemoryRouter>,
  )
}

describe('DocumentDetailHeader — layout fijo y sin cuadrícula de metadatos', () => {
  it('el header tiene la clase sticky', () => {
    const { container } = renderHeader({
      documento: makeDocumento({}),
      availability: makeAvailability({}),
      controller: makeController(),
    })

    expect(container.querySelector('header')?.className).toContain('sticky')
  })

  it('no renderiza la cuadrícula de metadatos (Tipo/Área/Autor/Revisor/Aprobador)', () => {
    renderHeader({
      documento: makeDocumento({ revisorId: 'user-002', aprobadorId: 'user-003' }),
      availability: makeAvailability({}),
      controller: makeController(),
    })

    expect(screen.queryByText('user-002')).not.toBeInTheDocument()
    expect(screen.queryByText('user-003')).not.toBeInTheDocument()
  })

  it('muestra breadcrumb, código y título', () => {
    renderHeader({
      documento: makeDocumento({ codigo: 'PRC-CD-013', titulo: 'Control de documentos' }),
      availability: makeAvailability({}),
      controller: makeController(),
    })

    expect(screen.getByText('Control de documentos')).toBeInTheDocument()
    expect(screen.getAllByText('PRC-CD-013').length).toBeGreaterThan(0)
  })
})

describe('DocumentDetailHeader — acciones de gestión (máx. 2 inline + menú ⋯)', () => {
  it('sin ninguna acción disponible, no renderiza botones ni menú', () => {
    renderHeader({
      documento: makeDocumento({}),
      availability: makeAvailability({}),
      controller: makeController(),
    })

    expect(screen.queryByRole('button', { name: /detail\.actions/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('detail.menu.masAcciones')).not.toBeInTheDocument()
  })

  it('con exactamente 2 acciones disponibles, ambas se muestran inline sin menú ⋯', () => {
    renderHeader({
      documento: makeDocumento({ estado: 'PUBLICADO', autorId: 'user-001' }),
      availability: makeAvailability({ canCreateVersion: true, canStartPeriodic: true }),
      controller: makeController(),
    })

    expect(screen.getByText('detail.actions.createNewVersion')).toBeInTheDocument()
    expect(screen.getByText('detail.actions.startPeriodicReview')).toBeInTheDocument()
    expect(screen.queryByLabelText('detail.menu.masAcciones')).not.toBeInTheDocument()
  })

  it('con más de 2 acciones disponibles, las de menor prioridad van al menú ⋯', () => {
    renderHeader({
      documento: makeDocumento({ estado: 'PUBLICADO', autorId: 'user-001' }),
      availability: makeAvailability({
        canCreateVersion: true,
        canStartPeriodic: true,
        canDelete: true,
      }),
      controller: makeController(),
    })

    // Prioridad (D7): nueva versión > iniciar revisión periódica > eliminar — las 2 primeras
    // inline, "eliminar" queda detrás del menú.
    expect(screen.getByText('detail.actions.createNewVersion')).toBeInTheDocument()
    expect(screen.getByText('detail.actions.startPeriodicReview')).toBeInTheDocument()
    expect(screen.queryByText('detail.actions.delete')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('detail.menu.masAcciones'))
    expect(screen.getByText('detail.actions.delete')).toBeInTheDocument()
  })

  it('firmar tiene la mayor prioridad: aparece inline aunque haya otras 2 acciones disponibles', () => {
    renderHeader({
      documento: makeDocumento({ estado: 'EN_APROBACION' }),
      availability: makeAvailability({
        canSign: true,
        canRejectAprobacion: true,
        canCancelReview: true,
      }),
      controller: makeController(),
    })

    expect(screen.getByText('detail.actions.sign')).toBeInTheDocument()
    expect(screen.getByText('detail.actions.reject')).toBeInTheDocument()
    expect(screen.queryByText('detail.actions.cancelReview')).not.toBeInTheDocument()
  })

  it('click en un botón inline llama al setModal correspondiente', () => {
    const controller = makeController()
    renderHeader({
      documento: makeDocumento({ estado: 'EN_APROBACION' }),
      availability: makeAvailability({ canSign: true }),
      controller,
    })

    fireEvent.click(screen.getByText('detail.actions.sign'))

    expect(controller.setModal).toHaveBeenCalledWith('sign')
  })
})

describe('DocumentDetailHeader — documento eliminado', () => {
  it('con canRestore, muestra el botón de restaurar en vez de acciones normales', () => {
    renderHeader({
      documento: makeDocumento({ deletedAt: '2026-01-05T10:00:00.000Z' }),
      availability: makeAvailability({ isDeleted: true, canRestore: true }),
      controller: makeController(),
    })

    expect(screen.getByText('deleted.banner.restaurar')).toBeInTheDocument()
    expect(screen.queryByText('detail.actions.delete')).not.toBeInTheDocument()
  })

  it('sin canRestore, no muestra ningún botón de gestión', () => {
    renderHeader({
      documento: makeDocumento({ deletedAt: '2026-01-05T10:00:00.000Z' }),
      availability: makeAvailability({ isDeleted: true, canRestore: false }),
      controller: makeController(),
    })

    expect(screen.queryByText('deleted.banner.restaurar')).not.toBeInTheDocument()
  })

  it('click en restaurar muestra la confirmación inline', () => {
    const controller = makeController()
    renderHeader({
      documento: makeDocumento({ deletedAt: '2026-01-05T10:00:00.000Z' }),
      availability: makeAvailability({ isDeleted: true, canRestore: true }),
      controller,
    })

    fireEvent.click(screen.getByText('deleted.banner.restaurar'))

    expect(controller.setShowRestoreConfirm).toHaveBeenCalledWith(true)
  })
})
