import api from '../../lib/axios'
import type { Documento, DocFilters, DocStatus } from '../../types/documents.types'
import type { PaginationMeta } from '../../types/api.types'
import type { CreateDocumentInput } from '../../features/documents/schemas/createDocument.schema'
import type { UpdateDocumentInput } from '../../features/documents/schemas/updateDocument.schema'

export interface ChangeDocumentStatusPayload {
  nuevoEstado: DocStatus
  comentario?: string
  firma: string
}

export interface DocumentListResponse {
  items: Documento[]
  pagination: PaginationMeta
}

export async function getDocuments(filters: DocFilters = {}): Promise<DocumentListResponse> {
  const params: Record<string, unknown> = {}
  if (filters.estado !== undefined) params.estado = filters.estado
  if (filters.tipo !== undefined) params.tipo = filters.tipo
  if (filters.area !== undefined) params.area = filters.area
  if (filters.autorId !== undefined) params.autorId = filters.autorId
  if (filters.search !== undefined) params.search = filters.search
  if (filters.page !== undefined) params.page = filters.page
  if (filters.pageSize !== undefined) params.pageSize = filters.pageSize

  const response = await api.get<DocumentListResponse>('/api/documents', { params })
  return response.data
}

export async function getDocumentById(id: string): Promise<Documento> {
  const response = await api.get<Documento>(`/api/documents/${id}`)
  return response.data
}

export async function createDocument(data: CreateDocumentInput): Promise<Documento> {
  const response = await api.post<Documento>('/api/documents', data)
  return response.data
}

export async function updateDocument(id: string, data: UpdateDocumentInput): Promise<Documento> {
  const response = await api.put<Documento>(`/api/documents/${id}`, data)
  return response.data
}

export async function changeDocumentStatus(
  id: string,
  payload: ChangeDocumentStatusPayload,
): Promise<Documento> {
  const response = await api.post<Documento>(`/api/documents/${id}/status`, payload)
  return response.data
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/api/documents/${id}`)
}
