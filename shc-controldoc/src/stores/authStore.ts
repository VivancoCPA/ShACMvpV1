import { create } from 'zustand'
import type { User } from '../types/auth.types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
}

interface AuthActions {
  login(data: { user: User; accessToken: string }): void
  logout(): void
  setAccessToken(token: string | null): void
  refreshToken(): Promise<void>
}

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  login: ({ user, accessToken }) => {
    set({ user, accessToken, isAuthenticated: true })
  },

  logout: () => {
    set({ user: null, accessToken: null, isAuthenticated: false })
  },

  setAccessToken: (token: string | null) => {
    set({ accessToken: token, isAuthenticated: token !== null })
  },

  refreshToken: async () => {
    const { default: api } = await import('../lib/axios')
    const response = await api.post<{ accessToken: string }>('/api/auth/refresh')
    set({ accessToken: response.data.accessToken, isAuthenticated: true })
  },
}))
