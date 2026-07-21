import type { ApiResponse } from './api.types'

export type NotificacionTipo = 'CAMBIO_ESTADO' | 'ASIGNACION' | 'VENCIMIENTO'

export type NotificacionEntidadTipo = 'QE' | 'NC' | 'INCIDENTE' | 'DOCUMENTO' | 'AC'

export interface Notificacion {
  id: string
  usuarioId: string
  tipo: NotificacionTipo
  entidadTipo: NotificacionEntidadTipo
  entidadId: string
  entidadCodigo: string
  mensaje: string
  leida: boolean
  createdAt: string
  link: string
}

export type NotificacionesListResponse = ApiResponse<Notificacion[]>
export type MarcarLeidaResponse = ApiResponse<Notificacion>
export type MarcarTodasLeidasResponse = ApiResponse<Notificacion[]>
