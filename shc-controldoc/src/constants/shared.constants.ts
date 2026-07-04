import type { IncidentType, IncidentStatus, CondicionEntorno } from '../features/incidents/types/incident.types'
import type { QEStatus, QEType, QESeverity, QEOrigin } from '../features/quality-events/types/qualityEvent.types'

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  ACCIDENTE: 'Accidente',
  INCIDENTE: 'Incidente',
  CUASI_ACCIDENTE: 'Cuasi-accidente',
  CONDICION_INSEGURA: 'Condición insegura',
}

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  ABIERTO: 'Abierto',
  EN_INVESTIGACION: 'En investigación',
  ANALISIS_COMPLETADO: 'Análisis completado',
  EN_EJECUCION: 'En ejecución',
  PENDIENTE_CIERRE: 'Pendiente de cierre',
  CERRADO: 'Cerrado',
  ANULADO: 'Anulado',
}

export const CONDICION_ENTORNO_LABELS: Record<CondicionEntorno, string> = {
  ILUMINACION: 'Iluminación',
  PISO: 'Piso',
  SENALIZACION: 'Señalización',
  EPP: 'EPP',
  CLIMA: 'Clima',
  OTRO: 'Otro',
}

export const QE_STATUS_LABELS: Record<QEStatus, string> = {
  ABIERTO: 'Abierto',
  EN_INVESTIGACION: 'En investigación',
  ANALISIS_COMPLETADO: 'Análisis completado',
  EN_EJECUCION: 'En ejecución',
  PENDIENTE_CIERRE: 'Pendiente de cierre',
  CERRADO: 'Cerrado',
  EN_VERIFICACION: 'En verificación',
  VERIFICADO: 'Verificado',
  REABIERTO: 'Reabierto',
}

export const QE_TYPE_LABELS: Record<QEType, string> = {
  CALIDAD: 'Calidad',
  SST: 'SST',
  ADUANERO: 'Aduanero',
  OPERACIONAL: 'Operacional',
}

export const QE_SEVERITY_LABELS: Record<QESeverity, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
}

export const QE_ORIGIN_LABELS: Record<QEOrigin, string> = {
  O1_INCIDENTE_CAMPO: 'Incidente en campo',
  O2_NC_DETECTADA: 'No conformidad detectada',
  O3_HALLAZGO_AUDITORIA: 'Hallazgo de auditoría',
  O4_REPORTE_EXTERNO: 'Reporte externo',
}

export const QE_SEVERITY_COLORS: Record<QESeverity, string> = {
  BAJA: 'bg-teal/10 text-teal border-teal/20',
  MEDIA: 'bg-amber/10 text-amber border-amber/20',
  ALTA: 'bg-error/10 text-error border-error/20',
  CRITICA: 'bg-error text-white border-error',
}

export const QE_MINERALES = [
  'Cobre',
  'Zinc',
  'Plomo',
  'Hierro',
  'Molibdeno',
  'Plata',
  'Oro',
  'Estaño',
  'Concentrado de cobre',
  'Concentrado de zinc',
  'Concentrado de plomo',
] as const

export const AREAS_SHAC: readonly string[] = [
  'Almacén Norte',
  'Almacén Sur',
  'Área de Carga',
  'Área de Contenedores',
  'Archivo Documentario',
  'Auditoría',
  'Calidad',
  'Control de Calidad',
  'Control Documentario',
  'Galpón B',
  'Galpón C',
  'Gerencia',
  'Laboratorio de Calidad',
  'Laboratorio de Muestras',
  'Logística',
  'Operaciones',
  'Operaciones Aduaneras',
  'RR.HH.',
  'SyST',
]
