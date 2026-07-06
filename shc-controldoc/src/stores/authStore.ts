import { create } from 'zustand'
import type { User } from '../types/auth.types'
import { persistMockRefreshToken, readMockRefreshToken } from '../lib/mockSession'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  /** True while the app is attempting to silently restore a session (via the
   *  httpOnly refresh cookie) on startup. Route guards must not evaluate
   *  isAuthenticated until this settles, or a real session gets bounced to
   *  /login on every full-page navigation (reload, typed URL, new tab). */
  isBootstrapping: boolean
}

interface AuthActions {
  login(data: { user: User; accessToken: string; mockRefreshToken?: string }): void
  logout(): void
  setAccessToken(token: string | null): void
  refreshToken(): Promise<void>
  bootstrap(): Promise<void>
}

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isBootstrapping: true,

  login: ({ user, accessToken, mockRefreshToken }) => {
    persistMockRefreshToken(mockRefreshToken ?? null)
    set({ user, accessToken, isAuthenticated: true })
  },

  logout: () => {
    persistMockRefreshToken(null)
    set({ user: null, accessToken: null, isAuthenticated: false })
  },

  setAccessToken: (token: string | null) => {
    set({ accessToken: token, isAuthenticated: token !== null })
  },

  refreshToken: async () => {
    const { default: api } = await import('../lib/axios')
    const mockRefreshToken = readMockRefreshToken()
    const response = await api.post<{ accessToken: string; mockRefreshToken?: string }>(
      '/api/auth/refresh',
      undefined,
      mockRefreshToken ? { headers: { 'X-Mock-Refresh-Token': mockRefreshToken } } : undefined,
    )
    persistMockRefreshToken(response.data.mockRefreshToken ?? null)
    set({ accessToken: response.data.accessToken, isAuthenticated: true })
  },

  bootstrap: async () => {
    const { default: api } = await import('../lib/axios')
    const mockRefreshToken = readMockRefreshToken()
    try {
      const response = await api.post<{ accessToken: string; user: User; mockRefreshToken?: string }>(
        '/api/auth/refresh',
        undefined,
        mockRefreshToken ? { headers: { 'X-Mock-Refresh-Token': mockRefreshToken } } : undefined,
      )
      persistMockRefreshToken(response.data.mockRefreshToken ?? null)
      set({
        accessToken: response.data.accessToken,
        user: response.data.user,
        isAuthenticated: true,
        isBootstrapping: false,
      })
    } catch {
      persistMockRefreshToken(null)
      set({ user: null, accessToken: null, isAuthenticated: false, isBootstrapping: false })
    }
  },
}))
