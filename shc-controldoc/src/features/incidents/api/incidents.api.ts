import api from '../../../lib/axios'
import type { PaginationMeta } from '../../../types/api.types'
import type { Incidente, AccionCorrectivaIncidente } from '../types/incident.types'
import type { CreateIncidentInput, UpdateIncidentInvestigacionInput } from '../schemas/createIncident.schema'
import type { CreateACIncidenteInput } from '../schemas/createAC.schema'
import type { CerrarACIncidenteInput } from '../schemas/cerrarAC.schema'
import type { IncidentStatus } from '../types/incident.types'

export interface IncidentFilters {
  tipo?: string
  estado?: string
  severidad?: string
  areaId?: string
  turno?: string
  fechaDesde?: string
  fechaHasta?: string
  showDeleted?: boolean
  search?: string
  page?: number
  pageSize?: number
}

export interface IncidentListResponse {
  items: Incidente[]
  pagination: PaginationMeta
}

export async function getIncidents(filters?: IncidentFilters): Promise<IncidentListResponse> {
  const response = await api.get<IncidentListResponse>('/api/incidents', { params: filters })
  return response.data
}

export async function getIncident(id: string): Promise<Incidente> {
  const response = await api.get<Incidente>(`/api/incidents/${id}`)
  return response.data
}

export async function createIncident(data: CreateIncidentInput): Promise<Incidente> {
  const response = await api.post<Incidente>('/api/incidents', data)
  return response.data
}

export interface SubirEvidenciaResponse {
  url: string
  nombre: string
  tamanioKb: number
}

// El header Content-Type se elimina explícitamente (no se fija a 'multipart/form-data') para que
// axios/el navegador calculen el boundary real del FormData — mismo patrón que buildLocalFormData
// en locales.api.ts. Sube un archivo real y devuelve su URL servida por el backend; el caller arma
// el resto del objeto IncidentEvidencia (id, tipo, creadoEn, creadoPor, descripcion opcional)
// usando esta URL en vez de una blob: URL local (cutover-incidentes design.md D2/D3).
export async function subirEvidencia(file: File | Blob): Promise<SubirEvidenciaResponse> {
  const formData = new FormData()
  formData.append('evidencia', file, file instanceof File ? file.name : 'foto.jpg')
  const response = await api.post<SubirEvidenciaResponse>('/api/incidents/evidencias', formData, {
    headers: { 'Content-Type': undefined },
  })
  return response.data
}

/**
 * Excepción documentada exclusiva del flujo de sincronización offline
 * (m7-f2-offline-sync design.md D8): envía `empresaId` explícito para que el
 * reporte se registre bajo la empresa activa al momento de *crear* (guardada
 * en la cola local), no la que esté activa al momento de *sincronizar*. El
 * mock valida membresía server-side antes de confiar en el valor. Ningún
 * otro caller de `createIncident` debe enviar este campo.
 */
export async function createIncidentOfflineSync(
  data: CreateIncidentInput,
  empresaId: string,
): Promise<Incidente> {
  const response = await api.post<Incidente>('/api/incidents', { ...data, empresaId })
  return response.data
}

export async function updateIncident(
  id: string,
  data: Partial<UpdateIncidentInvestigacionInput>,
): Promise<Incidente> {
  const response = await api.patch<Incidente>(`/api/incidents/${id}`, data)
  return response.data
}

export async function updateIncidentStatus(
  id: string,
  data: { estado: IncidentStatus; comentario?: string },
): Promise<Incidente> {
  const response = await api.patch<Incidente>(`/api/incidents/${id}/status`, data)
  return response.data
}

export async function deleteIncident(id: string): Promise<Incidente> {
  const response = await api.delete<Incidente>(`/api/incidents/${id}`)
  return response.data
}

export async function restoreIncident(id: string): Promise<Incidente> {
  const response = await api.patch<Incidente>(`/api/incidents/${id}/restore`)
  return response.data
}

export async function vincularQEIncidente(id: string, qeId: string): Promise<Incidente> {
  const response = await api.patch<Incidente>(`/api/incidents/${id}`, { qeId })
  return response.data
}

export async function createAC(
  incidenteId: string,
  data: CreateACIncidenteInput,
): Promise<AccionCorrectivaIncidente> {
  const response = await api.post<AccionCorrectivaIncidente>(
    `/api/incidents/${incidenteId}/acciones`,
    data,
  )
  return response.data
}

export async function updateAC(
  incidenteId: string,
  acId: string,
  data: Partial<AccionCorrectivaIncidente>,
): Promise<AccionCorrectivaIncidente> {
  const response = await api.patch<AccionCorrectivaIncidente>(
    `/api/incidents/${incidenteId}/acciones/${acId}`,
    data,
  )
  return response.data
}

export async function cerrarAC(
  incidenteId: string,
  acId: string,
  data: CerrarACIncidenteInput,
): Promise<AccionCorrectivaIncidente> {
  const response = await api.patch<AccionCorrectivaIncidente>(
    `/api/incidents/${incidenteId}/acciones/${acId}/cerrar`,
    data,
  )
  return response.data
}
