import api from '../../../lib/axios'
import type {
  QualityEvent,
  QEListParams,
  QEStatusTransitionInput,
  QualityEventUpdateInput,
  AccionCorrectivaQE,
  QEAuditTrailEntry,
} from '../types/qualityEvent.types'
import type { QualityEventCreateInput } from '../schemas/qualityEventCreate.schema'
import type { CreateQEACInput } from '../schemas/createQEAccion.schema'
import type { CerrarQEACInput } from '../schemas/cerrarQEAccion.schema'

export interface QEListResponse {
  items: QualityEvent[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export async function getQualityEvents(params: QEListParams): Promise<QEListResponse> {
  const response = await api.get<QEListResponse>('/api/quality-events', { params })
  return response.data
}

export async function getQualityEvent(id: string): Promise<QualityEvent> {
  const response = await api.get<QualityEvent>(`/api/quality-events/${id}`)
  return response.data
}

export async function createQualityEvent(data: QualityEventCreateInput): Promise<QualityEvent> {
  const response = await api.post<QualityEvent>('/api/quality-events', data)
  return response.data
}

export async function updateQualityEvent(id: string, data: QualityEventUpdateInput): Promise<QualityEvent> {
  const response = await api.patch<QualityEvent>(`/api/quality-events/${id}`, data)
  return response.data
}

export async function transitionQEStatus(id: string, data: QEStatusTransitionInput): Promise<QualityEvent> {
  const response = await api.patch<QualityEvent>(`/api/quality-events/${id}/status`, data)
  return response.data
}

export async function deleteQualityEvent(id: string): Promise<QualityEvent> {
  const response = await api.delete<QualityEvent>(`/api/quality-events/${id}`)
  return response.data
}

export async function reactivateQualityEvent(id: string): Promise<QualityEvent> {
  const response = await api.patch<QualityEvent>(`/api/quality-events/${id}/reactivar`)
  return response.data
}

export type UpdateQEACStatusInput = {
  estado: AccionCorrectivaQE['estado']
  descripcionEvidencia?: string
  evidenciaUrl?: string
}

export async function getQEAcciones(qeId: string): Promise<AccionCorrectivaQE[]> {
  const response = await api.get<AccionCorrectivaQE[]>(`/api/quality-events/${qeId}/acciones-correctivas`)
  return response.data
}

export async function createQEAccion(qeId: string, data: CreateQEACInput): Promise<AccionCorrectivaQE> {
  const response = await api.post<AccionCorrectivaQE>(
    `/api/quality-events/${qeId}/acciones-correctivas`,
    data,
  )
  return response.data
}

export async function updateQEAccion(
  qeId: string,
  acId: string,
  data: UpdateQEACStatusInput,
): Promise<AccionCorrectivaQE> {
  const response = await api.patch<AccionCorrectivaQE>(
    `/api/quality-events/${qeId}/acciones-correctivas/${acId}/status`,
    data,
  )
  return response.data
}

export async function cerrarQEAccion(
  qeId: string,
  acId: string,
  data: CerrarQEACInput,
): Promise<AccionCorrectivaQE> {
  const response = await api.patch<AccionCorrectivaQE>(
    `/api/quality-events/${qeId}/acciones-correctivas/${acId}/status`,
    { estado: 'CERRADA', ...data },
  )
  return response.data
}

export async function getQEAuditTrail(qeId: string): Promise<QEAuditTrailEntry[]> {
  const response = await api.get<QEAuditTrailEntry[]>(`/api/quality-events/${qeId}/audit-trail`)
  return response.data
}

export async function solicitarACEnQE(qeId: string): Promise<QualityEvent> {
  const response = await api.patch<QualityEvent>(`/api/quality-events/${qeId}/solicitar-ac`)
  return response.data
}
