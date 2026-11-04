import { http, HttpResponse, delay } from 'msw'
import { getSessionUser } from './shared/session'
import { getEmpresasStore } from '../fixtures/empresas.fixtures'
import {
  getAuditoriaSesionStore,
  getConfiguracionesSeguridadStore,
  getParametrosSesionStore,
  getSesionesMockStore,
  getTokensRevocadosMockStore,
  setParametrosSesionStore,
  type MockSesion,
} from '../fixtures/sesion.fixtures'
import {
  resolverPolitica,
  toFieldErrorStrings,
  validarParametros,
  validarSeguridadEmpresa,
} from '../../features/sesion/utils/politicaSesion'
import {
  SESION_INACTIVA,
  SESION_MAXIMA_ALCANZADA,
  type EstadoSesion,
  type ParametrosSesionInput,
  type PoliticaSesion,
  type SeguridadSesionEmpresa,
  type SeguridadSesionEmpresaInput,
} from '../../features/sesion/types/sesion.types'
import { useAuthStore } from '../../stores/authStore'

const LATENCY = 400
const REFRESH_HEADER = 'x-mock-refresh-token'
const EMPRESA_ACTIVA_HEADER = 'x-mock-empresa-activa'

function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ success: true, data }, { status })
}

function err(message: string, status: number, extra?: { errorCode?: string; errors?: string[] }) {
  return HttpResponse.json({ success: false, data: null, message, ...extra }, { status })
}

// ---------- Sesiones mock (espejo de RefreshToken.SesionIniciadaEn/UltimaActividadEn) ----------

/** Login: nace una sesión nueva detrás de `refreshToken`. */
export function iniciarSesionMock(refreshToken: string, userId: string): void {
  const ahora = Date.now()
  getSesionesMockStore().set(refreshToken, { userId, sesionIniciadaEn: ahora, ultimaActividadEn: ahora })
}

/** Rotación de /refresh: el token nuevo hereda la sesión original (nunca la reinicia). Un token
 *  persistido en localStorage antes de un reload de la página no tiene entrada (los stores MSW
 *  viven en memoria) — se trata como una sesión que empieza ahora. */
export function rotarSesionMock(tokenAnterior: string, tokenNuevo: string, userId: string): void {
  const sesiones = getSesionesMockStore()
  const sesion = sesiones.get(tokenAnterior)
  sesiones.delete(tokenAnterior)
  getTokensRevocadosMockStore().add(tokenAnterior)
  if (sesion) sesiones.set(tokenNuevo, sesion)
  else iniciarSesionMock(tokenNuevo, userId)
}

export function cerrarSesionMock(refreshToken: string | null): void {
  if (!refreshToken) return
  getSesionesMockStore().delete(refreshToken)
  getTokensRevocadosMockStore().add(refreshToken)
}

export function politicaEfectivaMock(empresaId: string | null): PoliticaSesion {
  const parametros = getParametrosSesionStore()
  if (!empresaId) return resolverPolitica(parametros)
  const config = getConfiguracionesSeguridadStore().get(empresaId)
  return resolverPolitica(parametros, config?.inactividadMinutos ?? null, config?.sesionMaximaHoras ?? null)
}

export type VerificacionSesionMock =
  | { ok: true; politica: PoliticaSesion; sesion: MockSesion | undefined }
  | { ok: false; errorCode: string; message: string }

/** Mismas comprobaciones que SesionPoliticaEnforcer (sesión máxima → inactividad). Si alguna
 *  vence, la sesión mock se invalida. */
export function verificarSesionMock(refreshToken: string, empresaId: string | null): VerificacionSesionMock {
  const politica = politicaEfectivaMock(empresaId)
  const sesion = getSesionesMockStore().get(refreshToken)
  if (!sesion) return { ok: true, politica, sesion }

  const ahora = Date.now()
  if (ahora - sesion.sesionIniciadaEn > politica.sesionMaximaHoras * 3_600_000) {
    cerrarSesionMock(refreshToken)
    return { ok: false, errorCode: SESION_MAXIMA_ALCANZADA, message: 'Tu sesión alcanzó la duración máxima' }
  }
  if (ahora - sesion.ultimaActividadEn > politica.inactividadMinutos * 60_000) {
    cerrarSesionMock(refreshToken)
    return { ok: false, errorCode: SESION_INACTIVA, message: 'Tu sesión se cerró por inactividad' }
  }
  return { ok: true, politica, sesion }
}

export function isRefreshTokenRevocadoMock(refreshToken: string): boolean {
  return getTokensRevocadosMockStore().has(refreshToken)
}

function toEstado(politica: PoliticaSesion, sesion: MockSesion | undefined): EstadoSesion {
  return {
    ...politica,
    sesionIniciadaEn: sesion ? new Date(sesion.sesionIniciadaEn).toISOString() : null,
    ultimaActividadEn: sesion ? new Date(sesion.ultimaActividadEn).toISOString() : null,
  }
}

// ---------- Configuración ----------

function registrarAuditoria(
  ambito: 'GLOBAL' | 'EMPRESA',
  empresaId: string | null,
  campo: string,
  anterior: number | null | undefined,
  nuevo: number | null,
  actor: { id: string; nombre: string },
  timestamp: string,
): boolean {
  if ((anterior ?? null) === nuevo) return false
  getAuditoriaSesionStore().push({
    ambito,
    empresaId,
    campo,
    valorAnterior: anterior === null || anterior === undefined ? null : String(anterior),
    valorNuevo: nuevo === null ? null : String(nuevo),
    realizadoPorId: actor.id,
    realizadoPorNombre: actor.nombre,
    timestamp,
  })
  return true
}

function toSeguridadEmpresaDto(empresaId: string): SeguridadSesionEmpresa {
  const parametros = getParametrosSesionStore()
  const config = getConfiguracionesSeguridadStore().get(empresaId)
  const inactividadMinutos = config?.inactividadMinutos ?? null
  const sesionMaximaHoras = config?.sesionMaximaHoras ?? null
  return {
    empresaId,
    inactividadMinutos,
    sesionMaximaHoras,
    efectiva: resolverPolitica(parametros, inactividadMinutos, sesionMaximaHoras),
    parametrosGlobales: parametros,
    actualizadoPorId: config?.actualizadoPorId ?? null,
    actualizadoPorNombre: config?.actualizadoPorNombre ?? null,
    actualizadoEn: config?.actualizadoEn ?? null,
  }
}

/** ADMINISTRADOR_EMPRESA solo su empresa activa (otra → 404); SUPERADMIN cualquiera; resto 403. */
function autorizarEmpresa(request: Request, empresaId: string) {
  const user = getSessionUser(request)
  if (!user) return { error: err('Sesión expirada', 401) } as const
  if (user.rol !== 'ADMINISTRADOR_EMPRESA' && user.rol !== 'SUPERADMIN') {
    return { error: err('No autorizado', 403) } as const
  }
  if (user.rol === 'ADMINISTRADOR_EMPRESA' && useAuthStore.getState().empresaActivaId !== empresaId) {
    return { error: err('Empresa no encontrada', 404) } as const
  }
  if (!getEmpresasStore().some((e) => e.id === empresaId)) {
    return { error: err('Empresa no encontrada', 404) } as const
  }
  return { user } as const
}

export const sesionHandlers = [
  http.get('/api/auth/politica-sesion', async ({ request }) => {
    await delay(LATENCY)
    const user = getSessionUser(request)
    if (!user) return err('Sesión expirada', 401)
    const empresaId = user.rol === 'SUPERADMIN' ? null : useAuthStore.getState().empresaActivaId
    const refreshToken = request.headers.get(REFRESH_HEADER)
    const sesion = refreshToken ? getSesionesMockStore().get(refreshToken) : undefined
    return ok(toEstado(politicaEfectivaMock(empresaId), sesion))
  }),

  http.post('/api/auth/actividad', async ({ request }) => {
    await delay(LATENCY)
    const refreshToken = request.headers.get(REFRESH_HEADER)
    if (!refreshToken || isRefreshTokenRevocadoMock(refreshToken)) return err('Sesión expirada', 401)
    const empresaId = request.headers.get(EMPRESA_ACTIVA_HEADER)
    const verificacion = verificarSesionMock(refreshToken, empresaId)
    if (!verificacion.ok) {
      return err(verificacion.message, 401, { errorCode: verificacion.errorCode })
    }
    const sesion = verificacion.sesion
    if (sesion) sesion.ultimaActividadEn = Date.now()
    return ok(toEstado(verificacion.politica, sesion))
  }),

  http.get('/api/empresas/:id/seguridad-sesion', async ({ params, request }) => {
    await delay(LATENCY)
    const empresaId = params.id as string
    const auth = autorizarEmpresa(request, empresaId)
    if ('error' in auth) return auth.error
    return ok(toSeguridadEmpresaDto(empresaId))
  }),

  http.put('/api/empresas/:id/seguridad-sesion', async ({ params, request }) => {
    await delay(LATENCY)
    const empresaId = params.id as string
    const auth = autorizarEmpresa(request, empresaId)
    if ('error' in auth) return auth.error

    const body = (await request.json()) as Partial<SeguridadSesionEmpresaInput>
    const inactividad = body.inactividadMinutos ?? null
    const sesionMaxima = body.sesionMaximaHoras ?? null
    const errores = validarSeguridadEmpresa(getParametrosSesionStore(), inactividad, sesionMaxima)
    if (Object.keys(errores).length > 0) {
      return err('Error de validación.', 400, { errors: toFieldErrorStrings(errores) })
    }

    const store = getConfiguracionesSeguridadStore()
    const anterior = store.get(empresaId)
    const actor = { id: auth.user.id, nombre: `${auth.user.nombre} ${auth.user.apellido}` }
    const ahora = new Date().toISOString()
    const cambioA = registrarAuditoria('EMPRESA', empresaId, 'inactividadMinutos', anterior?.inactividadMinutos, inactividad, actor, ahora)
    const cambioB = registrarAuditoria('EMPRESA', empresaId, 'sesionMaximaHoras', anterior?.sesionMaximaHoras, sesionMaxima, actor, ahora)
    if (cambioA || cambioB) {
      store.set(empresaId, {
        inactividadMinutos: inactividad,
        sesionMaximaHoras: sesionMaxima,
        actualizadoPorId: actor.id,
        actualizadoPorNombre: actor.nombre,
        actualizadoEn: ahora,
      })
    }
    return ok(toSeguridadEmpresaDto(empresaId))
  }),

  http.get('/api/sistema/parametros-sesion', async ({ request }) => {
    await delay(LATENCY)
    const user = getSessionUser(request)
    if (!user) return err('Sesión expirada', 401)
    if (user.rol !== 'SUPERADMIN') return err('Acceso exclusivo de SUPERADMIN', 403)
    return ok(getParametrosSesionStore())
  }),

  http.put('/api/sistema/parametros-sesion', async ({ request }) => {
    await delay(LATENCY)
    const user = getSessionUser(request)
    if (!user) return err('Sesión expirada', 401)
    if (user.rol !== 'SUPERADMIN') return err('Acceso exclusivo de SUPERADMIN', 403)

    const body = (await request.json()) as ParametrosSesionInput
    const errores = validarParametros(body)
    if (Object.keys(errores).length > 0) {
      return err('Error de validación.', 400, { errors: toFieldErrorStrings(errores) })
    }

    const actual = getParametrosSesionStore()
    const actor = { id: user.id, nombre: `${user.nombre} ${user.apellido}` }
    const ahora = new Date().toISOString()
    const campos: (keyof ParametrosSesionInput)[] = [
      'inactividadDefaultMinutos',
      'inactividadMinMinutos',
      'inactividadMaxMinutos',
      'sesionMaximaDefaultHoras',
      'sesionMaximaMinHoras',
      'sesionMaximaMaxHoras',
    ]
    const huboCambios = campos
      .map((campo) => registrarAuditoria('GLOBAL', null, campo, actual[campo], body[campo], actor, ahora))
      .some(Boolean)
    if (huboCambios) {
      setParametrosSesionStore({
        ...body,
        actualizadoPorId: actor.id,
        actualizadoPorNombre: actor.nombre,
        actualizadoEn: ahora,
      })
    }
    return ok(getParametrosSesionStore())
  }),
]
