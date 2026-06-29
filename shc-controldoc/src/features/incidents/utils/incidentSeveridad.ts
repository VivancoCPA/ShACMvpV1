import type { IncidentType, IncidentSeveridad } from '../types/incident.types'

export function getAutoSeveridad(tipo: IncidentType, numLesionados?: number): IncidentSeveridad {
  if (tipo === 'ACCIDENTE') {
    if (numLesionados !== undefined && numLesionados > 1) return 'CRITICA'
    return 'ALTA'
  }
  if (tipo === 'INCIDENTE') return 'MEDIA'
  if (tipo === 'CUASI_ACCIDENTE') return 'MEDIA'
  return 'BAJA'
}
