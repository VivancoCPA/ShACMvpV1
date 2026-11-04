import axios, { AxiosError } from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse } from '../types/api.types'
import { useAuthStore } from '../stores/authStore'
import { sessionEndReasonFromError } from '../features/sesion/utils/sessionEndReason'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': 'es-PE',
  },
  timeout: 30_000,
  withCredentials: true,
})

// Endpoints reachable before a session exists (or while establishing a new
// one). A stale accessToken from a previous session must never be attached
// here — e.g. a user still holding an old session in memory who submits a
// fresh login for a different account must not have the old Bearer token
// riding along on that /api/auth/login request.
const PUBLIC_AUTH_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]

// pin-olvidado-pista (design.md D2): un 401 con alguno de estos códigos es una credencial
// incorrecta (PIN de firma, contraseña de confirmación), no un access token vencido — refrescar
// la sesión y reenviar la petición solo probaría dos veces el mismo PIN/contraseña erróneo.
const CREDENTIAL_ERROR_CODES = ['PIN_INCORRECTO', 'CONTRASENA_INCORRECTA']

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const isPublicAuthEndpoint = PUBLIC_AUTH_PATHS.some((path) => config.url?.includes(path))
  const token = useAuthStore.getState().accessToken
  if (token && !isPublicAuthEndpoint) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>) => {
    // Descargas de archivo (`responseType: 'arraybuffer' | 'blob'`) devuelven
    // bytes binarios crudos a propósito — nunca van envueltos en
    // { success, data } y no deben pasar por este chequeo (ver
    // archivo-original/archivo-distribucion en documents.handlers.ts).
    const isBinaryDownload =
      response.config.responseType === 'arraybuffer' || response.config.responseType === 'blob'
    if (isBinaryDownload) return response

    const body = response.data
    const isEnvelope = body !== null && typeof body === 'object' && 'success' in body && 'data' in body
    if (!isEnvelope) {
      // Un 200 con body que no es { success, data } no es una respuesta válida
      // del backend (ni del mock) — típicamente el fallback SPA de un
      // servidor estático (index.html) cuando el request no fue interceptado
      // por el Service Worker de MSW (ver bug: reload sin SW controlando la
      // página). Tratarlo como éxito silencioso deja accessToken/user como
      // `undefined` en vez de fallar, lo cual corrompe el estado de sesión
      // sin ningún error visible. Se convierte en un fallo duro para que
      // caiga en el mismo camino de error que cualquier otro fallo de red.
      return Promise.reject(
        new AxiosError(
          `Respuesta inesperada de ${response.config.url}: no tiene el formato ApiResponse<T> esperado.`,
          'ERR_INVALID_RESPONSE_ENVELOPE',
          response.config,
          response.request,
          response,
        ),
      )
    }
    return { ...response, data: body.data }
  },
  async (error: unknown) => {
    const axiosError = error as import('axios').AxiosError
    const original = axiosError.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined

    const isPublicAuthCall = PUBLIC_AUTH_PATHS.some((path) => original?.url?.includes(path))

    if (axiosError.response?.status === 401) {
      const errorCode = (axiosError.response.data as { errorCode?: string } | undefined)?.errorCode
      if (errorCode && CREDENTIAL_ERROR_CODES.includes(errorCode)) return Promise.reject(error)

      // sesion-timeout-inactividad (design.md D12): un cierre por política (SESION_INACTIVA /
      // SESION_MAXIMA_ALCANZADA, venga de /refresh, /actividad o cualquier otra petición) NO se
      // reintenta — el servidor ya revocó la sesión; refrescar de nuevo solo daría otro 401.
      const reason = sessionEndReasonFromError(axiosError)
      if (reason) {
        const { endSession } = await import('./sessionEnd')
        await endSession(reason, { notifyServer: false })
        return Promise.reject(error)
      }
    }

    // Los endpoints públicos de auth (login con credenciales inválidas, /refresh mismo, etc.)
    // nunca disparan un refresh: un 401 ahí no significa "access token vencido".
    if (axiosError.response?.status === 401 && original && !original._retry && !isPublicAuthCall) {
      original._retry = true
      try {
        await useAuthStore.getState().refreshToken()
        const newToken = useAuthStore.getState().accessToken
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`
        }
        return api(original)
      } catch (refreshError) {
        const { endSession } = await import('./sessionEnd')
        await endSession(sessionEndReasonFromError(refreshError), { notifyServer: false })
      }
    }
    return Promise.reject(error)
  }
)

export default api
