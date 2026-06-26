import { describe, it, expect } from 'vitest'
import { getNCPermissions } from './ncPermissions'
import type { NoConformidad, NCPermissions } from '../types/nonconformity.types'

function makeNC(estado: NoConformidad['estado']): NoConformidad {
  return {
    id: 'test-id',
    numero: 'NC-CAL-2026-001',
    dominio: 'CALIDAD',
    origen: 'INSPECCION_INTERNA',
    tipo: 'PROCESO',
    severidad: 'BAJA',
    estado,
    descripcion: 'Descripción de prueba para la no conformidad',
    areaAfectada: 'Almacén',
    reportadoPorId: 'user-1',
    fechaDeteccion: '2026-01-01T00:00:00Z',
    fechaReporte: '2026-01-01T00:00:00Z',
    accionesCorrectivas: [],
    documentosVinculados: [],
    adjuntos: [],
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
  }
}

function deny(overrides: Partial<NCPermissions> = {}): NCPermissions {
  return {
    canRead: false,
    canEdit: false,
    canDelete: false,
    canComment: false,
    canIniciarInvestigacion: false,
    canRegistrarCorreccion: false,
    canSolicitarCierre: false,
    canCerrar: false,
    canReabrir: false,
    ...overrides,
  }
}

describe('getNCPermissions — OPERARIO', () => {
  it('is read-only on ABIERTA', () => {
    const perms = getNCPermissions(makeNC('ABIERTA'), 'OPERARIO')
    expect(perms.canRead).toBe(true)
    expect(perms.canIniciarInvestigacion).toBe(false)
    expect(perms.canEdit).toBe(false)
    expect(perms.canCerrar).toBe(false)
    expect(perms.canReabrir).toBe(false)
  })

  it('cannot cerrar in any state', () => {
    const states: NoConformidad['estado'][] = [
      'ABIERTA', 'EN_INVESTIGACION', 'ANALISIS_COMPLETADO', 'EN_EJECUCION', 'PENDIENTE_CIERRE', 'CERRADA',
    ]
    for (const estado of states) {
      expect(getNCPermissions(makeNC(estado), 'OPERARIO').canCerrar).toBe(false)
    }
  })
})

describe('getNCPermissions — SUPERVISOR', () => {
  it('can iniciarInvestigacion on ABIERTA', () => {
    const perms = getNCPermissions(makeNC('ABIERTA'), 'SUPERVISOR')
    expect(perms.canIniciarInvestigacion).toBe(true)
    expect(perms.canEdit).toBe(true)
    expect(perms.canComment).toBe(true)
  })

  it('can registrarCorreccion on EN_INVESTIGACION', () => {
    const perms = getNCPermissions(makeNC('EN_INVESTIGACION'), 'SUPERVISOR')
    expect(perms.canRegistrarCorreccion).toBe(true)
    expect(perms.canEdit).toBe(true)
  })

  it('can solicitarCierre on EN_EJECUCION', () => {
    const perms = getNCPermissions(makeNC('EN_EJECUCION'), 'SUPERVISOR')
    expect(perms.canSolicitarCierre).toBe(true)
  })

  it('cannot cerrar in any state', () => {
    const states: NoConformidad['estado'][] = [
      'ABIERTA', 'EN_INVESTIGACION', 'ANALISIS_COMPLETADO', 'EN_EJECUCION', 'PENDIENTE_CIERRE', 'CERRADA',
    ]
    for (const estado of states) {
      expect(getNCPermissions(makeNC(estado), 'SUPERVISOR').canCerrar).toBe(false)
    }
  })
})

describe('getNCPermissions — JEFE_CALIDAD_SYST', () => {
  it('can cerrar on PENDIENTE_CIERRE', () => {
    const perms = getNCPermissions(makeNC('PENDIENTE_CIERRE'), 'JEFE_CALIDAD_SYST')
    expect(perms.canCerrar).toBe(true)
    expect(perms.canRead).toBe(true)
    expect(perms.canComment).toBe(true)
  })

  it('cannot cerrar when not in PENDIENTE_CIERRE', () => {
    expect(getNCPermissions(makeNC('EN_EJECUCION'), 'JEFE_CALIDAD_SYST').canCerrar).toBe(false)
    expect(getNCPermissions(makeNC('EN_INVESTIGACION'), 'JEFE_CALIDAD_SYST').canCerrar).toBe(false)
    expect(getNCPermissions(makeNC('ABIERTA'), 'JEFE_CALIDAD_SYST').canCerrar).toBe(false)
  })
})

describe('getNCPermissions — AUDITOR_INTERNO', () => {
  it('can only read and comment in all states', () => {
    const states: NoConformidad['estado'][] = [
      'ABIERTA', 'EN_INVESTIGACION', 'ANALISIS_COMPLETADO', 'EN_EJECUCION', 'PENDIENTE_CIERRE', 'CERRADA',
    ]
    for (const estado of states) {
      const perms = getNCPermissions(makeNC(estado), 'AUDITOR_INTERNO')
      expect(perms).toEqual(deny({ canRead: true, canComment: true }))
    }
  })
})

describe('getNCPermissions — ALTA_DIRECCION', () => {
  it('can cerrar on PENDIENTE_CIERRE', () => {
    expect(getNCPermissions(makeNC('PENDIENTE_CIERRE'), 'ALTA_DIRECCION').canCerrar).toBe(true)
  })

  it('cannot edit in any state', () => {
    const states: NoConformidad['estado'][] = [
      'ABIERTA', 'EN_INVESTIGACION', 'ANALISIS_COMPLETADO', 'EN_EJECUCION', 'PENDIENTE_CIERRE', 'CERRADA',
    ]
    for (const estado of states) {
      expect(getNCPermissions(makeNC(estado), 'ALTA_DIRECCION').canEdit).toBe(false)
    }
  })
})

describe('getNCPermissions — JEFE_CONTROL_DOCUMENTARIO', () => {
  it('can only read in all states', () => {
    const states: NoConformidad['estado'][] = [
      'ABIERTA', 'EN_INVESTIGACION', 'ANALISIS_COMPLETADO', 'EN_EJECUCION', 'PENDIENTE_CIERRE', 'CERRADA',
    ]
    for (const estado of states) {
      const perms = getNCPermissions(makeNC(estado), 'JEFE_CONTROL_DOCUMENTARIO')
      expect(perms).toEqual(deny({ canRead: true }))
    }
  })
})
