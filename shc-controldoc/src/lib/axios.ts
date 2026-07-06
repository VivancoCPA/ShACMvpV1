import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse } from '../types/api.types'
import { useAuthStore } from '../stores/authStore'

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
    const body = response.data
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
      return { ...response, data: body.data }
    }
    return response
  },
  async (error: unknown) => {
    const axiosError = error as import('axios').AxiosError
    const original = axiosError.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined

    const isRefreshCall = original?.url?.includes('/api/auth/refresh') ?? false

    if (axiosError.response?.status === 401 && original && !original._retry && !isRefreshCall) {
      original._retry = true
      try {
        await useAuthStore.getState().refreshToken()
        const newToken = useAuthStore.getState().accessToken
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`
        }
        return api(original)
      } catch {
        useAuthStore.getState().logout()
      }
    }
    return Promise.reject(error)
  }
)

export default api
