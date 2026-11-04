import type { ParametrosSesion } from '../../features/sesion/types/sesion.types'

// Stores mutables de la política de sesión (sesion-timeout-inactividad design.md D15) — espejo
// de parametros_sesion / configuraciones_seguridad_empresa / configuracion_sesion_audit_trail y
// de los campos SesionIniciadaEn/UltimaActividadEn del refresh token real.

export const PARAMETROS_SESION_SEMILLA: ParametrosSesion = {
  inactividadDefaultMinutos: 30,
  inactividadMinMinutos: 5,
  inactividadMaxMinutos: 240,
  sesionMaximaDefaultHoras: 12,
  sesionMaximaMinHoras: 1,
  sesionMaximaMaxHoras: 24,
  actualizadoPorId: null,
  actualizadoPorNombre: null,
  actualizadoEn: null,
}

export interface MockConfiguracionSeguridadEmpresa {
  inactividadMinutos: number | null
  sesionMaximaHoras: number | null
  actualizadoPorId: string
  actualizadoPorNombre: string
  actualizadoEn: string
}

export interface MockConfiguracionSesionAudit {
  ambito: 'GLOBAL' | 'EMPRESA'
  empresaId: string | null
  campo: string
  valorAnterior: string | null
  valorNuevo: string | null
  realizadoPorId: string
  realizadoPorNombre: string
  timestamp: string
}

/** Estado de la sesión original detrás de un refresh token mock — se hereda en cada rotación. */
export interface MockSesion {
  userId: string
  sesionIniciadaEn: number
  ultimaActividadEn: number
}

let parametros: ParametrosSesion = { ...PARAMETROS_SESION_SEMILLA }
const configuracionesEmpresa = new Map<string, MockConfiguracionSeguridadEmpresa>()
const auditoria: MockConfiguracionSesionAudit[] = []
const sesiones = new Map<string, MockSesion>()
const tokensRevocados = new Set<string>()

export function getParametrosSesionStore(): ParametrosSesion {
  return parametros
}

export function setParametrosSesionStore(next: ParametrosSesion): void {
  parametros = next
}

export function getConfiguracionesSeguridadStore(): Map<string, MockConfiguracionSeguridadEmpresa> {
  return configuracionesEmpresa
}

export function getAuditoriaSesionStore(): MockConfiguracionSesionAudit[] {
  return auditoria
}

export function getSesionesMockStore(): Map<string, MockSesion> {
  return sesiones
}

export function getTokensRevocadosMockStore(): Set<string> {
  return tokensRevocados
}

export function resetSesionStores(): void {
  parametros = { ...PARAMETROS_SESION_SEMILLA }
  configuracionesEmpresa.clear()
  auditoria.length = 0
  sesiones.clear()
  tokensRevocados.clear()
}
