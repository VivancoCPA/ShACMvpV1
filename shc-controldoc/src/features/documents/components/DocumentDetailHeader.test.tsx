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

describe('DocumentDetailHeader — avisos de revisión periódica (revision-periodica-trazabilidad)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('muestra el aviso ámbar cuando faltan <= 30 días para la revisión (PUBLICADO)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0, 0)) // hoy = 1 set 2026

    const documento = makeDocumento({
      estado: 'PUBLICADO',
      fechaRevisionProxima: '2026-09-21T00:00:00.000Z', // 20 días
    })

    renderHeader(documento)

    expect(screen.getByText(/detail\.banners\.revisionProxima:/)).toBeInTheDocument()
  })

  it('muestra el aviso rojo cuando la revisión ya está vencida (PUBLICADO)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0, 0))

    const documento = makeDocumento({
      estado: 'PUBLICADO',
      fechaRevisionProxima: '2026-08-15T00:00:00.000Z', // ya pasó
    })

    renderHeader(documento)

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

    renderHeader(documento)

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

    renderHeader(documento)

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
      fechaRevisionProxima: '2026-08-15T00:00:00.000Z', // vencida, pero el estado no es PUBLICADO
      auditTrail: [inicio],
    })

    renderHeader(documento)

    expect(screen.queryByText(/detail\.banners\.revisionProxima:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/detail\.banners\.revisionVencida:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/detail\.banners\.revisionEnCurso:/)).not.toBeInTheDocument()
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
