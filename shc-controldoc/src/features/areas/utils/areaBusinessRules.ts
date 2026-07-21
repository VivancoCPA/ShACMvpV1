import type { Area, AreaConteoBloqueo } from '../types/area.types'
import type { QualityEvent } from '../../quality-events/types/qualityEvent.types'
import type { NoConformidad } from '../../nonconformities/types/nonconformity.types'
import type { Incidente } from '../../incidents/types/incident.types'

const ESTADOS_BLOQUEANTES_QE = [
  'ABIERTO',
  'EN_INVESTIGACION',
  'ANALISIS_COMPLETADO',
  'EN_EJECUCION',
  'PENDIENTE_CIERRE',
  'EN_VERIFICACION',
]

// NCStatus real (nonconformity.types.ts) no incluye 'DETECTADA'/'EN_CORRECCION'/'REABIERTA'
// mencionados en design.md Decisión 2 — el conjunto no-terminal real es
// ABIERTA/EN_INVESTIGACION/ANALISIS_COMPLETADO/EN_EJECUCION/PENDIENTE_CIERRE,
// excluyendo los dos estados terminales CERRADA/ANULADA (mismo criterio de "no-terminal").
const ESTADOS_BLOQUEANTES_NC = [
  'ABIERTA',
  'EN_INVESTIGACION',
  'ANALISIS_COMPLETADO',
  'EN_EJECUCION',
  'PENDIENTE_CIERRE',
]

const ESTADOS_BLOQUEANTES_INCIDENTE = [
  'ABIERTO',
  'EN_INVESTIGACION',
  'ANALISIS_COMPLETADO',
  'EN_EJECUCION',
  'PENDIENTE_CIERRE',
]

export function puedeDesactivarArea(
  area: Area,
  qes: QualityEvent[],
  ncs: NoConformidad[],
  incidentes: Incidente[],
): { permitido: boolean; conteo: AreaConteoBloqueo } {
  const qe = qes.filter(
    (item) => item.areaId === area.id && ESTADOS_BLOQUEANTES_QE.includes(item.estado),
  ).length
  const nc = ncs.filter(
    (item) => item.areaId === area.id && ESTADOS_BLOQUEANTES_NC.includes(item.estado),
  ).length
  const incidentesCount = incidentes.filter(
    (item) => item.areaId === area.id && ESTADOS_BLOQUEANTES_INCIDENTE.includes(item.estado),
  ).length

  const conteo: AreaConteoBloqueo = {
    qe,
    nc,
    incidentes: incidentesCount,
    total: qe + nc + incidentesCount,
  }

  return { permitido: conteo.total === 0, conteo }
}
