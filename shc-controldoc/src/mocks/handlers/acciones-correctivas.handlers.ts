import { http, HttpResponse, delay } from 'msw'
import { useAuthStore } from '../../stores/authStore'
import {
  AC_TIPOS,
  ROLES_OPERATIVOS,
  ROLES_RESPONSABLE_POR_TIPO_AC,
  isAccionCorrectivaTipo,
  type AccionCorrectivaTipo,
} from '../../constants/accionCorrectivaTipo.constants'
import { getCandidatosResponsableAC } from './shared/candidatosUsuarios'
import { autorizarEmpresa } from './sesion.handlers'
import { getAuditoriaSesionStore } from '../fixtures/sesion.fixtures'
import { getConfiguracionesResponsablesAcStore, getRolesResponsableAC } from '../fixtures/responsablesAc.fixtures'
import type { ConfiguracionResponsablesAc } from '../../features/acciones-correctivas/types/responsablesAc.types'
import type { UserRole } from '../../types/auth.types'

const LATENCY = 400

const ERROR_TIPOS = 'Debe incluir los tipos CORRECTIVA, PREVENTIVA y MEJORA, una vez cada uno.'

function toConfiguracionDto(empresaId: string): ConfiguracionResponsablesAc {
  const config = getConfiguracionesResponsablesAcStore().get(empresaId) ?? {}
  const filas = AC_TIPOS.flatMap((tipo) => config[tipo] ?? [])
  const ultima = filas.reduce<(typeof filas)[number] | null>(
    (max, f) => (!max || f.actualizadoEn > max.actualizadoEn ? f : max),
    null,
  )
  return {
    empresaId,
    tipos: AC_TIPOS.map((tipo) => ({
      tipo,
      roles: [...getRolesResponsableAC(empresaId, tipo)],
      esDefault: !config[tipo],
    })),
    rolesDisponibles: [...ROLES_OPERATIVOS],
    actualizadoPorNombre: ultima?.actualizadoPorNombre ?? null,
    actualizadoEn: ultima?.actualizadoEn ?? null,
  }
}

// Espejo de ConfiguracionResponsablesAcHandler.Validar (D4). Devuelve los roles en orden canónico o
// los errores por campo ("campo: mensaje", mismo formato que FieldValidationException).
function validar(body: unknown): { tipos: Map<AccionCorrectivaTipo, UserRole[]> } | { errors: string[] } {
  const entradas = (body as { tipos?: unknown } | null)?.tipos
  const lista = Array.isArray(entradas) ? (entradas as { tipo?: unknown; roles?: unknown }[]) : []
  const errores = new Map<string, string>()
  const tipos = new Map<AccionCorrectivaTipo, UserRole[]>()
  const vistos = new Set<AccionCorrectivaTipo>()

  lista.forEach((entrada, i) => {
    if (!isAccionCorrectivaTipo(entrada.tipo) || vistos.has(entrada.tipo)) {
      errores.set('tipos', ERROR_TIPOS)
      return
    }
    vistos.add(entrada.tipo)
    const roles = Array.isArray(entrada.roles) ? (entrada.roles as unknown[]) : []
    const campo = `tipos[${i}].roles`
    if (roles.length === 0) {
      errores.set(campo, 'Selecciona al menos un rol.')
      return
    }
    const invalido = roles.find((r) => !(ROLES_OPERATIVOS as readonly unknown[]).includes(r))
    if (invalido !== undefined) {
      errores.set(campo, `Rol no permitido como responsable de una acción: ${String(invalido)}`)
      return
    }
    tipos.set(entrada.tipo, ROLES_OPERATIVOS.filter((r) => roles.includes(r)))
  })

  if (vistos.size !== AC_TIPOS.length) {
    errores.set('tipos', ERROR_TIPOS)
  }
  if (errores.size > 0) return { errors: [...errores].map(([campo, msg]) => `${campo}: ${msg}`) }
  return { tipos }
}

function registrarAuditoria(
  empresaId: string,
  tipo: AccionCorrectivaTipo,
  anterior: readonly UserRole[],
  nuevo: readonly UserRole[],
  actor: { id: string; nombre: string },
  timestamp: string,
): boolean {
  const valorAnterior = anterior.join(',')
  const valorNuevo = nuevo.join(',')
  if (valorAnterior === valorNuevo) return false
  getAuditoriaSesionStore().push({
    ambito: 'EMPRESA',
    empresaId,
    campo: `responsablesAc.${tipo}`,
    valorAnterior,
    valorNuevo,
    realizadoPorId: actor.id,
    realizadoPorNombre: actor.nombre,
    timestamp,
  })
  return true
}

// Transversal a QE/NC/incidente (ac-tipo-responsables) — espejo de CandidatosResponsableACEndpoint
// y de ConfiguracionResponsablesAcEndpoint (ac-responsables-configurable-empresa).
export const accionesCorrectivasHandlers = [
  http.get('/api/acciones-correctivas/candidatos-responsable', async ({ request }) => {
    await delay(LATENCY)
    const empresaId = useAuthStore.getState().empresaActivaId
    if (!empresaId) {
      return HttpResponse.json({ success: false, message: 'Sesión sin empresa activa' }, { status: 401 })
    }
    const tipo = new URL(request.url).searchParams.get('tipo')
    if (!isAccionCorrectivaTipo(tipo)) {
      return HttpResponse.json(
        { success: false, message: "El parámetro 'tipo' debe ser CORRECTIVA, PREVENTIVA o MEJORA." },
        { status: 400 },
      )
    }
    return HttpResponse.json({ success: true, data: getCandidatosResponsableAC(empresaId, tipo) })
  }),

  http.get('/api/empresas/:id/responsables-ac', async ({ params, request }) => {
    await delay(LATENCY)
    const empresaId = params.id as string
    const auth = autorizarEmpresa(request, empresaId)
    if ('error' in auth) return auth.error
    return HttpResponse.json({ success: true, data: toConfiguracionDto(empresaId) })
  }),

  http.put('/api/empresas/:id/responsables-ac', async ({ params, request }) => {
    await delay(LATENCY)
    const empresaId = params.id as string
    const auth = autorizarEmpresa(request, empresaId)
    if ('error' in auth) return auth.error

    const resultado = validar(await request.json())
    if ('errors' in resultado) {
      return HttpResponse.json(
        { success: false, data: null, message: 'Error de validación.', errors: resultado.errors },
        { status: 400 },
      )
    }

    const store = getConfiguracionesResponsablesAcStore()
    const config = { ...(store.get(empresaId) ?? {}) }
    const actor = { id: auth.user.id, nombre: `${auth.user.nombre} ${auth.user.apellido}` }
    const ahora = new Date().toISOString()
    for (const [tipo, roles] of resultado.tipos) {
      if (registrarAuditoria(empresaId, tipo, getRolesResponsableAC(empresaId, tipo), roles, actor, ahora)) {
        config[tipo] = { roles, actualizadoPorId: actor.id, actualizadoPorNombre: actor.nombre, actualizadoEn: ahora }
      }
    }
    store.set(empresaId, config)
    return HttpResponse.json({ success: true, data: toConfiguracionDto(empresaId) })
  }),

  http.post('/api/empresas/:id/responsables-ac/restablecer', async ({ params, request }) => {
    await delay(LATENCY)
    const empresaId = params.id as string
    const auth = autorizarEmpresa(request, empresaId)
    if ('error' in auth) return auth.error

    const actor = { id: auth.user.id, nombre: `${auth.user.nombre} ${auth.user.apellido}` }
    const ahora = new Date().toISOString()
    for (const tipo of AC_TIPOS) {
      registrarAuditoria(empresaId, tipo, getRolesResponsableAC(empresaId, tipo), ROLES_RESPONSABLE_POR_TIPO_AC[tipo], actor, ahora)
    }
    getConfiguracionesResponsablesAcStore().delete(empresaId)
    return HttpResponse.json({ success: true, data: toConfiguracionDto(empresaId) })
  }),
]
