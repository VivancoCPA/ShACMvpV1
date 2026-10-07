import type { ApiResponse } from './api.types'

export type NotificacionTipo =
  | 'CAMBIO_ESTADO'
  | 'ASIGNACION'
  | 'VENCIMIENTO'
  | 'SEVERIDAD_CRITICA'
  | 'CIERRE'
  | 'VERIFICACION_EFICAZ'
  | 'COMERCIO_EXTERIOR'

export type NotificacionEntidadTipo = 'QE' | 'NC' | 'INCIDENTE' | 'DOCUMENTO' | 'AC'

export interface Notificacion {
  id: string
  usuarioId: string
  empresaId: string
  tipo: NotificacionTipo
  entidadTipo: NotificacionEntidadTipo
  entidadId: string
  entidadCodigo: string
  mensaje: string
  leida: boolean
  createdAt: string
  link: string
  // revision-periodica-trazabilidad: distingue el "ciclo" de vencimiento al que pertenece una
  // notificación VENCIMIENTO de Documento (p.ej. "PREAVISO:2026-03-01" / "VENCIDO:2026-03-01").
  // Ausente/undefined para AC/Incidente — su idempotencia sigue siendo "una sola notificación
  // para siempre por entidad", sin cambios (ver design.md D1, espejo del backend).
  cicloClave?: string
}

export type NotificacionesListResponse = ApiResponse<Notificacion[]>
export type MarcarLeidaResponse = ApiResponse<Notificacion>
export type MarcarTodasLeidasResponse = ApiResponse<Notificacion[]>
