import { describe, it, expect } from 'vitest'
import { getNCPermissions } from './ncPermissions'
import type { NoConformidad, NCPermissions } from '../types/nonconformity.types'

function makeNC(estado: NoConformidad['estado'], qeGeneradoId?: string): NoConformidad {
  return {
    id: 'test-id',
    numero: 'NC-CAL-2026-001',
    dominio: 'CALIDAD',
    origen: 'INSPECCION_INTERNA',
    tipo: 'PROCESO',
    severidad: 'BAJA',
    estado,
    descripcion: 'Descripción de prueba para la no conformidad',
    areaId: 'Almacén',
    reportadoPorId: 'user-1',
    fechaDeteccion: '2026-01-01T00:00:00Z',
    fechaReporte: '2026-01-01T00:00:00Z',
    accionesCorrectivas: [],
    documentosVinculados: [],
    adjuntos: [],
    auditTrail: [],
    creadoEn: '2026-01-01T00:00:00Z',
    actualizadoEn: '2026-01-01T00:00:00Z',
    qeGeneradoId,
  }
}

function deny(overrides: Partial<NCPermissions> = {}): NCPermissions {
  return {
    canRead: false,
    canEdit: false,
    canDelete: false,
    canRestore: false,
    canComment: false,
    canIniciarInvestigacion: false,
    canRegistrarCorreccion: false,
    canSolicitarCierre: false,
    canCerrar: false,
    canReabrir: false,
    canAnular: false,
    canAsignarAC: false,
    canCerrarAC: false,
    canVerAuditTrail: false,
    canCrearQE: false,
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
  it('can only read, comment, and view audit trail in all states', () => {
    const states: NoConformidad['estado'][] = [
      'ABIERTA', 'EN_INVESTIGACION', 'ANALISIS_COMPLETADO', 'EN_EJECUCION', 'PENDIENTE_CIERRE', 'CERRADA',
    ]
    for (const estado of states) {
      const perms = getNCPermissions(makeNC(estado), 'AUDITOR_INTERNO')
      expect(perms).toEqual(deny({ canRead: true, canComment: true, canVerAuditTrail: true }))
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
  it('can only read and view audit trail in all states', () => {
    const states: NoConformidad['estado'][] = [
      'ABIERTA', 'EN_INVESTIGACION', 'ANALISIS_COMPLETADO', 'EN_EJECUCION', 'PENDIENTE_CIERRE', 'CERRADA',
    ]
    for (const estado of states) {
      const perms = getNCPermissions(makeNC(estado), 'JEFE_CONTROL_DOCUMENTARIO')
      expect(perms).toEqual(deny({ canRead: true, canVerAuditTrail: true }))
    }
  })
})

describe('getNCPermissions — new flags', () => {
  it('OPERARIO has all new flags false', () => {
    const perms = getNCPermissions(makeNC('ABIERTA'), 'OPERARIO')
    expect(perms.canAnular).toBe(false)
    expect(perms.canAsignarAC).toBe(false)
    expect(perms.canCerrarAC).toBe(false)
    expect(perms.canVerAuditTrail).toBe(false)
  })

  it('JEFE_CALIDAD_SYST can anular on non-terminal states', () => {
    expect(getNCPermissions(makeNC('ABIERTA'), 'JEFE_CALIDAD_SYST').canAnular).toBe(true)
    expect(getNCPermissions(makeNC('EN_INVESTIGACION'), 'JEFE_CALIDAD_SYST').canAnular).toBe(true)
    expect(getNCPermissions(makeNC('CERRADA'), 'JEFE_CALIDAD_SYST').canAnular).toBe(false)
    expect(getNCPermissions(makeNC('ANULADA'), 'JEFE_CALIDAD_SYST').canAnular).toBe(false)
  })

  it('JEFE_CALIDAD_SYST has canAsignarAC, canCerrarAC, canVerAuditTrail true', () => {
    const perms = getNCPermissions(makeNC('EN_EJECUCION'), 'JEFE_CALIDAD_SYST')
    expect(perms.canAsignarAC).toBe(true)
    expect(perms.canCerrarAC).toBe(true)
    expect(perms.canVerAuditTrail).toBe(true)
  })

  it('JEFE_CALIDAD_SYST has canDelete and canRestore true in all states', () => {
    const states: NoConformidad['estado'][] = [
      'ABIERTA', 'EN_INVESTIGACION', 'ANALISIS_COMPLETADO', 'EN_EJECUCION', 'PENDIENTE_CIERRE', 'CERRADA', 'ANULADA',
    ]
    for (const estado of states) {
      const perms = getNCPermissions(makeNC(estado), 'JEFE_CALIDAD_SYST')
      expect(perms.canDelete).toBe(true)
      expect(perms.canRestore).toBe(true)
    }
  })

  it('non-JEFE_CALIDAD_SYST roles have canDelete and canRestore false', () => {
    const roles: Parameters<typeof getNCPermissions>[1][] = [
      'OPERARIO', 'SUPERVISOR', 'AUDITOR_INTERNO', 'ALTA_DIRECCION', 'JEFE_CONTROL_DOCUMENTARIO',
    ]
    for (const rol of roles) {
      const perms = getNCPermissions(makeNC('ABIERTA'), rol)
      expect(perms.canDelete).toBe(false)
      expect(perms.canRestore).toBe(false)
    }
  })

  it('SUPERVISOR has canAsignarAC true on non-terminal NC and canVerAuditTrail true', () => {
    const permsActive = getNCPermissions(makeNC('EN_EJECUCION'), 'SUPERVISOR')
    expect(permsActive.canAsignarAC).toBe(true)
    expect(permsActive.canVerAuditTrail).toBe(true)
    expect(permsActive.canCerrarAC).toBe(false)
    expect(permsActive.canAnular).toBe(false)
    const permsClosed = getNCPermissions(makeNC('CERRADA'), 'SUPERVISOR')
    expect(permsClosed.canAsignarAC).toBe(false)
  })
})

describe('getNCPermissions — canCrearQE', () => {
  it('is true for SUPERVISOR on an active NC without a linked QE', () => {
    expect(getNCPermissions(makeNC('EN_EJECUCION'), 'SUPERVISOR').canCrearQE).toBe(true)
  })

  it('is true for SUPERVISOR on ABIERTA without a linked QE', () => {
    expect(getNCPermissions(makeNC('ABIERTA'), 'SUPERVISOR').canCrearQE).toBe(true)
  })

  it('is true for JEFE_CALIDAD_SYST on an active NC without a linked QE', () => {
    expect(getNCPermissions(makeNC('ABIERTA'), 'JEFE_CALIDAD_SYST').canCrearQE).toBe(true)
  })

  it('is false when the NC already has a linked QE', () => {
    expect(getNCPermissions(makeNC('ABIERTA', 'qe-2026-005'), 'SUPERVISOR').canCrearQE).toBe(false)
  })

  it('is false for a CERRADA NC', () => {
    expect(getNCPermissions(makeNC('CERRADA'), 'JEFE_CALIDAD_SYST').canCrearQE).toBe(false)
  })

  it('is false for an ANULADA NC', () => {
    expect(getNCPermissions(makeNC('ANULADA'), 'SUPERVISOR').canCrearQE).toBe(false)
  })

  it('is false for OPERARIO regardless of state', () => {
    expect(getNCPermissions(makeNC('ABIERTA'), 'OPERARIO').canCrearQE).toBe(false)
  })
})
