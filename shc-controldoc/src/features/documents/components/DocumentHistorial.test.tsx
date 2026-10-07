import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DocumentHistorial } from './DocumentHistorial'
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

const creado: AuditTrailEntry = {
  id: 'audit-1',
  accion: 'DOCUMENTO_CREADO',
  realizadoPorId: 'user-001',
  realizadoPorNombre: 'Ana Pérez',
  timestamp: '2026-01-01T08:00:00.000Z',
  generadoPorIA: false,
}

const enRevision: AuditTrailEntry = {
  id: 'audit-2',
  accion: 'ESTADO_CAMBIADO',
  estadoAnterior: 'BORRADOR',
  estadoNuevo: 'EN_REVISION',
  realizadoPorId: 'user-002',
  realizadoPorNombre: 'Carlos Autor',
  timestamp: '2026-01-05T08:00:00.000Z',
  generadoPorIA: false,
}

const publicado: AuditTrailEntry = {
  id: 'audit-3',
  accion: 'FIRMA_REGISTRADA',
  estadoAnterior: 'EN_APROBACION',
  estadoNuevo: 'PUBLICADO',
  realizadoPorId: 'user-003',
  realizadoPorNombre: 'Sofía Vargas',
  timestamp: '2026-01-10T08:00:00.000Z',
  generadoPorIA: false,
}

describe('DocumentHistorial — reconstruido desde auditTrail (fix-detalle-documento-historial-audit)', () => {
  it('no lanza y muestra el estado vacío cuando auditTrail está vacío', () => {
    const documento = makeDocumento({ auditTrail: [] })
    expect(() => render(<DocumentHistorial documento={documento} />)).not.toThrow()
    expect(screen.getByText('auditTrail.noEntries')).toBeInTheDocument()
  })

  it('muestra la entrada de creación cuando auditTrail solo tiene DOCUMENTO_CREADO', () => {
    const documento = makeDocumento({ auditTrail: [creado] })
    render(<DocumentHistorial documento={documento} />)
    expect(screen.getByText('DOCUMENTO_CREADO')).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
  })

  it('muestra la transición de estado con estadoAnterior -> estadoNuevo', () => {
    const documento = makeDocumento({ auditTrail: [creado, enRevision] })
    render(<DocumentHistorial documento={documento} />)
    expect(screen.getByText('ESTADO_CAMBIADO: BORRADOR → EN_REVISION')).toBeInTheDocument()
  })

  it('ordena las entradas de más reciente a más antigua', () => {
    const documento = makeDocumento({ auditTrail: [creado, enRevision, publicado] })
    const { container } = render(<DocumentHistorial documento={documento} />)
    const nombres = Array.from(container.querySelectorAll('li > p:last-child')).map((el) => el.textContent)
    expect(nombres).toEqual(['Sofía Vargas', 'Carlos Autor', 'Ana Pérez'])
  })

  it('ignora acciones no relevantes (DESCARGA, VISUALIZACION) en el historial de estados', () => {
    const descarga: AuditTrailEntry = {
      id: 'audit-4',
      accion: 'DESCARGA',
      realizadoPorId: 'user-004',
      realizadoPorNombre: 'Lector Anónimo',
      timestamp: '2026-01-12T08:00:00.000Z',
      generadoPorIA: false,
    }
    const documento = makeDocumento({ auditTrail: [creado, descarga] })
    render(<DocumentHistorial documento={documento} />)
    expect(screen.queryByText('Lector Anónimo')).not.toBeInTheDocument()
  })
})

describe('DocumentHistorial — acciones de rechazo (documentos-rechazo-visible)', () => {
  it('muestra RECHAZADO_EN_REVISION con su motivo', () => {
    const rechazo: AuditTrailEntry = {
      id: 'audit-rej-1',
      accion: 'RECHAZADO_EN_REVISION',
      estadoAnterior: 'EN_REVISION',
      estadoNuevo: 'BORRADOR',
      motivo: 'Falta evidencia fotográfica.',
      realizadoPorId: 'user-002',
      realizadoPorNombre: 'Carmen Torres',
      timestamp: '2026-01-06T08:00:00.000Z',
      generadoPorIA: false,
    }
    const documento = makeDocumento({ auditTrail: [creado, enRevision, rechazo] })
    render(<DocumentHistorial documento={documento} />)

    expect(screen.getByText('RECHAZADO_EN_REVISION')).toBeInTheDocument()
    expect(screen.getByText('Motivo: Falta evidencia fotográfica.')).toBeInTheDocument()
  })

  it('muestra RECHAZADO_EN_APROBACION con su motivo', () => {
    const rechazo: AuditTrailEntry = {
      id: 'audit-rej-2',
      accion: 'RECHAZADO_EN_APROBACION',
      estadoAnterior: 'EN_APROBACION',
      estadoNuevo: 'BORRADOR',
      motivo: 'Documento incompleto.',
      realizadoPorId: 'user-003',
      realizadoPorNombre: 'Sofía Vargas',
      timestamp: '2026-01-07T08:00:00.000Z',
      generadoPorIA: false,
    }
    const documento = makeDocumento({ auditTrail: [creado, rechazo] })
    render(<DocumentHistorial documento={documento} />)

    expect(screen.getByText('RECHAZADO_EN_APROBACION')).toBeInTheDocument()
    expect(screen.getByText('Motivo: Documento incompleto.')).toBeInTheDocument()
  })

  it('muestra REVISION_CANCELADA sin línea de motivo', () => {
    const cancelacion: AuditTrailEntry = {
      id: 'audit-cancel-1',
      accion: 'REVISION_CANCELADA',
      estadoAnterior: 'EN_REVISION',
      estadoNuevo: 'BORRADOR',
      realizadoPorId: 'user-004',
      realizadoPorNombre: 'Diego Salazar',
      timestamp: '2026-01-08T08:00:00.000Z',
      generadoPorIA: false,
    }
    const documento = makeDocumento({ auditTrail: [creado, cancelacion] })
    render(<DocumentHistorial documento={documento} />)

    expect(screen.getByText('REVISION_CANCELADA')).toBeInTheDocument()
    expect(screen.queryByText(/Motivo:/)).not.toBeInTheDocument()
  })
})

describe('DocumentHistorial — revisión periódica trazable (revision-periodica-trazabilidad)', () => {
  it('muestra REVISION_PERIODICA_INICIADA con su motivo y el actor real que la inició', () => {
    const inicio: AuditTrailEntry = {
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
    const documento = makeDocumento({ auditTrail: [creado, inicio] })
    render(<DocumentHistorial documento={documento} />)

    expect(screen.getByText('REVISION_PERIODICA_INICIADA')).toBeInTheDocument()
    expect(screen.getByText('Motivo: Revisión programada (fecha 25/09/2026)')).toBeInTheDocument()
    expect(screen.getByText('Juan Mendoza')).toBeInTheDocument()
  })

  it('muestra REVISION_PERIODICA_VENCIDA con el actor "Sistema"', () => {
    const vencida: AuditTrailEntry = {
      id: 'audit-rev-venc',
      accion: 'REVISION_PERIODICA_VENCIDA',
      motivo: 'Fecha de revisión periódica alcanzada: 15/08/2026',
      realizadoPorId: 'system',
      realizadoPorNombre: 'Sistema',
      timestamp: '2026-08-16T03:00:00.000Z',
      generadoPorIA: true,
    }
    const documento = makeDocumento({ auditTrail: [creado, vencida] })
    render(<DocumentHistorial documento={documento} />)

    expect(screen.getByText('REVISION_PERIODICA_VENCIDA')).toBeInTheDocument()
    expect(screen.getByText('Sistema')).toBeInTheDocument()
    expect(screen.getByText('Motivo: Fecha de revisión periódica alcanzada: 15/08/2026')).toBeInTheDocument()
  })
})
