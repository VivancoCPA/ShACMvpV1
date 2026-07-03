import type { QEStatus, QualityEvent } from '../types/qualityEvent.types'
import type { QEPermissions } from '../types/qualityEventPermissions.types'
import type { UserRole } from '../../../types/auth.types'
import { userFixtures } from '../../../mocks/fixtures/users.fixtures'

const DENY_ALL: QEPermissions = {
  puedeEditarCabecera: false,
  puedeEditarCausaRaiz: false,
  puedeAvanzarEstado: false,
  puedeCerrar: false,
  puedeFirmarCierre: false,
  puedeVerificar: false,
  puedeReabrir: false,
  soloLectura: true,
}

export function getQualityEventPermissions(
  estado: QEStatus,
  rol: UserRole,
  esResponsable: boolean,
): QEPermissions {
  switch (rol) {
    case 'OPERARIO':
      return { ...DENY_ALL, soloLectura: true }

    case 'SUPERVISOR': {
      const puedeEditarCabecera = estado === 'ABIERTO' && esResponsable
      const puedeAvanzarEstado = estado === 'ABIERTO'
      const puedeFirmarCierre = estado === 'PENDIENTE_CIERRE'
      return {
        ...DENY_ALL,
        puedeEditarCabecera,
        puedeAvanzarEstado,
        puedeFirmarCierre,
        soloLectura: false,
      }
    }

    case 'JEFE_CALIDAD_SYST': {
      const puedeEditarCabecera = estado === 'ABIERTO'
      const puedeEditarCausaRaiz =
        estado === 'EN_INVESTIGACION' || estado === 'ANALISIS_COMPLETADO'
      const puedeAvanzarEstado = estado !== 'VERIFICADO'
      const puedeCerrar = estado === 'PENDIENTE_CIERRE'
      const puedeVerificar = estado === 'EN_VERIFICACION'
      const puedeReabrir = estado === 'EN_VERIFICACION'
      return {
        ...DENY_ALL,
        puedeEditarCabecera,
        puedeEditarCausaRaiz,
        puedeAvanzarEstado,
        puedeCerrar,
        puedeVerificar,
        puedeReabrir,
        soloLectura: false,
      }
    }

    case 'AUDITOR_INTERNO': {
      const puedeVerificar = estado === 'EN_VERIFICACION' && esResponsable
      return {
        ...DENY_ALL,
        puedeVerificar,
        soloLectura: !puedeVerificar,
      }
    }

    case 'ALTA_DIRECCION': {
      const puedeFirmarCierre = estado === 'PENDIENTE_CIERRE' && esResponsable
      return {
        ...DENY_ALL,
        puedeFirmarCierre,
        soloLectura: !puedeFirmarCierre,
      }
    }

    case 'JEFE_CONTROL_DOCUMENTARIO':
      return { ...DENY_ALL, soloLectura: true }
  }
}

export function resolveRolSegundaFirma(
  primerFirmanteId: string,
  areaAfectada: string,
): 'SUPERVISOR' | 'ALTA_DIRECCION' {
  const firmante = userFixtures.find((u) => u.id === primerFirmanteId)
  if (firmante?.rol === 'SUPERVISOR' && firmante.area === areaAfectada) {
    return 'ALTA_DIRECCION'
  }
  return 'SUPERVISOR'
}

export function validateTransitionToEnEjecucion(qe: QualityEvent): {
  valid: boolean
  reason?: string
} {
  if (!qe.causaRaizDefinitiva || !qe.causaRaizFirmadaEn) {
    return {
      valid: false,
      reason: 'Se requiere causa raíz definitiva aprobada y firmada antes de pasar a EN_EJECUCION',
    }
  }
  return { valid: true }
}

export function validateTransitionToPendienteCierre(qe: QualityEvent): {
  valid: boolean
  reason?: string
} {
  const bloqueada = qe.accionesCorrectivas.some(
    (ac) =>
      (ac.estado === 'PENDIENTE' || ac.estado === 'EN_EJECUCION') &&
      (!ac.descripcionEvidencia || ac.descripcionEvidencia.trim() === ''),
  )
  if (bloqueada) {
    return {
      valid: false,
      reason: 'Existen acciones correctivas pendientes o en ejecución sin evidencia',
    }
  }
  return { valid: true }
}

export function validateTransitionToCerrado(qe: QualityEvent): {
  valid: boolean
  reason?: string
} {
  if (!qe.cerradoPorId || !qe.cierreFirmaSupervisorId) {
    return {
      valid: false,
      reason: 'Se requiere firma dual: Jefe Calidad y Supervisor',
    }
  }
  return { valid: true }
}
