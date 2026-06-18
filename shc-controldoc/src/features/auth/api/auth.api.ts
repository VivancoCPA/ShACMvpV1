import api from '../../../lib/axios'
import type { User } from '../../../types/auth.types'
import type { LoginInput } from '../schemas/login.schema'
import type { ForgotPasswordInput } from '../schemas/forgotPassword.schema'

export interface LoginResponse {
  accessToken: string
  user: User
}

export async function loginUser(credentials: LoginInput): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/auth/login', credentials)
  return response.data
}

export async function logoutUser(): Promise<void> {
  await api.post('/api/auth/logout')
}

export async function forgotPassword(data: ForgotPasswordInput): Promise<void> {
  await api.post('/api/auth/forgot-password', data)
}

export async function resetPassword(data: { token: string; password: string }): Promise<void> {
  await api.post('/api/auth/reset-password', data)
}
