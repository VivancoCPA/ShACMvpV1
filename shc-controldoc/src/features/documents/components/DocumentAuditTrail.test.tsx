import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DocumentAuditTrail } from './DocumentAuditTrail'
import type { AuditTrailEntry, Documento } from '../../../types/documents.types'

afterEach(() => cleanup())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; motivo?: string }) => {
      if (options?.motivo !== undefined) return `Motivo: ${options.motivo}`
      return options?.defaultValue ?? key
    },
    i18n: { language: 'es-PE' },
  }),
}))

function makeDocumento(overrides: Partial<Documento>): Documento {
  return {
    id: 'doc-001',
    codigo: 'PRC-CD-001',
    titulo: 'Procedimiento de prueba',
    tipo: 'PRC',
    version: 'v1.0',
    estado: 'BORRADOR',
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

describe('DocumentAuditTrail — acciones de rechazo (documentos-rechazo-visible)', () => {
  it('muestra la etiqueta y el motivo para RECHAZADO_EN_REVISION', () => {
    const entry: AuditTrailEntry = {
      id: 'audit-1',
      accion: 'RECHAZADO_EN_REVISION',
      estadoAnterior: 'EN_REVISION',
      estadoNuevo: 'BORRADOR',
      motivo: 'Falta evidencia fotográfica.',
      realizadoPorId: 'user-002',
      realizadoPorNombre: 'Carmen Torres',
      timestamp: '2026-02-01T10:00:00.000Z',
      generadoPorIA: false,
    }
    render(<DocumentAuditTrail documento={makeDocumento({ auditTrail: [entry] })} />)

    expect(screen.getByText('RECHAZADO_EN_REVISION')).toBeInTheDocument()
    expect(screen.getByText('Motivo: Falta evidencia fotográfica.')).toBeInTheDocument()
  })

  it('muestra la etiqueta y el motivo para RECHAZADO_EN_APROBACION', () => {
    const entry: AuditTrailEntry = {
      id: 'audit-2',
      accion: 'RECHAZADO_EN_APROBACION',
      estadoAnterior: 'EN_APROBACION',
      estadoNuevo: 'BORRADOR',
      motivo: 'Documento incompleto.',
      realizadoPorId: 'user-003',
      realizadoPorNombre: 'Sofía Vargas',
      timestamp: '2026-02-02T10:00:00.000Z',
      generadoPorIA: false,
    }
    render(<DocumentAuditTrail documento={makeDocumento({ auditTrail: [entry] })} />)

    expect(screen.getByText('RECHAZADO_EN_APROBACION')).toBeInTheDocument()
    expect(screen.getByText('Motivo: Documento incompleto.')).toBeInTheDocument()
  })

  it('muestra la etiqueta de REVISION_CANCELADA sin línea de motivo', () => {
    const entry: AuditTrailEntry = {
      id: 'audit-3',
      accion: 'REVISION_CANCELADA',
      estadoAnterior: 'EN_REVISION',
      estadoNuevo: 'BORRADOR',
      realizadoPorId: 'user-004',
      realizadoPorNombre: 'Diego Salazar',
      timestamp: '2026-02-03T10:00:00.000Z',
      generadoPorIA: false,
    }
    render(<DocumentAuditTrail documento={makeDocumento({ auditTrail: [entry] })} />)

    expect(screen.getByText('REVISION_CANCELADA')).toBeInTheDocument()
    expect(screen.queryByText(/Motivo:/)).not.toBeInTheDocument()
  })
})

describe('DocumentAuditTrail — revisión periódica trazable (revision-periodica-trazabilidad)', () => {
  it('muestra la etiqueta y el motivo para REVISION_PERIODICA_INICIADA, con el actor real', () => {
    const entry: AuditTrailEntry = {
      id: 'audit-rev-ini',
      accion: 'REVISION_PERIODICA_INICIADA',
      estadoAnterior: 'PUBLICADO',
      estadoNuevo: 'EN_REVISION_PERIODICA',
      motivo: 'Revisión programada (fecha 25/09/2026)',
      realizadoPorId: 'user-jefedocs-001',
      realizadoPorNombre: 'Juan Mendoza',
      timestamp: '2026-09-20T09:00:00.000Z',
      generadoPorIA: false,
    }
    render(<DocumentAuditTrail documento={makeDocumento({ auditTrail: [entry] })} />)

    expect(screen.getByText('REVISION_PERIODICA_INICIADA')).toBeInTheDocument()
    expect(screen.getByText('Motivo: Revisión programada (fecha 25/09/2026)')).toBeInTheDocument()
    expect(screen.getByText('Juan Mendoza')).toBeInTheDocument()
  })

  it('muestra la etiqueta y el motivo para REVISION_PERIODICA_VENCIDA, con el actor "Sistema"', () => {
    const entry: AuditTrailEntry = {
      id: 'audit-rev-venc',
      accion: 'REVISION_PERIODICA_VENCIDA',
      motivo: 'Fecha de revisión periódica alcanzada: 15/08/2026',
      realizadoPorId: 'system',
      realizadoPorNombre: 'Sistema',
      timestamp: '2026-08-16T03:00:00.000Z',
      generadoPorIA: true,
    }
    render(<DocumentAuditTrail documento={makeDocumento({ auditTrail: [entry] })} />)

    expect(screen.getByText('REVISION_PERIODICA_VENCIDA')).toBeInTheDocument()
    expect(screen.getByText('Motivo: Fecha de revisión periódica alcanzada: 15/08/2026')).toBeInTheDocument()
    expect(screen.getByText('Sistema')).toBeInTheDocument()
  })
})
