import type { Local, Zona, Incidente } from '../../incidents/types/incident.types'

const MAX_LOCALES_ACTIVOS = 5

const ESTADOS_BLOQUEANTES_LOCAL = ['ABIERTO', 'EN_INVESTIGACION']
const ESTADOS_BLOQUEANTES_ZONA = ['ABIERTO', 'EN_INVESTIGACION', 'EN_EJECUCION']

export function puedeCrearLocalActivo(locales: Local[]): boolean {
  const localesActivos = locales.filter((local) => local.activo).length
  return localesActivos < MAX_LOCALES_ACTIVOS
}

export function puedeDesactivarLocal(
  local: Local,
  incidentes: Incidente[],
): { permitido: boolean; incidentesBloqueantes: number } {
  const incidentesBloqueantes = incidentes.filter(
    (incidente) =>
      incidente.localId === local.id && ESTADOS_BLOQUEANTES_LOCAL.includes(incidente.estado),
  ).length
  return { permitido: incidentesBloqueantes === 0, incidentesBloqueantes }
}

export function puedeDesactivarZona(
  zona: Zona,
  incidentes: Incidente[],
): { permitido: boolean; incidentesBloqueantes: number } {
  const incidentesBloqueantes = incidentes.filter(
    (incidente) =>
      incidente.zonaId === zona.id && ESTADOS_BLOQUEANTES_ZONA.includes(incidente.estado),
  ).length
  return { permitido: incidentesBloqueantes === 0, incidentesBloqueantes }
}
