import { describe, it, expect } from 'vitest'
import {
  extraerAccionesQE,
  extraerAccionesAC,
  extraerAccionesDocumento,
} from '../utils/accionesRequeridas.utils'
import type { QualityEvent, AccionCorrectivaQE } from '../../quality-events/types/qualityEvent.types'
import type { NoConformidad, AccionCorrectiva } from '../../nonconformities/types/nonconformity.types'
import type { Incidente, AccionCorrectivaIncidente } from '../../incidents/types/incident.types'
import type { Documento } from '../../../types/documents.types'
import type { User } from '../../../types/auth.types'

function buildUser(overrides: Partial<User>): User {
  return {
    id: 'user-005',
    nombre: 'Luis',
    apellido: 'Paredes',
    email: 'luis@shac.internal',
    rol: 'JEFE_CALIDAD_SYST',
    ...overrides,
  }
}

function buildQE(overrides: Partial<QualityEvent>): QualityEvent {
  return {
    id: 'qe-x',
    numero: 'QE-2026-900',
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'SST',
    severidad: 'MEDIA',
    estado: 'PENDIENTE_CIERRE',
    ciclo: 1,
    descripcion: 'Descripción',
    areaId: 'Almacén Norte',
    turno: 'DIA',
    fechaHoraEvento: '2026-01-01T00:00:00Z',
    fechaHoraReporte: '2026-01-01T00:00:00Z',
    reportadoPorId: 'user-001',
    documentosVinculados: [],
    requiereEvaluacionRiesgos: false,
    solicitudesAC: 0,
    accionesCorrectivas: [],
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function buildNC(overrides: Partial<NoConformidad>): NoConformidad {
  return {
    id: 'nc-x',
    numero: 'NC-CAL-2026-900',
    dominio: 'CALIDAD',
    origen: 'INSPECCION_INTERNA',
    tipo: 'PROCESO',
    severidad: 'MEDIA',
    estado: 'EN_EJECUCION',
    descripcion: 'Descripción NC',
    areaId: 'Almacén Norte',
    reportadoPorId: 'user-001',
    fechaDeteccion: '2026-01-01T00:00:00Z',
    fechaReporte: '2026-01-01T00:00:00Z',
    accionesCorrectivas: [],
    documentosVinculados: [],
    adjuntos: [],
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function buildIncidente(overrides: Partial<Incidente>): Incidente {
  return {
    id: 'inc-x',
    numero: 'INC-2026-900',
    tipo: 'CONDICION_INSEGURA',
    estado: 'EN_INVESTIGACION',
    severidad: 'MEDIA',
    descripcion: 'Descripción incidente',
    areaId: 'area-1',
    turno: 'DIA',
    fechaEvento: '2026-01-01T00:00:00Z',
    fechaReporte: '2026-01-01T00:00:00Z',
    reportadoPorId: 'user-001',
    huboLesionados: false,
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function buildDocumento(overrides: Partial<Documento>): Documento {
  return {
    id: 'doc-x',
    codigo: 'PRC-CD-900',
    titulo: 'Procedimiento de prueba',
    tipo: 'PRC',
    version: 'v1.0',
    estado: 'BORRADOR',
    area: 'Calidad',
    confidencialidad: 'INTERNO',
    autorId: 'user-005',
    archivoOriginalUrl: null,
    archivoOriginalNombre: null,
    archivoOriginalBloqueado: false,
    archivoDistribucionUrl: null,
    qeVinculados: [],
    historialVersiones: [],
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('extraerAccionesQE — evita el falso positivo de JEFE_CALIDAD_SYST en PENDIENTE_CIERRE', () => {
  const jefeCalidad = buildUser({ id: 'user-005', rol: 'JEFE_CALIDAD_SYST' })

  it('incluye QE_CERRAR cuando aún no llenó el formulario de cierre', () => {
    const qe = buildQE({ estado: 'PENDIENTE_CIERRE', resultadoCierre: undefined, cerradoPorId: undefined })
    const items = extraerAccionesQE([qe], jefeCalidad)
    expect(items.some((i) => i.tipo === 'QE_CERRAR')).toBe(true)
  })

  it('omite QE_CERRAR una vez que ya firmó primero (la acción pendiente pasó a Supervisor)', () => {
    const qe = buildQE({
      estado: 'PENDIENTE_CIERRE',
      resultadoCierre: 'Ya cerrado por Jefe de Calidad',
      cerradoPorId: 'user-005',
      cierreFirmaSupervisorId: undefined,
    })
    const items = extraerAccionesQE([qe], jefeCalidad)
    expect(items.some((i) => i.tipo === 'QE_CERRAR')).toBe(false)
  })
})

describe('extraerAccionesQE — AUDITOR_INTERNO filtrado por auditorAsignadoId', () => {
  it('incluye QE_VERIFICAR solo para el auditor asignado', () => {
    const qe = buildQE({ estado: 'EN_VERIFICACION', auditorAsignadoId: 'user-004' })

    const asignado = buildUser({ id: 'user-004', rol: 'AUDITOR_INTERNO' })
    const otro = buildUser({ id: 'user-006', rol: 'AUDITOR_INTERNO' })

    expect(extraerAccionesQE([qe], asignado).some((i) => i.tipo === 'QE_VERIFICAR')).toBe(true)
    expect(extraerAccionesQE([qe], otro).some((i) => i.tipo === 'QE_VERIFICAR')).toBe(false)
  })

  it('JEFE_CALIDAD_SYST ve QE_VERIFICAR sin necesidad de ser el auditor asignado', () => {
    const qe = buildQE({ estado: 'EN_VERIFICACION', auditorAsignadoId: 'user-004' })
    const jefeCalidad = buildUser({ id: 'user-005', rol: 'JEFE_CALIDAD_SYST' })
    expect(extraerAccionesQE([qe], jefeCalidad).some((i) => i.tipo === 'QE_VERIFICAR')).toBe(true)
  })
})

describe('extraerAccionesAC — acciones correctivas de los 3 orígenes', () => {
  const user = buildUser({ id: 'user-002', rol: 'OPERARIO' })

  const acQE: AccionCorrectivaQE = {
    id: 'ac-qe-1',
    qeId: 'qe-x',
    descripcion: 'AC del QE',
    responsableId: 'user-002',
    responsableNombre: 'Carlos Mendoza',
    plazoFecha: '2099-01-01',
    estado: 'PENDIENTE',
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    solicitudesAjustePlazo: [],
  }
  const acNC: AccionCorrectiva = {
    id: 'ac-nc-1',
    ncId: 'nc-x',
    descripcion: 'AC de la NC',
    responsableId: 'user-002',
    responsableNombre: 'Carlos Mendoza',
    plazoFecha: '2099-01-01',
    estado: 'PENDIENTE',
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  }
  const acIncidente: AccionCorrectivaIncidente = {
    id: 'ac-inc-1',
    incidenteId: 'inc-x',
    descripcion: 'AC del Incidente',
    responsableId: 'user-002',
    responsableNombre: 'Carlos Mendoza',
    plazoFecha: '2099-01-01',
    estado: 'EN_EJECUCION',
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  }

  it('recolecta acciones correctivas pendientes desde QE, NC e Incidente', () => {
    const qe = buildQE({ accionesCorrectivas: [acQE] })
    const nc = buildNC({ accionesCorrectivas: [acNC] })
    const inc = buildIncidente({ accionesCorrectivas: [acIncidente] })

    const items = extraerAccionesAC([qe], [nc], [inc], user)

    expect(items).toHaveLength(3)
    expect(items.find((i) => i.ruta === '/quality-events/qe-x')).toBeDefined()
    expect(items.find((i) => i.ruta === '/nonconformities/nc-x')).toBeDefined()
    expect(items.find((i) => i.ruta === '/incidents/inc-x')).toBeDefined()
    expect(items.every((i) => i.dominio === 'AC')).toBe(true)
  })

  it('excluye acciones correctivas ya con evidencia o de otro responsable', () => {
    const conEvidencia = buildQE({
      accionesCorrectivas: [{ ...acQE, descripcionEvidencia: 'Ya tiene evidencia' }],
    })
    const otroResponsable = buildNC({ accionesCorrectivas: [{ ...acNC, responsableId: 'user-999' }] })

    const items = extraerAccionesAC([conEvidencia], [otroResponsable], [], user)
    expect(items).toHaveLength(0)
  })
})

describe('extraerAccionesDocumento — Documentos por rol', () => {
  const user = buildUser({ id: 'user-005', rol: 'JEFE_CALIDAD_SYST' })

  it('incluye DOC_REVISAR para el revisor cuando el documento está EN_REVISION', () => {
    const doc = buildDocumento({ revisorId: 'user-005', estado: 'EN_REVISION' })
    expect(extraerAccionesDocumento([doc], user).some((i) => i.tipo === 'DOC_REVISAR')).toBe(true)
  })

  it('incluye DOC_APROBAR para el aprobador cuando el documento está EN_APROBACION', () => {
    const doc = buildDocumento({ aprobadorId: 'user-005', estado: 'EN_APROBACION' })
    expect(extraerAccionesDocumento([doc], user).some((i) => i.tipo === 'DOC_APROBAR')).toBe(true)
  })

  it('incluye DOC_REVISION_PERIODICA para el autor cuando el documento está EN_REVISION_PERIODICA', () => {
    const doc = buildDocumento({ autorId: 'user-005', estado: 'EN_REVISION_PERIODICA' })
    expect(extraerAccionesDocumento([doc], user).some((i) => i.tipo === 'DOC_REVISION_PERIODICA')).toBe(true)
  })

  it('no incluye nada cuando el usuario no tiene rol asignado sobre el documento', () => {
    const doc = buildDocumento({ revisorId: 'user-999', aprobadorId: 'user-999', estado: 'EN_REVISION' })
    expect(extraerAccionesDocumento([doc], user)).toHaveLength(0)
  })
})
