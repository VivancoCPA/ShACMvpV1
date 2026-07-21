import api from '../../../lib/axios'
import type { Area } from '../types/area.types'
import type { AreaFormInput } from '../schemas/areaForm.schema'

export async function listarAreas(): Promise<Area[]> {
  const response = await api.get<Area[]>('/api/areas')
  return response.data
}

export async function obtenerArea(id: string): Promise<Area> {
  const response = await api.get<Area>(`/api/areas/${id}`)
  return response.data
}

export async function crearArea(data: AreaFormInput): Promise<Area> {
  const response = await api.post<Area>('/api/areas', data)
  return response.data
}

export async function actualizarArea(id: string, data: Partial<AreaFormInput>): Promise<Area> {
  const response = await api.patch<Area>(`/api/areas/${id}`, data)
  return response.data
}

export async function desactivarArea(id: string): Promise<Area> {
  const response = await api.patch<Area>(`/api/areas/${id}/desactivar`)
  return response.data
}

export async function reactivarArea(id: string): Promise<Area> {
  const response = await api.patch<Area>(`/api/areas/${id}/reactivar`)
  return response.data
}
