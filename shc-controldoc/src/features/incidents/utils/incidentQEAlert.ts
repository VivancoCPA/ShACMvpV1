import type { Incidente, IncidentType } from '../types/incident.types'
import { ACTIVE_STATES } from './incidentPermissions'

export type IncidentQEAlertLevel = 'NONE' | 'AMARILLO' | 'ROJO'

// RN-INC-006 — plazo (horas, contadas desde fechaEvento) para vincular un QE a un
// incidente. Tabla del PRD §3, nunca antes codificada: el PRD original decía "todo
// incidente genera un QE"; M4-S09 dejó la creación de QE como acción manual (botón
// "Crear QE"). Esta tabla alimenta la alerta que complementa esa decisión.
export const PLAZO_QE_HORAS: Record<IncidentType, number> = {
  ACCIDENTE: 24,
  INCIDENTE: 48,
  CUASI_ACCIDENTE: 72,
  CONDICION_INSEGURA: 48,
}

// Ventana de preaviso: "amarillo" arranca al alcanzar el 75% del plazo transcurrido,
// "rojo" al superarlo por completo.
const UMBRAL_AMARILLO = 0.75

// RN-INC-006 — mismo criterio de "incidente activo" que canCrearQE (incidentPermissions.ts):
// un incidente eliminado o ya CERRADO/ANULADO nunca debe alertar, tenga o no qeId.
export function getIncidentQEAlertLevel(
  incidente: Pick<Incidente, 'tipo' | 'estado' | 'fechaEvento' | 'qeId' | 'deletedAt'>,
  now: Date = new Date(),
): IncidentQEAlertLevel {
  if (incidente.qeId) return 'NONE'
  if (incidente.deletedAt) return 'NONE'
  if (!ACTIVE_STATES.includes(incidente.estado)) return 'NONE'

  const plazoHoras = PLAZO_QE_HORAS[incidente.tipo]
  const elapsedHoras = (now.getTime() - new Date(incidente.fechaEvento).getTime()) / (60 * 60 * 1000)

  if (elapsedHoras >= plazoHoras) return 'ROJO'
  if (elapsedHoras >= plazoHoras * UMBRAL_AMARILLO) return 'AMARILLO'
  return 'NONE'
}
