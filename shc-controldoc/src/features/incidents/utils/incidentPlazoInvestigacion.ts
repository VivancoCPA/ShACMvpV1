import type { IncidentSeveridad } from '../types/incident.types'

export function getPlazoInvestigacion(severidad: IncidentSeveridad): number {
  switch (severidad) {
    case 'CRITICA':
      return 3
    case 'ALTA':
      return 7
    case 'MEDIA':
      return 10
    case 'BAJA':
      return 15
  }
}
