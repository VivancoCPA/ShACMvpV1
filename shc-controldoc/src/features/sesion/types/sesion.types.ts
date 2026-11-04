// Contratos de sesion-timeout-inactividad (design.md D9) — espejo de
// ShcMvpEndPoint/Features/SeguridadSesion/Shared/SeguridadSesionDtos.cs.

export interface ParametrosSesion {
  inactividadDefaultMinutos: number
  inactividadMinMinutos: number
  inactividadMaxMinutos: number
  sesionMaximaDefaultHoras: number
  sesionMaximaMinHoras: number
  sesionMaximaMaxHoras: number
  actualizadoPorId?: string | null
  actualizadoPorNombre?: string | null
  actualizadoEn?: string | null
}

export type ParametrosSesionInput = Pick<
  ParametrosSesion,
  | 'inactividadDefaultMinutos'
  | 'inactividadMinMinutos'
  | 'inactividadMaxMinutos'
  | 'sesionMaximaDefaultHoras'
  | 'sesionMaximaMinHoras'
  | 'sesionMaximaMaxHoras'
>

export interface PoliticaSesion {
  inactividadMinutos: number
  sesionMaximaHoras: number
}

/** `null` = "Usar valor por defecto del sistema". */
export interface SeguridadSesionEmpresaInput {
  inactividadMinutos: number | null
  sesionMaximaHoras: number | null
}

export interface SeguridadSesionEmpresa extends SeguridadSesionEmpresaInput {
  empresaId: string
  efectiva: PoliticaSesion
  parametrosGlobales: ParametrosSesion
  actualizadoPorId?: string | null
  actualizadoPorNombre?: string | null
  actualizadoEn?: string | null
}

/** Respuesta de `GET /api/auth/politica-sesion` y `POST /api/auth/actividad`. */
export interface EstadoSesion extends PoliticaSesion {
  sesionIniciadaEn: string | null
  ultimaActividadEn: string | null
}

export const SESION_INACTIVA = 'SESION_INACTIVA'
export const SESION_MAXIMA_ALCANZADA = 'SESION_MAXIMA_ALCANZADA'

/** Motivo de cierre de sesión que el login muestra al usuario. */
export type SessionEndReason = 'INACTIVIDAD' | 'SESION_MAXIMA'
