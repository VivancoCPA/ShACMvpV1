import { create } from 'zustand'
import type { User } from '../types/auth.types'
import type { Empresa } from '../features/empresas/types/empresa.types'
import type { SessionEndReason } from '../features/sesion/types/sesion.types'
import { sessionEndReasonFromError } from '../features/sesion/utils/sessionEndReason'
import {
  mockSessionHeaders,
  persistActiveEmpresaId,
  persistMockRefreshToken,
} from '../lib/mockSession'
import { resetActivity } from '../lib/sessionActivity'

interface AuthState {
  user: User | null
  /** Empresa activa de la sesión. `user.rol` siempre está resuelto para esta
   *  empresa — nunca es un valor fijo independiente de ella (ver
   *  me-f2-sesion-rbac-login design.md, D1/D2). */
  empresaActivaId: string | null
  /** Empresas con asignación ACTIVA (`UsuarioEmpresa`) para el usuario logueado. */
  empresasDisponibles: Empresa[]
  accessToken: string | null
  isAuthenticated: boolean
  /** True while the app is attempting to silently restore a session (via the
   *  httpOnly refresh cookie) on startup. Route guards must not evaluate
   *  isAuthenticated until this settles, or a real session gets bounced to
   *  /login on every full-page navigation (reload, typed URL, new tab). */
  isBootstrapping: boolean
  /** Motivo del último cierre de sesión forzado por política (inactividad / duración máxima),
   *  para que LoginPage lo muestre — sesion-timeout-inactividad design.md D11. `null` en un
   *  logout manual o tras un login exitoso. */
  sessionEndReason: SessionEndReason | null
}

interface SessionPayload {
  user: User
  accessToken: string
  empresaActivaId: string | null
  empresasDisponibles: Empresa[]
}

interface AuthActions {
  login(data: SessionPayload & { mockRefreshToken?: string }): void
  /** Cambia la empresa activa de una sesión ya autenticada (sin re-login) —
   *  ver empresa-session capability, requirement "Cambio de empresa activa
   *  sin cerrar sesión". */
  switchEmpresa(data: SessionPayload): void
  /** Cierre local de la sesión. Todo cierre que no sea de tests debe pasar por
   *  `endSession()` (lib/sessionEnd.ts), que además llama al backend, limpia la caché de
   *  TanStack Query y avisa a las otras pestañas. */
  logout(reason?: SessionEndReason | null): void
  setAccessToken(token: string | null): void
  refreshToken(): Promise<void>
  bootstrap(): Promise<void>
  /** Actualiza `user.tienePinFirma` localmente tras un `set-pin` exitoso, sin requerir un
   *  refresh de sesión completo (ver pin-firma-ui/design.md D4). No-op si no hay sesión. */
  setTienePinFirma(value: boolean): void
}

let inFlightRefresh: Promise<void> | null = null

const REFRESH_LOCK_NAME = 'shac-auth-refresh'

function withCrossTabRefreshLock(task: () => Promise<void>): Promise<void> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks) return task()
  return locks.request(REFRESH_LOCK_NAME, task)
}

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  user: null,
  empresaActivaId: null,
  empresasDisponibles: [],
  accessToken: null,
  isAuthenticated: false,
  isBootstrapping: true,
  sessionEndReason: null,

  login: ({ user, accessToken, empresaActivaId, empresasDisponibles, mockRefreshToken }) => {
    persistMockRefreshToken(mockRefreshToken ?? null)
    persistActiveEmpresaId(empresaActivaId)
    // Sesión nueva: la última actividad de una sesión anterior no cuenta para el detector.
    resetActivity()
    set({
      user,
      accessToken,
      empresaActivaId,
      empresasDisponibles,
      isAuthenticated: true,
      sessionEndReason: null,
    })
  },

  switchEmpresa: ({ user, accessToken, empresaActivaId, empresasDisponibles }) => {
    persistActiveEmpresaId(empresaActivaId)
    set({ user, accessToken, empresaActivaId, empresasDisponibles })
  },

  logout: (reason = null) => {
    persistMockRefreshToken(null)
    persistActiveEmpresaId(null)
    set({
      user: null,
      empresaActivaId: null,
      empresasDisponibles: [],
      accessToken: null,
      isAuthenticated: false,
      sessionEndReason: reason,
    })
  },

  setAccessToken: (token: string | null) => {
    set({ accessToken: token, isAuthenticated: token !== null })
  },

  setTienePinFirma: (value: boolean) => {
    set((state) => (state.user ? { user: { ...state.user, tienePinFirma: value } } : state))
  },

  // Single-flight (sesion-timeout-inactividad design.md D12): con access tokens de 5 min, dos 401
  // concurrentes son frecuentes — el segundo /refresh llegaría con la cookie ya revocada por la
  // rotación del primero y cerraría la sesión por error. Una sola promesa en vuelo por pestaña, y
  // Web Locks para serializar entre pestañas (la cookie es compartida: la segunda pestaña rota ya
  // con la cookie nueva).
  refreshToken: () => {
    inFlightRefresh ??= withCrossTabRefreshLock(async () => {
      const { default: api } = await import('../lib/axios')
      const response = await api.post<{ accessToken: string; mockRefreshToken?: string }>(
        '/api/auth/refresh',
        undefined,
        { headers: mockSessionHeaders() },
      )
      persistMockRefreshToken(response.data.mockRefreshToken ?? null)
      set({ accessToken: response.data.accessToken, isAuthenticated: true })
    }).finally(() => {
      inFlightRefresh = null
    })
    return inFlightRefresh
  },

  bootstrap: async () => {
    const { default: api } = await import('../lib/axios')
    try {
      const response = await api.post<{
        accessToken: string
        user: User
        empresaActivaId: string | null
        empresasDisponibles: Empresa[]
        mockRefreshToken?: string
      }>('/api/auth/refresh', undefined, { headers: mockSessionHeaders() })
      persistMockRefreshToken(response.data.mockRefreshToken ?? null)
      persistActiveEmpresaId(response.data.empresaActivaId)
      set({
        accessToken: response.data.accessToken,
        user: response.data.user,
        empresaActivaId: response.data.empresaActivaId,
        empresasDisponibles: response.data.empresasDisponibles,
        isAuthenticated: true,
        isBootstrapping: false,
      })
    } catch (error) {
      persistMockRefreshToken(null)
      persistActiveEmpresaId(null)
      set({
        user: null,
        empresaActivaId: null,
        empresasDisponibles: [],
        accessToken: null,
        isAuthenticated: false,
        isBootstrapping: false,
        // Recargar la página con una sesión ya vencida por política muestra el motivo en el login.
        sessionEndReason: sessionEndReasonFromError(error),
      })
    }
  },
}))
