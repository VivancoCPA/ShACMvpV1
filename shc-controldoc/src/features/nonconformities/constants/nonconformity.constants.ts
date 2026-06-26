import type { NCStatus, NCTipo, NCSeveridad, NCOrigen, NCDominio } from '../types/nonconformity.types'

export const NC_DOMINIO_VALUES: NCDominio[] = ['CALIDAD', 'SST', 'ADUANERO', 'OPERACIONAL', 'PROVEEDOR']

export const NC_STATE_TRANSITIONS: Record<NCStatus, NCStatus[]> = {
  ABIERTA: ['EN_INVESTIGACION', 'ANULADA'],
  EN_INVESTIGACION: ['ANALISIS_COMPLETADO', 'ANULADA'],
  ANALISIS_COMPLETADO: ['EN_EJECUCION'],
  EN_EJECUCION: ['PENDIENTE_CIERRE', 'EN_INVESTIGACION'],
  PENDIENTE_CIERRE: ['CERRADA', 'EN_INVESTIGACION'],
  CERRADA: [],
  ANULADA: [],
}

export const NC_STATUS_LABELS: Record<NCStatus, string> = {
  ABIERTA: 'nonconformities:status.ABIERTA',
  EN_INVESTIGACION: 'nonconformities:status.EN_INVESTIGACION',
  ANALISIS_COMPLETADO: 'nonconformities:status.ANALISIS_COMPLETADO',
  EN_EJECUCION: 'nonconformities:status.EN_EJECUCION',
  PENDIENTE_CIERRE: 'nonconformities:status.PENDIENTE_CIERRE',
  CERRADA: 'nonconformities:status.CERRADA',
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
  BAJA: 'common:severity.BAJA',
  MEDIA: 'common:severity.MEDIA',
  ALTA: 'common:severity.ALTA',
  CRITICA: 'common:severity.CRITICA',
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
  BAJA: 'bg-muted-soft/20 text-muted',
  MEDIA: 'bg-amber/20 text-amber',
  ALTA: 'bg-error/10 text-error',
  CRITICA: 'bg-error/20 text-error font-semibold',
}

export const NC_STATUS_COLORS: Record<NCStatus, string> = {
  ABIERTA: 'bg-teal/20 text-teal',
  EN_INVESTIGACION: 'bg-amber/20 text-amber',
  ANALISIS_COMPLETADO: 'bg-amber/30 text-amber',
  EN_EJECUCION: 'bg-coral/20 text-coral',
  PENDIENTE_CIERRE: 'bg-warning/20 text-warning',
  CERRADA: 'bg-success/20 text-success',
  ANULADA: 'bg-muted-soft/20 text-muted',
}
