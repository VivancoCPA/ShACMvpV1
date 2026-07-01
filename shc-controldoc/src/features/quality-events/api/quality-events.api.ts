import api from '../../../lib/axios'
import type { QualityEvent, QEListParams, QEStatusTransitionInput, QualityEventUpdateInput } from '../types/qualityEvent.types'
import type { QualityEventCreateInput } from '../schemas/qualityEventCreate.schema'

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
