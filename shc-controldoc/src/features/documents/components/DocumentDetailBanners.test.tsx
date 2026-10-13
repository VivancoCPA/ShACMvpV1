// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { useAuthStore } from '../../../stores/authStore'
import { DocumentDetailBanners } from './DocumentDetailBanners'
import type { AuditTrailEntry, Documento } from '../../../types/documents.types'

// Portado de DocumentDetailHeader.test.tsx (detalle-documento-dos-columnas): los banners
// contextuales se extrajeron de DocumentDetailHeader (ahora sticky) a su propio componente —
// estos casos verifican que ninguna condición de visibilidad cambió al moverlos.

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

function renderBanners(documento: Documento) {
  return render(<DocumentDetailBanners documento={documento} />)
}

describe('DocumentDetailBanners — banner de QE vinculados', () => {
  it('muestra el número del QE, no el id crudo', () => {
    const documento = makeDocumento({
      qeVinculados: [
        { id: 'qe-2026-003', numero: 'QE-2026-003', tipo: 'ADUANERO', severidad: 'MEDIA', estado: 'PENDIENTE_CIERRE' },
      ],
    })

    renderBanners(documento)

    expect(screen.getByText('detail.banners.qeVinculados:QE-2026-003')).toBeInTheDocument()
  })

  it('lista todos los números cuando hay más de un QE vinculado', () => {
    const documento = makeDocumento({
      qeVinculados: [
        { id: 'qe-2026-002', numero: 'QE-2026-002', tipo: 'CALIDAD', severidad: 'ALTA', estado: 'CERRADO' },
        { id: 'qe-2026-007', numero: 'QE-2026-007', tipo: 'CALIDAD', severidad: 'MEDIA', estado: 'ANALISIS_COMPLETADO' },
      ],
    })

    renderBanners(documento)

    expect(screen.getByText('detail.banners.qeVinculados:QE-2026-002, QE-2026-007')).toBeInTheDocument()
  })

  it('no muestra el banner cuando no hay QE vinculados', () => {
    const documento = makeDocumento({ qeVinculados: [] })

    renderBanners(documento)

    expect(screen.queryByText(/detail\.banners\.qeVinculados/)).not.toBeInTheDocument()
  })
})

describe('DocumentDetailBanners — banner de rechazo visible (documentos-rechazo-visible)', () => {
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

    renderBanners(documento)

    expect(screen.getByText(/detail\.banners\.rechazadoEnRevision:/)).toBeInTheDocument()
    expect(screen.getByText(/Carmen Torres/)).toBeInTheDocument()
    expect(screen.getByText(/Falta evidencia fotográfica\./)).toBeInTheDocument()
  })

  it('aparece tras un rechazo en aprobación, con la clave correspondiente', () => {
    const documento = makeDocumento({ estado: 'BORRADOR', auditTrail: [rechazoEnAprobacion] })

    renderBanners(documento)

    expect(screen.getByText(/detail\.banners\.rechazadoEnAprobacion:/)).toBeInTheDocument()
  })

  it('no aparece tras una cancelación de revisión (sin motivo)', () => {
    const documento = makeDocumento({ estado: 'BORRADOR', auditTrail: [revisionCancelada] })

    renderBanners(documento)

    expect(screen.queryByText(/detail\.banners\.rechazadoEn/)).not.toBeInTheDocument()
  })

  it('desaparece después de reenviar a revisión (estado ya no BORRADOR)', () => {
    const documento = makeDocumento({ estado: 'EN_REVISION', auditTrail: [rechazoEnRevision] })

    renderBanners(documento)

    expect(screen.queryByText(/detail\.banners\.rechazadoEn/)).not.toBeInTheDocument()
  })

  it('solo considera la entrada más reciente entre rechazo/cancelación', () => {
    const documento = makeDocumento({
      estado: 'BORRADOR',
      auditTrail: [rechazoEnRevision, revisionCancelada],
    })

    renderBanners(documento)

    expect(screen.queryByText(/detail\.banners\.rechazadoEn/)).not.toBeInTheDocument()
  })

  it('es visible para un rol de solo lectura, sin gating adicional', () => {
    useAuthStore.setState({
      user: {
        id: 'u-1',
        nombre: 'Ana',
        apellido: 'Pérez',
        email: 'a@a.com',
        rol: 'AUDITOR_INTERNO',
        activo: true,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      accessToken: 'token',
      isAuthenticated: true,
    })
    const documento = makeDocumento({ estado: 'BORRADOR', auditTrail: [rechazoEnRevision] })

    renderBanners(documento)

    expect(screen.getByText(/detail\.banners\.rechazadoEnRevision:/)).toBeInTheDocument()
  })
})

describe('DocumentDetailBanners — avisos de revisión periódica (revision-periodica-trazabilidad)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('muestra el aviso ámbar cuando faltan <= 30 días para la revisión (PUBLICADO)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0, 0))

    const documento = makeDocumento({
      estado: 'PUBLICADO',
      fechaRevisionProxima: '2026-09-21T00:00:00.000Z',
    })

    renderBanners(documento)

    expect(screen.getByText(/detail\.banners\.revisionProxima:/)).toBeInTheDocument()
  })

  it('muestra el aviso rojo cuando la revisión ya está vencida (PUBLICADO)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0, 0))

    const documento = makeDocumento({
      estado: 'PUBLICADO',
      fechaRevisionProxima: '2026-08-15T00:00:00.000Z',
    })

    renderBanners(documento)

    expect(screen.getByText(/detail\.banners\.revisionVencida:/)).toBeInTheDocument()
    expect(screen.queryByText(/detail\.banners\.revisionProxima:/)).not.toBeInTheDocument()
  })

  it('no muestra ningún aviso de revisión cuando faltan más de 30 días', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0, 0))

    const documento = makeDocumento({
      estado: 'PUBLICADO',
      fechaRevisionProxima: '2027-01-01T00:00:00.000Z',
    })

    renderBanners(documento)

    expect(screen.queryByText(/detail\.banners\.revisionProxima:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/detail\.banners\.revisionVencida:/)).not.toBeInTheDocument()
  })

  it('muestra el aviso informativo de revisión en curso, con fecha y actor, en EN_REVISION_PERIODICA', () => {
    const inicio: AuditTrailEntry = {
      id: 'audit-rev-1',
      accion: 'REVISION_PERIODICA_INICIADA',
      estadoAnterior: 'PUBLICADO',
      estadoNuevo: 'EN_REVISION_PERIODICA',
      motivo: 'Revisión programada (fecha 25/09/2026)',
      realizadoPorId: 'user-jefedocs-001',
      realizadoPorNombre: 'Juan Mendoza',
      timestamp: '2026-09-20T09:00:00.000Z',
      generadoPorIA: false,
    }
    const documento = makeDocumento({
      estado: 'EN_REVISION_PERIODICA',
      fechaRevisionProxima: '2026-09-25T00:00:00.000Z',
      auditTrail: [inicio],
    })

    renderBanners(documento)

    expect(screen.getByText(/detail\.banners\.revisionEnCurso:/)).toBeInTheDocument()
    expect(screen.getByText(/Juan Mendoza/)).toBeInTheDocument()
  })

  it('ninguno de los 3 avisos aparece fuera de PUBLICADO/EN_REVISION_PERIODICA (p.ej. BORRADOR)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0, 0))

    const inicio: AuditTrailEntry = {
      id: 'audit-rev-2',
      accion: 'REVISION_PERIODICA_INICIADA',
      estadoAnterior: 'PUBLICADO',
      estadoNuevo: 'EN_REVISION_PERIODICA',
      realizadoPorId: 'user-jefedocs-001',
      realizadoPorNombre: 'Juan Mendoza',
      timestamp: '2026-08-20T09:00:00.000Z',
      generadoPorIA: false,
    }
    const documento = makeDocumento({
      estado: 'BORRADOR',
      fechaRevisionProxima: '2026-08-15T00:00:00.000Z',
      auditTrail: [inicio],
    })

    renderBanners(documento)

    expect(screen.queryByText(/detail\.banners\.revisionProxima:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/detail\.banners\.revisionVencida:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/detail\.banners\.revisionEnCurso:/)).not.toBeInTheDocument()
  })
})

describe('DocumentDetailBanners — documento eliminado', () => {
  it('muestra el mensaje de eliminado con fecha y usuario', () => {
    const documento = makeDocumento({
      deletedAt: '2026-03-01T15:30:00.000Z',
      auditTrail: [
        {
          id: 'audit-del-1',
          accion: 'DOCUMENTO_ELIMINADO',
          realizadoPorId: 'user-005',
          realizadoPorNombre: 'Pedro Huamán',
          timestamp: '2026-03-01T15:30:00.000Z',
          generadoPorIA: false,
        },
      ],
    })

    renderBanners(documento)

    expect(screen.getByText(/deleted\.banner\.mensaje:/)).toBeInTheDocument()
    expect(screen.getByText(/Pedro Huamán/)).toBeInTheDocument()
  })

  it('no muestra el mensaje de eliminado cuando el documento no está eliminado', () => {
    const documento = makeDocumento({})

    renderBanners(documento)

    expect(screen.queryByText(/deleted\.banner\.mensaje:/)).not.toBeInTheDocument()
  })
})
