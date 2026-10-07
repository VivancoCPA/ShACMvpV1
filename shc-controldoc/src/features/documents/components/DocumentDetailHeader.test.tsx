import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../../../stores/authStore'
import { DocumentDetailHeader } from './DocumentDetailHeader'
import type { AuditTrailEntry, Documento } from '../../../types/documents.types'

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
    auditTrail: [],
    creadoEn: '2026-01-01T08:00:00.000Z',
    actualizadoEn: '2026-01-01T08:00:00.000Z',
    ...overrides,
  }
}

function renderHeader(documento: Documento, getName: (id?: string | null) => string = (id) => id ?? '') {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentDetailHeader documento={documento} getName={getName} />
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

describe('DocumentDetailHeader — banner de rechazo visible (documentos-rechazo-visible)', () => {
  const rechazoEnRevision: AuditTrailEntry = {
    id: 'audit-rej-1',
    accion: 'RECHAZADO_EN_REVISION',
    estadoAnterior: 'EN_REVISION',
    estadoNuevo: 'BORRADOR',
    motivo: 'Falta evidencia fotográfica.',
    realizadoPorId: 'user-002',
    realizadoPorNombre: 'Carmen Torres',
    timestamp: '2026-02-01T10:00:00.000Z',
    generadoPorIA: false,
  }

  const rechazoEnAprobacion: AuditTrailEntry = {
    id: 'audit-rej-2',
    accion: 'RECHAZADO_EN_APROBACION',
    estadoAnterior: 'EN_APROBACION',
    estadoNuevo: 'BORRADOR',
    motivo: 'Documento incompleto.',
    realizadoPorId: 'user-003',
    realizadoPorNombre: 'Sofía Vargas',
    timestamp: '2026-02-02T10:00:00.000Z',
    generadoPorIA: false,
  }

  const revisionCancelada: AuditTrailEntry = {
    id: 'audit-cancel-1',
    accion: 'REVISION_CANCELADA',
    estadoAnterior: 'EN_REVISION',
    estadoNuevo: 'BORRADOR',
    realizadoPorId: 'user-004',
    realizadoPorNombre: 'Diego Salazar',
    timestamp: '2026-02-03T10:00:00.000Z',
    generadoPorIA: false,
  }

  it('aparece tras un rechazo en revisión, con nombre, fecha y motivo', () => {
    const documento = makeDocumento({ estado: 'BORRADOR', auditTrail: [rechazoEnRevision] })

    renderHeader(documento)

    expect(screen.getByText(/detail\.banners\.rechazadoEnRevision:/)).toBeInTheDocument()
    expect(screen.getByText(/Carmen Torres/)).toBeInTheDocument()
    expect(screen.getByText(/Falta evidencia fotográfica\./)).toBeInTheDocument()
  })

  it('aparece tras un rechazo en aprobación, con la clave correspondiente', () => {
    const documento = makeDocumento({ estado: 'BORRADOR', auditTrail: [rechazoEnAprobacion] })

    renderHeader(documento)

    expect(screen.getByText(/detail\.banners\.rechazadoEnAprobacion:/)).toBeInTheDocument()
  })

  it('no aparece tras una cancelación de revisión (sin motivo)', () => {
    const documento = makeDocumento({ estado: 'BORRADOR', auditTrail: [revisionCancelada] })

    renderHeader(documento)

    expect(screen.queryByText(/detail\.banners\.rechazadoEn/)).not.toBeInTheDocument()
  })

  it('desaparece después de reenviar a revisión (estado ya no BORRADOR)', () => {
    const documento = makeDocumento({ estado: 'EN_REVISION', auditTrail: [rechazoEnRevision] })

    renderHeader(documento)

    expect(screen.queryByText(/detail\.banners\.rechazadoEn/)).not.toBeInTheDocument()
  })

  it('solo considera la entrada más reciente entre rechazo/cancelación', () => {
    // El documento fue rechazado y luego la revisión (del reenvío siguiente) fue cancelada —
    // la entrada más reciente es la cancelación, así que no debe mostrarse el banner de rechazo.
    const documento = makeDocumento({
      estado: 'BORRADOR',
      auditTrail: [rechazoEnRevision, revisionCancelada],
    })

    renderHeader(documento)

    expect(screen.queryByText(/detail\.banners\.rechazadoEn/)).not.toBeInTheDocument()
  })

  it('es visible para un rol de solo lectura, sin gating adicional', () => {
    useAuthStore.setState({
      user: { id: 'u-1', nombre: 'Ana', apellido: 'Pérez', email: 'a@a.com', rol: 'AUDITOR_INTERNO' },
      accessToken: 'token',
      isAuthenticated: true,
    })
    const documento = makeDocumento({ estado: 'BORRADOR', auditTrail: [rechazoEnRevision] })

    renderHeader(documento)

    expect(screen.getByText(/detail\.banners\.rechazadoEnRevision:/)).toBeInTheDocument()
  })
})

describe('DocumentDetailHeader — nombres de autor/revisor/aprobador (nombres-usuarios-reales)', () => {
  it('muestra el nombre resuelto por getName, no el id crudo', () => {
    const documento = makeDocumento({ autorId: 'user-001', revisorId: 'user-002', aprobadorId: 'user-003' })

    renderHeader(documento, (id) =>
      id === 'user-002' ? 'Diego Salazar' : id === 'user-003' ? 'Ana Pérez' : (id ?? ''),
    )

    expect(screen.getByText('Diego Salazar')).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.queryByText('user-002')).not.toBeInTheDocument()
    expect(screen.queryByText('user-003')).not.toBeInTheDocument()
  })

  it('muestra el texto genérico cuando getName no resuelve un id', () => {
    const documento = makeDocumento({ autorId: 'user-conocido', revisorId: 'user-desconocido' })

    renderHeader(documento, (id) => (id === 'user-conocido' ? 'Autor Conocido' : 'common:userNames.noDisponible'))

    expect(screen.getByText('common:userNames.noDisponible')).toBeInTheDocument()
    expect(screen.queryByText('user-desconocido')).not.toBeInTheDocument()
  })
})
