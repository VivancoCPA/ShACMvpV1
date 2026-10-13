import api from '../../lib/axios'
import type { Documento, DocFilters, DocStatus, CandidatoAsignacion, TipoAsignacion } from '../../types/documents.types'
import type { PaginationMeta } from '../../types/api.types'
import { getFileNameFromContentDisposition } from '../../utils/contentDisposition'

export interface DocumentListResponse {
  items: Documento[]
  pagination: PaginationMeta
}

export async function getDocuments(filters: DocFilters = {}): Promise<DocumentListResponse> {
  const params: Record<string, unknown> = {}
  if (filters.estado) params.estado = filters.estado
  if (filters.tipo) params.tipo = filters.tipo
  if (filters.areaId) params.areaId = filters.areaId
  if (filters.autorId !== undefined) params.autorId = filters.autorId
  if (filters.search) params.search = filters.search
  if (filters.codigo !== undefined) params.codigo = filters.codigo
  params.page = filters.page ?? 1
  params.pageSize = filters.pageSize ?? 5
  if (filters.includeDeleted) params.includeDeleted = 'true'
  if (filters.pendientes) params.pendientes = 'true'

  const response = await api.get<DocumentListResponse>('/api/documents', { params })
  return response.data
}

export interface PendientesCountResponse {
  count: number
}

export async function getPendientesCount(): Promise<PendientesCountResponse> {
  const response = await api.get<PendientesCountResponse>('/api/documents/pendientes/count')
  return response.data
}

export async function getCandidatosAsignacion(
  tipo: TipoAsignacion,
  documentoId?: string,
): Promise<CandidatoAsignacion[]> {
  const params: Record<string, string> = { tipo }
  if (documentoId) params.documentoId = documentoId
  const response = await api.get<CandidatoAsignacion[]>('/api/documents/candidatos-asignacion', { params })
  return response.data
}

export async function getDocumentById(id: string): Promise<Documento> {
  const response = await api.get<Documento>(`/api/documents/${id}`)
  return response.data
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/api/documents/${id}`)
}

export interface PatchDocumentStatusPayload {
  estado: DocStatus
  motivo?: string
  notificarAutor?: boolean
}

export interface SignDocumentPayload {
  pin: string
}

export async function patchDocumentStatus(
  id: string,
  payload: PatchDocumentStatusPayload,
): Promise<Documento> {
  const response = await api.patch<Documento>(`/api/documents/${id}/status`, payload)
  return response.data
}

export async function signDocument(id: string, payload: SignDocumentPayload): Promise<Documento> {
  const response = await api.post<Documento>(`/api/documents/${id}/sign`, payload)
  return response.data
}

export interface NuevaVersionPayload {
  tipoCambio: 'MENOR' | 'MAYOR'
  motivo: string
}

export async function createNuevaVersion(
  id: string,
  data: NuevaVersionPayload,
): Promise<Documento> {
  const response = await api.post<Documento>(`/api/documents/${id}/nueva-version`, data)
  return response.data
}

export interface ExportarPdfPayload {
  userNombreCompleto: string
}

export async function exportarPdfControlado(
  id: string,
  payload: ExportarPdfPayload,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await api.post(
    `/api/documents/${id}/exportar-pdf`,
    payload,
    { responseType: 'blob' },
  )
  const blob = response.data as Blob
  const disposition = (response.headers as Record<string, string>)['content-disposition']
  const fileName = getFileNameFromContentDisposition(disposition, `documento-${id}-controlado.pdf`)
  return { blob, fileName }
}

export interface ConfirmarRevisionPeriodicaPayload {
  fechaRevisionProxima?: string | null
}

export async function confirmarRevisionPeriodica(
  id: string,
  payload?: ConfirmarRevisionPeriodicaPayload,
): Promise<Documento> {
  const response = await api.patch<Documento>(`/api/documents/${id}/confirmar-revision`, payload)
  return response.data
}

export async function restaurarDocumento(id: string): Promise<Documento> {
  const response = await api.patch<Documento>(`/api/documents/${id}/restaurar`)
  return response.data
}

export async function getArchivoOriginalUrl(
  id: string,
  fallbackNombre?: string,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await api.get(`/api/documents/${id}/archivo-original`, { responseType: 'blob' })
  const blob = response.data as Blob
  const disposition = (response.headers as Record<string, string>)['content-disposition']
  // El fallback final SIEMPRE incluye extensión (nunca un nombre pelado): se prioriza el nombre
  // real ya conocido por el caller (documento.archivoOriginalNombre) sobre el genérico .bin.
  const fileName = getFileNameFromContentDisposition(disposition, fallbackNombre ?? `documento-${id}-original.bin`)
  return { blob, fileName }
}

// visor-documentos (design.md D1/D6) — GET /:id/visor siempre se consume como blob autenticado
// vía esta instancia de axios (JWT adjunto por el interceptor), nunca como una URL estática
// abierta con window.open. El endpoint decide el contenido según estado (vista previa generada,
// PDF de distribución tal cual, o con el sello OBSOLETO) — el frontend no distingue esos casos.
export async function getDocumentVisorBlob(id: string): Promise<Blob> {
  const response = await api.get(`/api/documents/${id}/visor`, { responseType: 'blob' })
  return response.data as Blob
}

export async function vincularQE(documentId: string, qualityEventId: string): Promise<Documento> {
  const response = await api.post<Documento>(`/api/documents/${documentId}/qe-vinculados`, { qualityEventId })
  return response.data
}

export async function desvincularQE(documentId: string, qualityEventId: string): Promise<Documento> {
  const response = await api.delete<Documento>(`/api/documents/${documentId}/qe-vinculados/${qualityEventId}`)
  return response.data
}

export async function vincularNC(documentId: string, noConformidadId: string): Promise<Documento> {
  const response = await api.post<Documento>(`/api/documents/${documentId}/nc-vinculadas`, { noConformidadId })
  return response.data
}

export async function desvincularNC(documentId: string, noConformidadId: string): Promise<Documento> {
  const response = await api.delete<Documento>(`/api/documents/${documentId}/nc-vinculadas/${noConformidadId}`)
  return response.data
}

export async function replaceArchivoOriginal(
  id: string,
  file: File,
): Promise<{ archivoOriginalUrl: string; archivoOriginalNombre: string }> {
  const formData = new FormData()
  formData.append('archivoOriginal', file)
  const response = await api.post<{ archivoOriginalUrl: string; archivoOriginalNombre: string }>(
    `/api/documents/${id}/archivo-original`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return response.data
}
