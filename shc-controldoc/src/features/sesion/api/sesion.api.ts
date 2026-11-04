import api from '../../../lib/axios'
import { mockSessionHeaders } from '../../../lib/mockSession'
import type {
  EstadoSesion,
  ParametrosSesion,
  ParametrosSesionInput,
  SeguridadSesionEmpresa,
  SeguridadSesionEmpresaInput,
} from '../types/sesion.types'

export async function getPoliticaSesion(): Promise<EstadoSesion> {
  const response = await api.get<EstadoSesion>('/api/auth/politica-sesion', {
    headers: mockSessionHeaders(),
  })
  return response.data
}

/** Única señal de actividad REAL del usuario hacia el servidor (design.md D4) — el polling y
 *  SignalR nunca la llaman. */
export async function registrarActividad(): Promise<EstadoSesion> {
  const response = await api.post<EstadoSesion>('/api/auth/actividad', undefined, {
    headers: mockSessionHeaders(),
  })
  return response.data
}

export async function getSeguridadSesionEmpresa(empresaId: string): Promise<SeguridadSesionEmpresa> {
  const response = await api.get<SeguridadSesionEmpresa>(`/api/empresas/${empresaId}/seguridad-sesion`)
  return response.data
}

export async function updateSeguridadSesionEmpresa(
  empresaId: string,
  data: SeguridadSesionEmpresaInput,
): Promise<SeguridadSesionEmpresa> {
  const response = await api.put<SeguridadSesionEmpresa>(`/api/empresas/${empresaId}/seguridad-sesion`, data)
  return response.data
}

export async function getParametrosSesion(): Promise<ParametrosSesion> {
  const response = await api.get<ParametrosSesion>('/api/sistema/parametros-sesion')
  return response.data
}

export async function updateParametrosSesion(data: ParametrosSesionInput): Promise<ParametrosSesion> {
  const response = await api.put<ParametrosSesion>('/api/sistema/parametros-sesion', data)
  return response.data
}
