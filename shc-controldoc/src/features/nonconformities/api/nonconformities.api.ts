import api from '../../../lib/axios'
import type { PaginationMeta } from '../../../types/api.types'
import type { User } from '../../../types/auth.types'
import type {
  NoConformidad,
  NCFilters,
  AccionCorrectiva,
  CreateACInput,
  UpdateACInput,
  CerrarACInput,
} from '../types/nonconformity.types'
import type { CreateNCInput } from '../schemas/createNC.schema'
import type { UpdateNCInput } from '../schemas/updateNC.schema'

export interface NCListResponse {
  items: NoConformidad[]
  pagination: PaginationMeta
}

export type CreateNCResponse = NoConformidad & {
  warning?: string
  ncsSimilares?: NoConformidad[]
}

export async function getNonconformities(filters?: NCFilters): Promise<NCListResponse> {
  const response = await api.get<NCListResponse>('/api/nonconformities', { params: filters })
  return response.data
}

export async function getNonconformity(id: string): Promise<NoConformidad> {
  const response = await api.get<NoConformidad>(`/api/nonconformities/${id}`)
  return response.data
}

export async function createNonconformity(data: CreateNCInput): Promise<CreateNCResponse> {
  const response = await api.post<CreateNCResponse>('/api/nonconformities', data)
  return response.data
}

export async function updateNonconformity(id: string, data: UpdateNCInput): Promise<NoConformidad> {
  const response = await api.patch<NoConformidad>(`/api/nonconformities/${id}`, data)
  return response.data
}

export async function vincularQENonconformidad(id: string, qeGeneradoId: string): Promise<NoConformidad> {
  const response = await api.patch<NoConformidad>(`/api/nonconformities/${id}`, { qeGeneradoId })
  return response.data
}

export async function anularNonconformity(
  id: string,
  justificacion: string,
): Promise<NoConformidad> {
  const response = await api.post<NoConformidad>(`/api/nonconformities/${id}/anular`, {
    justificacion,
  })
  return response.data
}

export async function deleteNonconformity(id: string): Promise<NoConformidad> {
  const response = await api.delete<NoConformidad>(`/api/nonconformities/${id}`)
  return response.data
}

export async function restoreNonconformity(id: string): Promise<NoConformidad> {
  const response = await api.patch<NoConformidad>(`/api/nonconformities/${id}/restore`)
  return response.data
}

export async function createAccionCorrectiva(
  ncId: string,
  data: CreateACInput,
): Promise<AccionCorrectiva> {
  const response = await api.post<AccionCorrectiva>(
    `/api/nonconformities/${ncId}/acciones-correctivas`,
    data,
  )
  return response.data
}

export async function updateAccionCorrectiva(
  ncId: string,
  acId: string,
  data: UpdateACInput,
): Promise<AccionCorrectiva> {
  const response = await api.patch<AccionCorrectiva>(
    `/api/nonconformities/${ncId}/acciones-correctivas/${acId}`,
    data,
  )
  return response.data
}

export async function cerrarAccionCorrectiva(
  ncId: string,
  acId: string,
  data: CerrarACInput,
): Promise<AccionCorrectiva> {
  const response = await api.post<AccionCorrectiva>(
    `/api/nonconformities/${ncId}/acciones-correctivas/${acId}/cerrar`,
    data,
  )
  return response.data
}

export async function getUsers(): Promise<User[]> {
  const response = await api.get<User[]>('/api/users')
  return response.data
}
