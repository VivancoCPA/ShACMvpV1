import type { AxiosError } from 'axios'

// 422 del backend cuando el estado o el vínculo del incidente los gobierna su Quality Event
// (incidentes-qe-estado-alertas D4) — se muestran con su texto propio en vez del genérico.
const INCIDENT_ERROR_CODES = ['ESTADO_GOBERNADO_POR_QE', 'QE_VINCULO_GESTIONADO_POR_QE'] as const

type IncidentErrorCode = (typeof INCIDENT_ERROR_CODES)[number]

function isIncidentErrorCode(code: unknown): code is IncidentErrorCode {
  return typeof code === 'string' && (INCIDENT_ERROR_CODES as readonly string[]).includes(code)
}

/** Clave i18n (`incidents:...`) del mensaje de error de una mutación de incidente. */
export function getIncidentErrorKey(error: unknown, fallbackKey: string): string {
  const errorCode = (error as AxiosError<{ errorCode?: string }> | undefined)?.response?.data?.errorCode
  return isIncidentErrorCode(errorCode) ? `errors.${errorCode}` : fallbackKey
}
