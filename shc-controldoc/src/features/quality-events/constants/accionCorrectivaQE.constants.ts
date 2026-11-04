import type { QEStatus } from '../types/qualityEvent.types'

// Estados en los que el Jefe de Calidad puede dar de alta ACs del QE — compartido por QEACSection
// y por "Crear AC" desde una acción sugerida por el asistente IA (qe-asistente-ia).
export const AC_CREATE_VISIBLE_STATES: QEStatus[] = ['EN_INVESTIGACION', 'ANALISIS_COMPLETADO', 'EN_EJECUCION']
