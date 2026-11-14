import api from '../../../lib/axios'
import type {
  QualityEvent,
  QEListParams,
  QEStatusTransitionInput,
  QualityEventUpdateInput,
  AccionCorrectivaQE,
  EvidenciaACQE,
  QEAuditTrailEntry,
  CandidatoResponsableQE,
  Funcionalidades,
  SugerenciaCausaRaizIA,
  AnalisisCausaRaizMetodo,
} from '../types/qualityEvent.types'
import type { QualityEventCreateInput } from '../schemas/qualityEventCreate.schema'
import type { CreateQEACInput } from '../schemas/createQEAccion.schema'
import type { EjecutarQEACInput } from '../schemas/ejecutarQEAccion.schema'
import type { VerificarQEACInput } from '../schemas/verificarQEAccion.schema'
import type { QualityEventCierreFormInput } from '../schemas/qualityEventCierre.schema'
import type { FirmarCierreInput } from '../schemas/firmarCierre.schema'
import type { VerificacionEficaciaInput } from '../schemas/verificacionEficacia.schema'
import type { QualityEventEditReporteInicialInput } from '../schemas/qualityEventEditReporteInicial.schema'
import type { QualityEventEditSeveridadInput } from '../schemas/qualityEventEditSeveridad.schema'
import type { QualityEventEditMineralInput } from '../schemas/qualityEventEditMineral.schema'
import type { SolicitarAjustePlazoACInput } from '../schemas/solicitarAjustePlazoAC.schema'

export type EditarSeveridadResponse = QualityEvent & { requiereNotificacionUrgente: boolean }

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

// ac-ejecucion-verificacion-evidencias: el responsable inicia, sube evidencias y ejecuta; el JCA
// verifica. PATCH …/status ya no cierra (422 USAR_FLUJO_VERIFICACION).
const acRuta = (qeId: string, acId: string) => `/api/quality-events/${qeId}/acciones-correctivas/${acId}`

export async function iniciarQEAccion(qeId: string, acId: string): Promise<AccionCorrectivaQE> {
  const response = await api.post<AccionCorrectivaQE>(`${acRuta(qeId, acId)}/iniciar`)
  return response.data
}

export async function subirEvidenciaAC(
  qeId: string,
  acId: string,
  file: File,
  onProgress?: (porcentaje: number) => void,
): Promise<EvidenciaACQE> {
  const formData = new FormData()
  formData.append('archivo', file)
  // Content-Type undefined: axios calcula el boundary real (mismo criterio que archivo-original).
  const response = await api.post<EvidenciaACQE>(`${acRuta(qeId, acId)}/evidencias`, formData, {
    headers: { 'Content-Type': undefined },
    onUploadProgress: (e) => {
      if (e.total) onProgress?.(Math.round((e.loaded * 100) / e.total))
    },
  })
  return response.data
}

export async function eliminarEvidenciaAC(qeId: string, acId: string, evidenciaId: string): Promise<void> {
  await api.delete(`${acRuta(qeId, acId)}/evidencias/${evidenciaId}`)
}

export async function getEvidenciaACBlob(qeId: string, acId: string, evidenciaId: string): Promise<Blob> {
  const response = await api.get(`${acRuta(qeId, acId)}/evidencias/${evidenciaId}/archivo`, { responseType: 'blob' })
  return response.data
}

export async function ejecutarQEAccion(
  qeId: string,
  acId: string,
  data: EjecutarQEACInput,
): Promise<AccionCorrectivaQE> {
  const response = await api.post<AccionCorrectivaQE>(`${acRuta(qeId, acId)}/ejecutar`, data)
  return response.data
}

export async function verificarQEAccion(
  qeId: string,
  acId: string,
  data: VerificarQEACInput,
): Promise<AccionCorrectivaQE> {
  const response = await api.post<AccionCorrectivaQE>(`${acRuta(qeId, acId)}/verificar`, data)
  return response.data
}

export async function solicitarAjustePlazoAC(
  qeId: string,
  acId: string,
  data: SolicitarAjustePlazoACInput,
): Promise<AccionCorrectivaQE> {
  const response = await api.post<AccionCorrectivaQE>(
    `/api/quality-events/${qeId}/acciones-correctivas/${acId}/solicitud-plazo`,
    data,
  )
  return response.data
}

export async function revisarAjustePlazoAC(
  qeId: string,
  acId: string,
  solicitudId: string,
  data: { accion: 'APROBAR' | 'RECHAZAR'; comentarioRevision?: string },
): Promise<AccionCorrectivaQE> {
  const estado = data.accion === 'APROBAR' ? 'APROBADA' : 'RECHAZADA'
  const response = await api.patch<AccionCorrectivaQE>(
    `/api/quality-events/${qeId}/acciones-correctivas/${acId}/solicitud-plazo/${solicitudId}`,
    { estado, comentarioRevision: data.comentarioRevision },
  )
  return response.data
}

export async function editarReporteInicial(
  id: string,
  data: QualityEventEditReporteInicialInput,
): Promise<QualityEvent> {
  const response = await api.patch<QualityEvent>(`/api/quality-events/${id}/editar-reporte-inicial`, data)
  return response.data
}

export async function editarSeveridad(
  id: string,
  data: QualityEventEditSeveridadInput,
): Promise<EditarSeveridadResponse> {
  const response = await api.patch<EditarSeveridadResponse>(`/api/quality-events/${id}/editar-severidad`, data)
  return response.data
}

export async function editarMineral(
  id: string,
  data: QualityEventEditMineralInput,
): Promise<QualityEvent> {
  const response = await api.patch<QualityEvent>(`/api/quality-events/${id}/editar-mineral`, data)
  return response.data
}

export async function exportQualityEventPdf(id: string): Promise<void> {
  // El backend real responde 204 No Content (solo registra auditoría, ExportarPdfQEHandler no
  // genera ni devuelve el QE) — ver design.md Hallazgo 6. Nunca devolver response.data acá.
  await api.post(`/api/quality-events/${id}/export-pdf`)
}

export async function getQEAuditTrail(qeId: string): Promise<QEAuditTrailEntry[]> {
  const response = await api.get<QEAuditTrailEntry[]>(`/api/quality-events/${qeId}/audit-trail`)
  return response.data
}

export async function solicitarACEnQE(qeId: string): Promise<QualityEvent> {
  const response = await api.patch<QualityEvent>(`/api/quality-events/${qeId}/solicitar-ac`)
  return response.data
}

// solicitudes-ac-y-ac-del-qe-en-origen: el JCA descarta una solicitud pendiente con motivo.
export async function descartarSolicitudAC(qeId: string, motivo: string): Promise<QualityEvent> {
  const response = await api.post<QualityEvent>(`/api/quality-events/${qeId}/solicitudes-ac/descartar`, { motivo })
  return response.data
}

export async function cerrarQE(id: string, data: QualityEventCierreFormInput): Promise<QualityEvent> {
  const response = await api.patch<QualityEvent>(`/api/quality-events/${id}/cerrar`, data)
  return response.data
}

export async function firmarCierre(id: string, data: FirmarCierreInput): Promise<QualityEvent> {
  const response = await api.patch<QualityEvent>(`/api/quality-events/${id}/firmar-cierre`, data)
  return response.data
}

// PRD §1.5 P5: el supervisor del área rechaza el cierre (sin PIN) — vuelve a EN_EJECUCION.
export async function rechazarCierre(id: string, motivo: string): Promise<QualityEvent> {
  const response = await api.post<QualityEvent>(`/api/quality-events/${id}/rechazar-cierre`, { motivo })
  return response.data
}

// RN-QE-002: el servidor verifica el PIN y fija firmante y hora — el cliente solo envía el PIN.
export async function aprobarCausaRaiz(id: string, pin: string): Promise<QualityEvent> {
  const response = await api.post<QualityEvent>(`/api/quality-events/${id}/aprobar-causa-raiz`, { pin })
  return response.data
}

export async function getFuncionalidades(): Promise<Funcionalidades> {
  const response = await api.get<Funcionalidades>('/api/config/funcionalidades')
  return response.data
}

// qe-asistente-ia: devuelve una sugerencia sin guardarla; el usuario decide qué usar. El método
// define si trae 5 Porqués o Ishikawa (qe-asistente-ia-ishikawa).
export async function asistirCausaRaizIA(
  id: string,
  metodo: AnalisisCausaRaizMetodo,
): Promise<SugerenciaCausaRaizIA> {
  const response = await api.post<SugerenciaCausaRaizIA>(`/api/quality-events/${id}/asistente-ia`, { metodo })
  return response.data
}

export async function forzarVencimientoVerificacion(
  id: string,
  auditorAsignadoId?: string,
): Promise<QualityEvent> {
  const response = await api.patch<QualityEvent>(
    `/api/quality-events/${id}/forzar-vencimiento-verificacion`,
    { auditorAsignadoId },
  )
  return response.data
}

export async function vincularDocumento(qeId: string, documentoId: string): Promise<QualityEvent> {
  const response = await api.post<QualityEvent>(`/api/quality-events/${qeId}/documentos-vinculados`, { documentoId })
  return response.data
}

export async function desvincularDocumento(qeId: string, documentoId: string): Promise<QualityEvent> {
  const response = await api.delete<QualityEvent>(`/api/quality-events/${qeId}/documentos-vinculados/${documentoId}`)
  return response.data
}

export async function registrarVerificacionEficacia(
  id: string,
  data: VerificacionEficaciaInput,
): Promise<QualityEvent> {
  const response = await api.post<QualityEvent>(`/api/quality-events/${id}/verificacion-eficacia`, data)
  return response.data
}

export async function getCandidatosResponsableQE(): Promise<CandidatoResponsableQE[]> {
  const response = await api.get<CandidatoResponsableQE[]>('/api/quality-events/candidatos-responsable')
  return response.data
}

export async function asignarResponsableQE(id: string, responsableInvestigacionId: string): Promise<QualityEvent> {
  const response = await api.patch<QualityEvent>(`/api/quality-events/${id}/responsable`, { responsableInvestigacionId })
  return response.data
}
