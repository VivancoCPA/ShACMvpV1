import { describe, it, expect } from 'vitest'
import { buildQualityEventPdf, type QEExportMeta } from './buildQualityEventPdf'
import type { QualityEvent, AccionCorrectivaQE, QEAuditTrailEntry } from '../types/qualityEvent.types'

const baseMeta: QEExportMeta = {
  exportadoPorNombre: 'Ana Torres',
  generadoEn: new Date('2026-07-18T15:32:00Z'),
}

function makeAuditEntry(overrides: Partial<QEAuditTrailEntry>): QEAuditTrailEntry {
  return {
    id: 'aud-1',
    entidadTipo: 'QualityEvent',
    entidadId: 'qe-2026-010',
    accion: 'CREADO',
    realizadoPorId: 'user-001',
    realizadoPorNombre: 'Ricardo Flores',
    timestamp: '2026-06-01T08:00:00Z',
    generadoPorIA: false,
    ...overrides,
  }
}

function makeAC(overrides: Partial<AccionCorrectivaQE>): AccionCorrectivaQE {
  return {
    id: 'ac-1',
    qeId: 'qe-2026-010',
    descripcion: 'Reforzar señalización del área',
    responsableId: 'user-002',
    responsableNombre: 'Luis Paredes',
    plazoFecha: '2026-07-01',
    estado: 'PENDIENTE',
    creadoEn: '2026-06-01T08:00:00Z',
    actualizadoEn: '2026-06-01T08:00:00Z',
    solicitudesAjustePlazo: [],
    ...overrides,
  }
}

function baseQE(overrides: Partial<QualityEvent>): QualityEvent {
  return {
    id: 'qe-2026-010',
    numero: 'QE-2026-010',
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'SST',
    severidad: 'ALTA',
    estado: 'ABIERTO',
    ciclo: 1,
    descripcion: 'Derrame de mineral en zona de carga',
    areaId: 'area-001',
    turno: 'DIA',
    fechaHoraEvento: '2026-06-01T07:00:00Z',
    fechaHoraReporte: '2026-06-01T08:00:00Z',
    reportadoPorId: 'user-001',
    documentosVinculados: [],
    requiereEvaluacionRiesgos: false,
    solicitudesAC: 0,
    accionesCorrectivas: [],
    auditTrail: [makeAuditEntry({})],
    creadoEn: '2026-06-01T08:00:00Z',
    actualizadoEn: '2026-06-01T08:00:00Z',
    ...overrides,
  }
}

describe('buildQualityEventPdf', () => {
  it('renders all six sections with their data for a fully-populated QE', () => {
    const qe = baseQE({
      estado: 'VERIFICADO',
      accionesCorrectivas: [makeAC({})],
      causaRaizDefinitiva: 'Falta de mantenimiento preventivo en la cinta transportadora',
      resultadoCierre: 'Se corrigió el procedimiento y se capacitó al personal',
      plazoVerificacionDias: 60,
      resultadoVerificacion: 'EFECTIVO',
      auditTrail: [
        makeAuditEntry({ id: 'a1', accion: 'CREADO' }),
        makeAuditEntry({ id: 'a2', accion: 'ESTADO_CAMBIADO', estadoAnterior: 'ABIERTO', estadoNuevo: 'EN_INVESTIGACION' }),
        makeAuditEntry({ id: 'a3', accion: 'CAUSA_RAIZ_APROBADA' }),
        makeAuditEntry({ id: 'a4', accion: 'FIRMA_CIERRE_JEFE_CALIDAD' }),
        makeAuditEntry({ id: 'a5', accion: 'FIRMA_CIERRE_SEGUNDA' }),
        makeAuditEntry({ id: 'a6', accion: 'ESTADO_CAMBIADO', estadoAnterior: 'EN_VERIFICACION', estadoNuevo: 'VERIFICADO' }),
      ],
    })

    const doc = buildQualityEventPdf(qe, baseMeta)
    const out = doc.output()

    expect(out).toContain('Cabecera')
    expect(out).toContain('Descripción')
    expect(out).toContain('Causa Ra')
    expect(out).toContain('Plan de Acciones Correctivas')
    expect(out).toContain('Cierre')
    expect(out).toContain('Audit Trail')
    expect(out).toContain('QE-2026-010')
    expect(out).toContain('Reforzar señalización del área')
    expect(out).toContain('Falta de mantenimiento preventivo en la cinta transportadora')
  })

  it('shows the placeholder text for empty sections without omitting their heading (RN-QE-017)', () => {
    const qe = baseQE({ estado: 'ABIERTO', accionesCorrectivas: [], resultadoCierre: undefined })
    const doc = buildQualityEventPdf(qe, baseMeta)
    const out = doc.output()

    expect(out).toContain('Plan de Acciones Correctivas')
    expect(out).toContain('Cierre')
    const placeholderCount = out.split('Sin informaci').length - 1
    expect(placeholderCount).toBeGreaterThanOrEqual(2)
  })

  it('includes audit trail entries from all prior ciclos for a reopened QE', () => {
    const qe = baseQE({
      ciclo: 3,
      auditTrail: [
        makeAuditEntry({ id: 'c1', accion: 'CREADO', realizadoPorNombre: 'Persona Ciclo Uno' }),
        makeAuditEntry({ id: 'c2', accion: 'REABIERTO', realizadoPorNombre: 'Persona Ciclo Dos' }),
        makeAuditEntry({ id: 'c3', accion: 'REABIERTO', realizadoPorNombre: 'Persona Ciclo Tres' }),
      ],
    })

    const doc = buildQualityEventPdf(qe, baseMeta)
    const out = doc.output()

    expect(out).toContain('Persona Ciclo Uno')
    expect(out).toContain('Persona Ciclo Dos')
    expect(out).toContain('Persona Ciclo Tres')
  })

  it('shows the ciclo indicator in the cabecera for a reopened QE', () => {
    const qe = baseQE({ ciclo: 2 })
    const doc = buildQualityEventPdf(qe, baseMeta)
    const out = doc.output()
    expect(out).toContain('Ciclo 2')
    expect(out).toContain('Reabierto')
  })

  it('renders a footer with numero, page count, timestamp, and exporting user on every page', () => {
    const qe = baseQE({})
    const doc = buildQualityEventPdf(qe, baseMeta)
    const totalPages = doc.getNumberOfPages()
    expect(totalPages).toBeGreaterThan(0)

    const out = doc.output()
    for (let page = 1; page <= totalPages; page++) {
      expect(out).toContain(`Página ${page} de ${totalPages}`)
    }
    expect(out).toContain('QE-2026-010')
    expect(out).toContain('Ana Torres')
  })
})
