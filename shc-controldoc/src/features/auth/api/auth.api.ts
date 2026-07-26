import api from '../../../lib/axios'
import type { User } from '../../../types/auth.types'
import type { Empresa } from '../../empresas/types/empresa.types'
import type { LoginInput } from '../schemas/login.schema'
import type { ForgotPasswordInput } from '../schemas/forgotPassword.schema'

export interface LoginResolvedResponse {
  accessToken: string
  user: User
  empresaActivaId: string
  empresasDisponibles: Empresa[]
  /** Mock-only substitute for the real backend's httpOnly refresh cookie — see src/lib/mockSession.ts. */
  mockRefreshToken?: string
}

/** El usuario tiene más de una empresa asignada y aún no eligió con cuál
 *  trabajar — ver empresa-session capability. No es un login completo: no
 *  hay `accessToken` ni `user` todavía. */
export interface LoginSelectionRequiredResponse {
  requiresEmpresaSelection: true
  empresasDisponibles: Empresa[]
}

export type LoginResponse = LoginResolvedResponse | LoginSelectionRequiredResponse

export function isLoginResolved(response: LoginResponse): response is LoginResolvedResponse {
  return !('requiresEmpresaSelection' in response)
}

export async function loginUser(
  credentials: LoginInput & { empresaId?: string },
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/auth/login', credentials)
  return response.data
}

export async function logoutUser(): Promise<void> {
  await api.post('/api/auth/logout')
}

/** Cambia la empresa activa de una sesión ya autenticada — ver empresa-session
 *  capability, requirement "Cambio de empresa activa sin cerrar sesión". */
export async function switchEmpresa(empresaId: string): Promise<LoginResolvedResponse> {
  const response = await api.post<LoginResolvedResponse>('/api/auth/switch-empresa', { empresaId })
  return response.data
}

export async function forgotPassword(data: ForgotPasswordInput): Promise<void> {
  await api.post('/api/auth/forgot-password', data)
}

export async function resetPassword(data: { token: string; password: string }): Promise<void> {
  await api.post('/api/auth/reset-password', data)
}

export async function changePassword(data: {
  currentPassword: string
  newPassword: string
}): Promise<void> {
  await api.post('/api/auth/change-password', data)
}
