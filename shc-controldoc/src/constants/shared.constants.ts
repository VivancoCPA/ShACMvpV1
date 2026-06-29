import type { IncidentType, IncidentStatus, CondicionEntorno } from '../features/incidents/types/incident.types'

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
