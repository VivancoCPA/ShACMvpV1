import { describe, it, expect, vi } from 'vitest'
import {
  getQualityEventPermissions,
  validateTransitionToEnEjecucion,
  validateTransitionToPendienteCierre,
  validateTransitionToCerrado,
  resolveRolSegundaFirma,
} from '../qualityEventPermissions'
import type { QualityEvent } from '../../types/qualityEvent.types'

vi.mock('../../../../mocks/fixtures/users.fixtures', () => ({
  userFixtures: [
    { id: 'user-003', nombre: 'María', apellido: 'Castro', email: 'maria@shac.internal', rol: 'SUPERVISOR', area: 'Operaciones' },
    { id: 'user-005', nombre: 'Luis', apellido: 'Paredes', email: 'luis@shac.internal', rol: 'JEFE_CALIDAD_SYST', area: 'Calidad' },
    { id: 'user-999', nombre: 'Dual', apellido: 'Hat', email: 'dual@shac.internal', rol: 'SUPERVISOR', area: 'Operaciones' },
  ],
}))

const baseQE: QualityEvent = {
  id: 'qe-1',
  numero: 'QE-2025-001',
  origen: 'O1_INCIDENTE_CAMPO',
  tipo: 'SST',
  severidad: 'ALTA',
  estado: 'EN_EJECUCION',
  ciclo: 1,
  descripcion: 'Descripción del evento',
  areaAfectada: 'Almacén Norte',
  turno: 'DIA',
  fechaHoraEvento: '2025-06-01T08:00:00Z',
  fechaHoraReporte: '2025-06-01T09:00:00Z',
  reportadoPorId: 'user-1',
  documentosVinculados: [],
  requiereEvaluacionRiesgos: false,
  solicitudesAC: 0,
  accionesCorrectivas: [],
  auditTrail: [],
  creadoEn: '2025-06-01T09:00:00Z',
  actualizadoEn: '2025-06-01T09:00:00Z',
}

describe('getQualityEventPermissions', () => {
  it('JEFE_CONTROL_DOCUMENTARIO: all action flags false, soloLectura true', () => {
    const perms = getQualityEventPermissions('ABIERTO', 'JEFE_CONTROL_DOCUMENTARIO', false)
    expect(perms.puedeEditarCabecera).toBe(false)
    expect(perms.puedeEditarCausaRaiz).toBe(false)
    expect(perms.puedeAvanzarEstado).toBe(false)
    expect(perms.puedeCerrar).toBe(false)
    expect(perms.puedeFirmarCierre).toBe(false)
    expect(perms.puedeVerificar).toBe(false)
    expect(perms.puedeReabrir).toBe(false)
    expect(perms.soloLectura).toBe(true)
  })

  it('ALTA_DIRECCION: soloLectura true, all action flags false', () => {
    const perms = getQualityEventPermissions('EN_EJECUCION', 'ALTA_DIRECCION', false)
    expect(perms.soloLectura).toBe(true)
    expect(perms.puedeEditarCabecera).toBe(false)
    expect(perms.puedeAvanzarEstado).toBe(false)
  })

  it('JEFE_CALIDAD_SYST EN_INVESTIGACION: puedeEditarCausaRaiz true', () => {
    const perms = getQualityEventPermissions('EN_INVESTIGACION', 'JEFE_CALIDAD_SYST', false)
    expect(perms.puedeEditarCausaRaiz).toBe(true)
  })

  it('SUPERVISOR ABIERTO esResponsable=true: puedeEditarCabecera true', () => {
    const perms = getQualityEventPermissions('ABIERTO', 'SUPERVISOR', true)
    expect(perms.puedeEditarCabecera).toBe(true)
  })

  it('SUPERVISOR EN_INVESTIGACION esResponsable=true: puedeEditarCabecera false', () => {
    const perms = getQualityEventPermissions('EN_INVESTIGACION', 'SUPERVISOR', true)
    expect(perms.puedeEditarCabecera).toBe(false)
  })

  it('SUPERVISOR PENDIENTE_CIERRE: puedeFirmarCierre true, puedeCerrar false', () => {
    const perms = getQualityEventPermissions('PENDIENTE_CIERRE', 'SUPERVISOR', false)
    expect(perms.puedeFirmarCierre).toBe(true)
    expect(perms.puedeCerrar).toBe(false)
  })

  it('JEFE_CALIDAD_SYST PENDIENTE_CIERRE: puedeCerrar true, puedeFirmarCierre false', () => {
    const perms = getQualityEventPermissions('PENDIENTE_CIERRE', 'JEFE_CALIDAD_SYST', false)
    expect(perms.puedeCerrar).toBe(true)
    expect(perms.puedeFirmarCierre).toBe(false)
  })

  it('AUDITOR_INTERNO EN_VERIFICACION esResponsable=true: puedeVerificar true, soloLectura false', () => {
    const perms = getQualityEventPermissions('EN_VERIFICACION', 'AUDITOR_INTERNO', true)
    expect(perms.puedeVerificar).toBe(true)
    expect(perms.soloLectura).toBe(false)
  })

  it('AUDITOR_INTERNO EN_EJECUCION esResponsable=false: soloLectura true, puedeVerificar false', () => {
    const perms = getQualityEventPermissions('EN_EJECUCION', 'AUDITOR_INTERNO', false)
    expect(perms.soloLectura).toBe(true)
    expect(perms.puedeVerificar).toBe(false)
  })

  it('JEFE_CALIDAD_SYST EN_VERIFICACION: puedeReabrir true', () => {
    const perms = getQualityEventPermissions('EN_VERIFICACION', 'JEFE_CALIDAD_SYST', false)
    expect(perms.puedeReabrir).toBe(true)
  })

  it('JEFE_CALIDAD_SYST VERIFICADO: puedeReabrir false', () => {
    const perms = getQualityEventPermissions('VERIFICADO', 'JEFE_CALIDAD_SYST', false)
    expect(perms.puedeReabrir).toBe(false)
  })

  it('OPERARIO: soloLectura true, all action flags false', () => {
    const perms = getQualityEventPermissions('ABIERTO', 'OPERARIO', false)
    expect(perms.soloLectura).toBe(true)
    expect(perms.puedeAvanzarEstado).toBe(false)
    expect(perms.puedeEditarCabecera).toBe(false)
  })

  it('ALTA_DIRECCION PENDIENTE_CIERRE esResponsable=true: puedeFirmarCierre true, soloLectura false', () => {
    const perms = getQualityEventPermissions('PENDIENTE_CIERRE', 'ALTA_DIRECCION', true)
    expect(perms.puedeFirmarCierre).toBe(true)
    expect(perms.soloLectura).toBe(false)
  })

  it('ALTA_DIRECCION PENDIENTE_CIERRE esResponsable=false: puedeFirmarCierre false, soloLectura true', () => {
    const perms = getQualityEventPermissions('PENDIENTE_CIERRE', 'ALTA_DIRECCION', false)
    expect(perms.puedeFirmarCierre).toBe(false)
    expect(perms.soloLectura).toBe(true)
  })

  it('JEFE_CALIDAD_SYST EN_VERIFICACION: puedeVerificar true', () => {
    const perms = getQualityEventPermissions('EN_VERIFICACION', 'JEFE_CALIDAD_SYST', false)
    expect(perms.puedeVerificar).toBe(true)
  })
})

describe('resolveRolSegundaFirma (RN-QE-004 escalation)', () => {
  it('returns SUPERVISOR for the normal JEFE_CALIDAD_SYST first signer', () => {
    expect(resolveRolSegundaFirma('user-005', 'Calidad')).toBe('SUPERVISOR')
  })

  it('returns ALTA_DIRECCION when the first signer doubles as the area supervisor', () => {
    expect(resolveRolSegundaFirma('user-999', 'Operaciones')).toBe('ALTA_DIRECCION')
  })

  it('returns SUPERVISOR when the first signer is SUPERVISOR of a different area', () => {
    expect(resolveRolSegundaFirma('user-003', 'Almacén Norte')).toBe('SUPERVISOR')
  })

  it('falls back to SUPERVISOR when the user cannot be found', () => {
    expect(resolveRolSegundaFirma('user-desconocido', 'Calidad')).toBe('SUPERVISOR')
  })
})

describe('validateTransitionToEnEjecucion (RN-QE-002)', () => {
  it('invalid when causaRaizDefinitiva is absent', () => {
    const result = validateTransitionToEnEjecucion({
      ...baseQE,
      causaRaizDefinitiva: undefined,
      causaRaizFirmadaEn: '2025-06-01T10:00:00Z',
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('invalid when causaRaizFirmadaEn is absent', () => {
    const result = validateTransitionToEnEjecucion({
      ...baseQE,
      causaRaizDefinitiva: 'Causa definida',
      causaRaizFirmadaEn: undefined,
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('valid when both fields are present', () => {
    const result = validateTransitionToEnEjecucion({
      ...baseQE,
      causaRaizDefinitiva: 'Causa definida con contenido',
      causaRaizFirmadaEn: '2025-06-01T10:00:00Z',
    })
    expect(result.valid).toBe(true)
    expect(result.reason).toBeUndefined()
  })
})

describe('validateTransitionToPendienteCierre (RN-QE-003)', () => {
  const acBase = {
    id: '1',
    qeId: 'qe-1',
    descripcion: '...',
    responsableId: 'u1',
    responsableNombre: 'Usuario Uno',
    plazoFecha: '2025-12-31',
    creadoEn: '2025-06-01T00:00:00Z',
    actualizadoEn: '2025-06-01T00:00:00Z',
  }

  it('invalid when AC has estado PENDIENTE without evidencia', () => {
    const result = validateTransitionToPendienteCierre({
      ...baseQE,
      accionesCorrectivas: [{ ...acBase, estado: 'PENDIENTE', descripcionEvidencia: undefined }],
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('invalid when AC is EN_EJECUCION without evidencia', () => {
    const result = validateTransitionToPendienteCierre({
      ...baseQE,
      accionesCorrectivas: [{ ...acBase, estado: 'EN_EJECUCION', descripcionEvidencia: undefined }],
    })
    expect(result.valid).toBe(false)
  })

  it('valid when all ACs have estado CERRADA', () => {
    const result = validateTransitionToPendienteCierre({
      ...baseQE,
      accionesCorrectivas: [{ ...acBase, estado: 'CERRADA', descripcionEvidencia: 'url-evidencia' }],
    })
    expect(result.valid).toBe(true)
  })

  it('valid when accionesCorrectivas is empty', () => {
    const result = validateTransitionToPendienteCierre({ ...baseQE, accionesCorrectivas: [] })
    expect(result.valid).toBe(true)
  })
})

describe('validateTransitionToCerrado (RN-QE-004)', () => {
  it('invalid when cerradoPorId is absent', () => {
    const result = validateTransitionToCerrado({
      ...baseQE,
      cerradoPorId: undefined,
      cierreFirmaSupervisorId: 'sup-1',
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('invalid when cierreFirmaSupervisorId is absent', () => {
    const result = validateTransitionToCerrado({
      ...baseQE,
      cerradoPorId: 'jc-1',
      cierreFirmaSupervisorId: undefined,
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('valid when both signatures are present', () => {
    const result = validateTransitionToCerrado({
      ...baseQE,
      cerradoPorId: 'jc-1',
      cierreFirmaSupervisorId: 'sup-1',
    })
    expect(result.valid).toBe(true)
    expect(result.reason).toBeUndefined()
  })
})
