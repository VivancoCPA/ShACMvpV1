import { describe, it, expect } from 'vitest'
import { extraerAccionesQE, filtrarAccionesPorTipo } from './accionesRequeridas.utils'
import type { AccionRequerida } from '../types/accionesRequeridas.types'
import type { QualityEvent } from '../../quality-events/types/qualityEvent.types'
import type { User } from '../../../types/auth.types'
import { createMockUser } from '../../../mocks/fixtures/mockUser'

const JCA = createMockUser({ id: 'user-jca', rol: 'JEFE_CALIDAD_SYST' })
const SUP_A = createMockUser({ id: 'user-sup-a', rol: 'SUPERVISOR', areaIds: ['Almacén Norte'] })
const SUP_B = createMockUser({ id: 'user-sup-b', rol: 'SUPERVISOR', areaIds: ['Almacén Norte'] })

const CAUSA_RAIZ_OK = 'x'.repeat(100)
const recien = () => new Date(Date.now() - 60 * 60 * 1000).toISOString()

function buildQE(overrides: Partial<QualityEvent>): QualityEvent {
  return {
    id: 'qe-1',
    numero: 'QE-2026-001',
    origen: 'O1_INCIDENTE_CAMPO',
    tipo: 'SST',
    severidad: 'BAJA',
    estado: 'ABIERTO',
    ciclo: 1,
    descripcion: 'Descripción',
    areaId: 'Almacén Norte',
    empresaId: 'empresa-001',
    turno: 'DIA',
    fechaHoraEvento: recien(),
    fechaHoraReporte: recien(),
    reportadoPorId: 'user-001',
    documentosVinculados: [],
    requiereEvaluacionRiesgos: false,
    solicitudesAC: 0,
    accionesCorrectivas: [],
    auditTrail: [],
    creadoEn: recien(),
    actualizadoEn: recien(),
    ...overrides,
  }
}

const tipos = (qe: QualityEvent, user: User) => extraerAccionesQE([qe], user).map((i) => i.tipo)

describe('extraerAccionesQE — pendientes por asignación (pendientes-qe-asignacion-y-menus)', () => {
  it('JCA responsable de un QE ABIERTO ve iniciar investigación, no asignar responsable', () => {
    const qe = buildQE({ responsableInvestigacionId: JCA.id })
    expect(tipos(qe, JCA)).toEqual(['QE_INICIAR_INVESTIGACION'])
  })

  it('QE ABIERTO sin responsable: el JCA ve asignar responsable y el SUP no ve nada', () => {
    const qe = buildQE({})
    expect(tipos(qe, JCA)).toEqual(['QE_ASIGNAR_RESPONSABLE'])
    expect(tipos(qe, SUP_A)).toEqual([])
  })

  it('QE ABIERTO asignado a SUP A: solo A ve iniciar investigación', () => {
    const qe = buildQE({ responsableInvestigacionId: SUP_A.id })
    expect(tipos(qe, SUP_A)).toEqual(['QE_INICIAR_INVESTIGACION'])
    expect(tipos(qe, SUP_B)).toEqual([])
    expect(tipos(qe, JCA)).toEqual([])
  })

  it('EN_INVESTIGACION con responsable SUP A y causa raíz lista: A completa, el JCA aprueba', () => {
    const qe = buildQE({
      estado: 'EN_INVESTIGACION',
      responsableInvestigacionId: SUP_A.id,
      causaRaizDefinitiva: CAUSA_RAIZ_OK,
    })
    expect(tipos(qe, SUP_A)).toEqual(['QE_COMPLETAR_ANALISIS'])
    expect(tipos(qe, JCA)).toEqual(['QE_APROBAR_CAUSA_RAIZ'])
  })

  it('JCA responsable con causa raíz lista recibe ambos ítems con ids únicos', () => {
    const qe = buildQE({
      estado: 'EN_INVESTIGACION',
      responsableInvestigacionId: JCA.id,
      causaRaizDefinitiva: CAUSA_RAIZ_OK,
    })
    const items = extraerAccionesQE([qe], JCA)
    expect(items.map((i) => i.id)).toEqual(['QE-QE_COMPLETAR_ANALISIS-qe-1', 'QE-QE_APROBAR_CAUSA_RAIZ-qe-1'])
  })

  it('causa raíz de menos de 100 caracteres (tras trim) no genera aprobar causa raíz', () => {
    const qe = buildQE({ estado: 'ANALISIS_COMPLETADO', causaRaizDefinitiva: `  ${'x'.repeat(99)}  ` })
    expect(tipos(qe, JCA)).toEqual([])
  })

  it('causa raíz firmada no genera aprobar causa raíz', () => {
    const qe = buildQE({
      estado: 'ANALISIS_COMPLETADO',
      causaRaizDefinitiva: CAUSA_RAIZ_OK,
      causaRaizFirmadaEn: recien(),
    })
    expect(tipos(qe, JCA)).toEqual([])
  })

  it('QE ABIERTO desde hace 50 h tiene prioridad alta aunque su severidad sea BAJA', () => {
    const hace50h = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString()
    const vencido = buildQE({ fechaHoraReporte: hace50h })
    const reciente = buildQE({})
    expect(extraerAccionesQE([vencido], JCA)[0].prioridad).toBe('alta')
    expect(extraerAccionesQE([reciente], JCA)[0].prioridad).toBe('normal')

    const asignadoVencido = buildQE({ fechaHoraReporte: hace50h, responsableInvestigacionId: SUP_A.id })
    expect(extraerAccionesQE([asignadoVencido], SUP_A)[0].prioridad).toBe('alta')
  })

  it('QE eliminado no genera ítems', () => {
    const qe = buildQE({ deletedAt: recien() })
    expect(tipos(qe, JCA)).toEqual([])
  })

  it('QE_CAUSA_RAIZ ya no existe: el JCA no ve pendiente en un QE en investigación sin causa raíz ajeno', () => {
    const qe = buildQE({ estado: 'EN_INVESTIGACION', responsableInvestigacionId: SUP_A.id })
    expect(tipos(qe, JCA)).toEqual([])
  })
})

describe('extraerAccionesQE — regresiones', () => {
  it('QE_REGISTRAR_CIERRE sale para el JCA antes de registrar el resultado de cierre', () => {
    expect(tipos(buildQE({ estado: 'PENDIENTE_CIERRE' }), JCA)).toEqual(['QE_REGISTRAR_CIERRE'])
  })

  it('QE_FIRMAR_CIERRE_JCA sale cuando hay resultado de cierre y falta la firma del JCA', () => {
    const qe = buildQE({ estado: 'PENDIENTE_CIERRE', resultadoCierre: CAUSA_RAIZ_OK })
    expect(tipos(qe, JCA)).toEqual(['QE_FIRMAR_CIERRE_JCA'])
  })

  it('ni registrar ni firmar cierre cuando el JCA ya firmó', () => {
    const qe = buildQE({ estado: 'PENDIENTE_CIERRE', resultadoCierre: CAUSA_RAIZ_OK, cerradoPorId: JCA.id })
    expect(tipos(qe, JCA)).toEqual([])
  })

  it('los pendientes de cierre del JCA no salen fuera de PENDIENTE_CIERRE', () => {
    expect(tipos(buildQE({ estado: 'EN_EJECUCION', resultadoCierre: CAUSA_RAIZ_OK }), JCA)).toEqual([])
  })

  it('QE_VERIFICAR sigue saliendo para el JCA en EN_VERIFICACION', () => {
    expect(tipos(buildQE({ estado: 'EN_VERIFICACION' }), JCA)).toEqual(['QE_VERIFICAR'])
  })

  it('QE_FIRMAR_CIERRE sigue saliendo para el supervisor del área', () => {
    const qe = buildQE({ estado: 'PENDIENTE_CIERRE', cerradoPorId: JCA.id, resultadoCierre: CAUSA_RAIZ_OK })
    expect(tipos(qe, SUP_A)).toEqual(['QE_FIRMAR_CIERRE'])
  })
})

describe('filtrarAccionesPorTipo', () => {
  it('devuelve solo los ítems de los tipos pedidos, en el mismo orden', () => {
    const item = (id: string, tipo: AccionRequerida['tipo']) =>
      ({ id, tipo, dominio: 'QE', codigo: id, descripcion: '', prioridad: 'normal', ruta: '/' }) as AccionRequerida
    const items = [item('a', 'QE_APROBAR_CAUSA_RAIZ'), item('b', 'AC_EJECUTAR'), item('c', 'QE_REGISTRAR_CIERRE')]
    expect(filtrarAccionesPorTipo(items, ['QE_APROBAR_CAUSA_RAIZ', 'QE_REGISTRAR_CIERRE']).map((i) => i.id)).toEqual(['a', 'c'])
  })
})
