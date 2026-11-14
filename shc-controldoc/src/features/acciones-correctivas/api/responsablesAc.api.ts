import api from '../../../lib/axios'
import type { ActualizarResponsablesAcInput, ConfiguracionResponsablesAc } from '../types/responsablesAc.types'

export async function getResponsablesAc(empresaId: string): Promise<ConfiguracionResponsablesAc> {
  const response = await api.get<ConfiguracionResponsablesAc>(`/api/empresas/${empresaId}/responsables-ac`)
  return response.data
}

export async function updateResponsablesAc(
  empresaId: string,
  data: ActualizarResponsablesAcInput,
): Promise<ConfiguracionResponsablesAc> {
  const response = await api.put<ConfiguracionResponsablesAc>(`/api/empresas/${empresaId}/responsables-ac`, data)
  return response.data
}

export async function restablecerResponsablesAc(empresaId: string): Promise<ConfiguracionResponsablesAc> {
  const response = await api.post<ConfiguracionResponsablesAc>(`/api/empresas/${empresaId}/responsables-ac/restablecer`)
  return response.data
}
