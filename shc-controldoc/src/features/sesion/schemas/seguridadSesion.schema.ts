import { z } from 'zod'
import type { ParametrosSesionInput, SeguridadSesionEmpresaInput } from '../types/sesion.types'
import { RANGO_ABSOLUTO } from '../utils/politicaSesion'

// Los límites nunca se duplican aquí: el schema de empresa se construye con los parámetros
// globales que devuelve el servidor (GET /api/empresas/{id}/seguridad-sesion → parametrosGlobales),
// y el de parámetros globales usa los mismos rangos absolutos que el backend (RANGO_ABSOLUTO,
// espejo de PoliticaSesionReglas). Inputs numéricos con `valueAsNumber`: vacío llega como NaN.
const numeroOVacio = z.number().or(z.nan())

function validarEntero(
  ctx: z.RefinementCtx,
  path: string,
  value: number,
  min: number,
  max: number,
): boolean {
  if (Number.isNaN(value)) {
    ctx.addIssue({ code: 'custom', path: [path], message: 'sesion:errors.required' })
    return false
  }
  if (!Number.isInteger(value)) {
    ctx.addIssue({ code: 'custom', path: [path], message: 'sesion:errors.integer' })
    return false
  }
  if (value < min || value > max) {
    ctx.addIssue({ code: 'custom', path: [path], message: 'sesion:errors.outOfRange' })
    return false
  }
  return true
}

export function buildSeguridadSesionSchema(parametros: ParametrosSesionInput) {
  return z
    .object({
      usarDefaultInactividad: z.boolean(),
      inactividadMinutos: numeroOVacio,
      usarDefaultSesionMaxima: z.boolean(),
      sesionMaximaHoras: numeroOVacio,
    })
    .superRefine((values, ctx) => {
      const inactividadOk =
        values.usarDefaultInactividad ||
        validarEntero(ctx, 'inactividadMinutos', values.inactividadMinutos, parametros.inactividadMinMinutos, parametros.inactividadMaxMinutos)
      const sesionOk =
        values.usarDefaultSesionMaxima ||
        validarEntero(ctx, 'sesionMaximaHoras', values.sesionMaximaHoras, parametros.sesionMaximaMinHoras, parametros.sesionMaximaMaxHoras)
      if (!inactividadOk || !sesionOk) return

      const inactividad = values.usarDefaultInactividad ? parametros.inactividadDefaultMinutos : values.inactividadMinutos
      const sesionMaxima = values.usarDefaultSesionMaxima ? parametros.sesionMaximaDefaultHoras : values.sesionMaximaHoras
      if (sesionMaxima * 60 < inactividad) {
        ctx.addIssue({
          code: 'custom',
          path: [values.usarDefaultSesionMaxima ? 'inactividadMinutos' : 'sesionMaximaHoras'],
          message: 'sesion:errors.sesionMenorQueInactividad',
        })
      }
    })
}

export type SeguridadSesionFormValues = z.infer<ReturnType<typeof buildSeguridadSesionSchema>>

export function toSeguridadSesionInput(values: SeguridadSesionFormValues): SeguridadSesionEmpresaInput {
  return {
    inactividadMinutos: values.usarDefaultInactividad ? null : values.inactividadMinutos,
    sesionMaximaHoras: values.usarDefaultSesionMaxima ? null : values.sesionMaximaHoras,
  }
}

export const parametrosSesionSchema = z
  .object({
    inactividadDefaultMinutos: numeroOVacio,
    inactividadMinMinutos: numeroOVacio,
    inactividadMaxMinutos: numeroOVacio,
    sesionMaximaDefaultHoras: numeroOVacio,
    sesionMaximaMinHoras: numeroOVacio,
    sesionMaximaMaxHoras: numeroOVacio,
  })
  .superRefine((v, ctx) => {
    const a = RANGO_ABSOLUTO
    const okIMin = validarEntero(ctx, 'inactividadMinMinutos', v.inactividadMinMinutos, a.inactividadMinMinutos, a.inactividadMaxMinutos)
    const okIMax = validarEntero(ctx, 'inactividadMaxMinutos', v.inactividadMaxMinutos, a.inactividadMinMinutos, a.inactividadMaxMinutos)
    const okSMin = validarEntero(ctx, 'sesionMaximaMinHoras', v.sesionMaximaMinHoras, a.sesionMaximaMinHoras, a.sesionMaximaMaxHoras)
    const okSMax = validarEntero(ctx, 'sesionMaximaMaxHoras', v.sesionMaximaMaxHoras, a.sesionMaximaMinHoras, a.sesionMaximaMaxHoras)

    let okIDef = false
    if (okIMin && okIMax) {
      if (v.inactividadMinMinutos > v.inactividadMaxMinutos) {
        ctx.addIssue({ code: 'custom', path: ['inactividadMaxMinutos'], message: 'sesion:errors.maxMenorQueMin' })
      } else {
        okIDef = validarEntero(ctx, 'inactividadDefaultMinutos', v.inactividadDefaultMinutos, v.inactividadMinMinutos, v.inactividadMaxMinutos)
      }
    }
    let okSDef = false
    if (okSMin && okSMax) {
      if (v.sesionMaximaMinHoras > v.sesionMaximaMaxHoras) {
        ctx.addIssue({ code: 'custom', path: ['sesionMaximaMaxHoras'], message: 'sesion:errors.maxMenorQueMin' })
      } else {
        okSDef = validarEntero(ctx, 'sesionMaximaDefaultHoras', v.sesionMaximaDefaultHoras, v.sesionMaximaMinHoras, v.sesionMaximaMaxHoras)
      }
    }
    if (okIDef && okSDef && v.sesionMaximaDefaultHoras * 60 < v.inactividadDefaultMinutos) {
      ctx.addIssue({ code: 'custom', path: ['sesionMaximaDefaultHoras'], message: 'sesion:errors.sesionMenorQueInactividad' })
    }
  })

export type ParametrosSesionFormValues = z.infer<typeof parametrosSesionSchema>
