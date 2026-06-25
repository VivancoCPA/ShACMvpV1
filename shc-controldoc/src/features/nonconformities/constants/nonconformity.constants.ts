import type { NCStatus, NCTipo, NCSeveridad, NCOrigen } from '../types/nonconformity.types'

export const NC_STATE_TRANSITIONS: Record<NCStatus, NCStatus[]> = {
  DETECTADA: ['EN_INVESTIGACION', 'ANULADA'],
  EN_INVESTIGACION: ['EN_CORRECCION'],
  EN_CORRECCION: ['PENDIENTE_CIERRE', 'EN_INVESTIGACION'],
  PENDIENTE_CIERRE: ['CERRADA', 'EN_INVESTIGACION'],
  CERRADA: ['REABIERTA'],
  REABIERTA: ['EN_INVESTIGACION'],
  ANULADA: [],
}

export const NC_STATUS_LABELS: Record<NCStatus, string> = {
  DETECTADA: 'nonconformities:status.DETECTADA',
  EN_INVESTIGACION: 'nonconformities:status.EN_INVESTIGACION',
  EN_CORRECCION: 'nonconformities:status.EN_CORRECCION',
  PENDIENTE_CIERRE: 'nonconformities:status.PENDIENTE_CIERRE',
  CERRADA: 'nonconformities:status.CERRADA',
  REABIERTA: 'nonconformities:status.REABIERTA',
  ANULADA: 'nonconformities:status.ANULADA',
}

export const NC_TIPO_LABELS: Record<NCTipo, string> = {
  PROCESO: 'nonconformities:tipo.PROCESO',
  PRODUCTO: 'nonconformities:tipo.PRODUCTO',
  SERVICIO: 'nonconformities:tipo.SERVICIO',
  SISTEMA: 'nonconformities:tipo.SISTEMA',
  SST: 'nonconformities:tipo.SST',
}

export const NC_SEVERIDAD_LABELS: Record<NCSeveridad, string> = {
  MENOR: 'nonconformities:severidad.MENOR',
  MAYOR: 'nonconformities:severidad.MAYOR',
  CRITICA: 'nonconformities:severidad.CRITICA',
}

export const NC_ORIGEN_LABELS: Record<NCOrigen, string> = {
  INSPECCION_INTERNA: 'nonconformities:origen.INSPECCION_INTERNA',
  AUDITORIA_INTERNA: 'nonconformities:origen.AUDITORIA_INTERNA',
  AUDITORIA_EXTERNA: 'nonconformities:origen.AUDITORIA_EXTERNA',
  CLIENTE_RECLAMO: 'nonconformities:origen.CLIENTE_RECLAMO',
  OPERACION_CAMPO: 'nonconformities:origen.OPERACION_CAMPO',
  CONTROL_PROCESO: 'nonconformities:origen.CONTROL_PROCESO',
}

export const NC_SEVERIDAD_COLORS: Record<NCSeveridad, string> = {
  MENOR: 'bg-teal/10 text-teal border border-teal/20',
  MAYOR: 'bg-amber/10 text-amber border border-amber/20',
  CRITICA: 'bg-error/10 text-error border border-error/20',
}

export const NC_STATUS_COLORS: Record<NCStatus, string> = {
  DETECTADA: 'bg-amber/10 text-amber border border-amber/20',
  EN_INVESTIGACION: 'bg-teal/10 text-teal border border-teal/20',
  EN_CORRECCION: 'bg-teal/10 text-teal border border-teal/20',
  PENDIENTE_CIERRE: 'bg-warning/10 text-warning border border-warning/20',
  CERRADA: 'bg-success/10 text-success border border-success/20',
  REABIERTA: 'bg-warning/10 text-warning border border-warning/20',
  ANULADA: 'bg-muted/10 text-muted border border-muted/20',
}
