import { create } from 'zustand'
import type { User } from '../types/auth.types'
import type { Empresa } from '../features/empresas/types/empresa.types'
import {
  persistActiveEmpresaId,
  persistMockRefreshToken,
  readActiveEmpresaId,
  readMockRefreshToken,
} from '../lib/mockSession'

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
  logout(): void
  setAccessToken(token: string | null): void
  refreshToken(): Promise<void>
  bootstrap(): Promise<void>
}

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  user: null,
  empresaActivaId: null,
  empresasDisponibles: [],
  accessToken: null,
  isAuthenticated: false,
  isBootstrapping: true,

  login: ({ user, accessToken, empresaActivaId, empresasDisponibles, mockRefreshToken }) => {
    persistMockRefreshToken(mockRefreshToken ?? null)
    persistActiveEmpresaId(empresaActivaId)
    set({ user, accessToken, empresaActivaId, empresasDisponibles, isAuthenticated: true })
  },

  switchEmpresa: ({ user, accessToken, empresaActivaId, empresasDisponibles }) => {
    persistActiveEmpresaId(empresaActivaId)
    set({ user, accessToken, empresaActivaId, empresasDisponibles })
  },

  logout: () => {
    persistMockRefreshToken(null)
    persistActiveEmpresaId(null)
    set({
      user: null,
      empresaActivaId: null,
      empresasDisponibles: [],
      accessToken: null,
      isAuthenticated: false,
    })
  },

  setAccessToken: (token: string | null) => {
    set({ accessToken: token, isAuthenticated: token !== null })
  },

  refreshToken: async () => {
    const { default: api } = await import('../lib/axios')
    const mockRefreshToken = readMockRefreshToken()
    const activeEmpresaId = readActiveEmpresaId()
    const response = await api.post<{ accessToken: string; mockRefreshToken?: string }>(
      '/api/auth/refresh',
      undefined,
      {
        headers: {
          ...(mockRefreshToken ? { 'X-Mock-Refresh-Token': mockRefreshToken } : {}),
          ...(activeEmpresaId ? { 'X-Mock-Empresa-Activa': activeEmpresaId } : {}),
        },
      },
    )
    persistMockRefreshToken(response.data.mockRefreshToken ?? null)
    set({ accessToken: response.data.accessToken, isAuthenticated: true })
  },

  bootstrap: async () => {
    const { default: api } = await import('../lib/axios')
    const mockRefreshToken = readMockRefreshToken()
    const activeEmpresaId = readActiveEmpresaId()
    try {
      const response = await api.post<{
        accessToken: string
        user: User
        empresaActivaId: string | null
        empresasDisponibles: Empresa[]
        mockRefreshToken?: string
      }>('/api/auth/refresh', undefined, {
        headers: {
          ...(mockRefreshToken ? { 'X-Mock-Refresh-Token': mockRefreshToken } : {}),
          ...(activeEmpresaId ? { 'X-Mock-Empresa-Activa': activeEmpresaId } : {}),
        },
      })
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
    } catch {
      persistMockRefreshToken(null)
      persistActiveEmpresaId(null)
      set({
        user: null,
        empresaActivaId: null,
        empresasDisponibles: [],
        accessToken: null,
        isAuthenticated: false,
        isBootstrapping: false,
      })
    }
  },
}))
