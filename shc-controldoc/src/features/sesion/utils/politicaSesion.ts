import type { ParametrosSesionInput, PoliticaSesion } from '../types/sesion.types'

// Espejo puro de ShcMvpEndPoint/Features/SeguridadSesion/Shared/PoliticaSesionReglas.cs
// (sesion-timeout-inactividad design.md D2/D3). Lo usan los handlers MSW y los schemas Zod. Si
// cambias una regla aquí, cámbiala también en el backend.

/** Rangos absolutos (D2): los límites globales nunca pueden salir de aquí. */
export const RANGO_ABSOLUTO = {
  inactividadMinMinutos: 5,
  inactividadMaxMinutos: 1440,
  sesionMaximaMinHoras: 1,
  sesionMaximaMaxHoras: 168,
} as const

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/** Valor de la empresa (o default global si es null), ajustado a los límites, y nunca una
 *  inactividad mayor que la sesión máxima. Sin argumentos de empresa = política global. */
export function resolverPolitica(
  p: ParametrosSesionInput,
  inactividadEmpresa: number | null = null,
  sesionMaximaEmpresa: number | null = null,
): PoliticaSesion {
  const inactividad = clamp(
    inactividadEmpresa ?? p.inactividadDefaultMinutos,
    p.inactividadMinMinutos,
    p.inactividadMaxMinutos,
  )
  const sesionMaximaHoras = clamp(
    sesionMaximaEmpresa ?? p.sesionMaximaDefaultHoras,
    p.sesionMaximaMinHoras,
    p.sesionMaximaMaxHoras,
  )
  return { inactividadMinutos: Math.min(inactividad, sesionMaximaHoras * 60), sesionMaximaHoras }
}

export type ErroresPorCampo = Record<string, string>

export function validarSeguridadEmpresa(
  p: ParametrosSesionInput,
  inactividad: number | null,
  sesionMaxima: number | null,
): ErroresPorCampo {
  const errores: ErroresPorCampo = {}
  if (inactividad !== null && (inactividad < p.inactividadMinMinutos || inactividad > p.inactividadMaxMinutos)) {
    errores.inactividadMinutos = `Debe estar entre ${p.inactividadMinMinutos} y ${p.inactividadMaxMinutos} minutos.`
  }
  if (sesionMaxima !== null && (sesionMaxima < p.sesionMaximaMinHoras || sesionMaxima > p.sesionMaximaMaxHoras)) {
    errores.sesionMaximaHoras = `Debe estar entre ${p.sesionMaximaMinHoras} y ${p.sesionMaximaMaxHoras} horas.`
  }
  if (Object.keys(errores).length === 0) {
    const inactividadEfectiva = inactividad ?? p.inactividadDefaultMinutos
    const sesionEfectiva = sesionMaxima ?? p.sesionMaximaDefaultHoras
    if (sesionEfectiva * 60 < inactividadEfectiva) {
      errores.sesionMaximaHoras =
        'La duración máxima de sesión no puede ser menor que el tiempo de inactividad.'
    }
  }
  return errores
}

export function validarParametros(p: ParametrosSesionInput): ErroresPorCampo {
  const errores: ErroresPorCampo = {}
  const rango = (campo: keyof ParametrosSesionInput, min: number, max: number, unidad: string) => {
    const valor = p[campo]
    if (!Number.isInteger(valor) || valor < min || valor > max) {
      errores[campo] = `Debe estar entre ${min} y ${max} ${unidad}.`
    }
  }
  const { inactividadMinMinutos: aMin, inactividadMaxMinutos: aMax, sesionMaximaMinHoras: sMin, sesionMaximaMaxHoras: sMax } =
    RANGO_ABSOLUTO

  rango('inactividadMinMinutos', aMin, aMax, 'minutos')
  rango('inactividadMaxMinutos', aMin, aMax, 'minutos')
  rango('sesionMaximaMinHoras', sMin, sMax, 'horas')
  rango('sesionMaximaMaxHoras', sMin, sMax, 'horas')

  if (!errores.inactividadMinMinutos && !errores.inactividadMaxMinutos && p.inactividadMinMinutos > p.inactividadMaxMinutos) {
    errores.inactividadMaxMinutos = 'El máximo no puede ser menor que el mínimo.'
  }
  if (!errores.sesionMaximaMinHoras && !errores.sesionMaximaMaxHoras && p.sesionMaximaMinHoras > p.sesionMaximaMaxHoras) {
    errores.sesionMaximaMaxHoras = 'El máximo no puede ser menor que el mínimo.'
  }
  if (p.inactividadDefaultMinutos < p.inactividadMinMinutos || p.inactividadDefaultMinutos > p.inactividadMaxMinutos) {
    errores.inactividadDefaultMinutos ??= `Debe estar entre ${p.inactividadMinMinutos} y ${p.inactividadMaxMinutos} minutos.`
  }
  if (p.sesionMaximaDefaultHoras < p.sesionMaximaMinHoras || p.sesionMaximaDefaultHoras > p.sesionMaximaMaxHoras) {
    errores.sesionMaximaDefaultHoras ??= `Debe estar entre ${p.sesionMaximaMinHoras} y ${p.sesionMaximaMaxHoras} horas.`
  }
  if (!errores.sesionMaximaDefaultHoras && !errores.inactividadDefaultMinutos && p.sesionMaximaDefaultHoras * 60 < p.inactividadDefaultMinutos) {
    errores.sesionMaximaDefaultHoras =
      'La duración máxima de sesión no puede ser menor que el tiempo de inactividad.'
  }
  return errores
}

/** Formato de error del backend (`FieldValidationException`): `"campo: mensaje"`. */
export function toFieldErrorStrings(errores: ErroresPorCampo): string[] {
  return Object.entries(errores).map(([campo, msg]) => `${campo}: ${msg}`)
}

