import { describe, it, expect } from 'vitest'
import { getDatosPublicacion } from './publicacion'
import type { AuditTrailEntry, Documento } from '../../../types/documents.types'

function makeDocumento(overrides: Partial<Documento>): Documento {
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

const firma: AuditTrailEntry = {
  id: 'audit-firma',
  accion: 'FIRMA_REGISTRADA',
  realizadoPorId: 'user-003',
  realizadoPorNombre: 'Sofía Vargas',
  timestamp: '2026-01-10T08:00:00.000Z',
  valorNuevo: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  generadoPorIA: false,
}

const firmaAnterior: AuditTrailEntry = {
  id: 'audit-firma-anterior',
  accion: 'FIRMA_REGISTRADA',
  realizadoPorId: 'user-002',
  realizadoPorNombre: 'Carlos Autor',
  timestamp: '2025-06-01T08:00:00.000Z',
  valorNuevo: 'hash-viejo',
  generadoPorIA: false,
}

const estadoPublicado: AuditTrailEntry = {
  id: 'audit-estado',
  accion: 'ESTADO_CAMBIADO',
  estadoAnterior: 'EN_APROBACION',
  estadoNuevo: 'PUBLICADO',
  realizadoPorId: 'user-004',
  realizadoPorNombre: 'Marta Aprobadora',
  timestamp: '2026-02-01T08:00:00.000Z',
  generadoPorIA: false,
}

describe('getDatosPublicacion', () => {
  it('resuelve desde la entrada FIRMA_REGISTRADA más reciente, con hash', () => {
    const documento = makeDocumento({ auditTrail: [firmaAnterior, firma] })

    expect(getDatosPublicacion(documento)).toEqual({
      firmadoPorId: 'user-003',
      fecha: '2026-01-10T08:00:00.000Z',
      hash: firma.valorNuevo,
    })
  })

  it('cae a ESTADO_CAMBIADO → PUBLICADO cuando no hay FIRMA_REGISTRADA (sin hash)', () => {
    const documento = makeDocumento({ auditTrail: [estadoPublicado] })

    expect(getDatosPublicacion(documento)).toEqual({
      firmadoPorId: 'user-004',
      fecha: '2026-02-01T08:00:00.000Z',
      hash: undefined,
    })
  })

  it('cae a aprobadorId + fechaEmision cuando no hay ninguna entrada de audit trail relevante', () => {
    const documento = makeDocumento({
      auditTrail: [],
      aprobadorId: 'user-005',
      fechaEmision: '2025-12-01T00:00:00.000Z',
    })

    expect(getDatosPublicacion(documento)).toEqual({
      firmadoPorId: 'user-005',
      fecha: '2025-12-01T00:00:00.000Z',
      hash: undefined,
    })
  })

  it('devuelve undefined cuando ninguna fuente resuelve', () => {
    const documento = makeDocumento({ auditTrail: [], aprobadorId: null, fechaEmision: null })

    expect(getDatosPublicacion(documento)).toBeUndefined()
  })

  it('devuelve undefined cuando solo aprobadorId está presente, sin fechaEmision', () => {
    const documento = makeDocumento({ auditTrail: [], aprobadorId: 'user-005', fechaEmision: null })

    expect(getDatosPublicacion(documento)).toBeUndefined()
  })
})
