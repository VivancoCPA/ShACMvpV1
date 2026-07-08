import type { KpiDefinition, KpiId } from '../types/kpi.types'
import type { QESeverity } from '../../quality-events/types/qualityEvent.types'

// Plazo máximo (días hábiles) para que un QE se considere "en plazo" al cerrar (KPI-01),
// derivado de sumar los plazos por severidad de SHAC-PRD-003 §1.3 para EN_INVESTIGACION
// (varía por severidad) + ANALISIS_COMPLETADO (2d, fijo) + PENDIENTE_CIERRE (5d, fijo).
// EN_EJECUCION se excluye: su plazo es por AC individual (§1.6), no agregado a nivel de QE.
// Ver openspec/changes/m5-s01-fix-kpis-prd/design.md decisión 6.
export const PLAZO_MAXIMO_QE_DIAS_HABILES: Record<QESeverity, number> = {
  BAJA: 22, // 15 + 2 + 5
  MEDIA: 17, // 10 + 2 + 5
  ALTA: 14, // 7 + 2 + 5
  CRITICA: 10, // 3 + 2 + 5
}

export const KPI_DEFINITIONS: Record<KpiId, KpiDefinition> = {
  'KPI-01': {
    id: 'KPI-01',
    nombre: 'Tasa de cierre de QE en plazo',
    descripcion: 'Porcentaje de Quality Events cerrados o verificados dentro del plazo máximo aplicable a su severidad.',
    formula: "% de QE con estado en CERRADO/VERIFICADO, fechaCierre en el periodo, y (fechaCierre - fechaHoraReporte en días hábiles) <= plazoMaximo(severidad)",
    unidad: 'PORCENTAJE',
    metaTipo: 'ABSOLUTO',
    meta: 90,
    frecuencia: 'MENSUAL',
    fuente: 'Quality Events',
  },
  'KPI-02': {
    id: 'KPI-02',
    nombre: 'Tiempo promedio de cierre de QE',
    descripcion: 'Promedio de días hábiles transcurridos entre el reporte y el cierre de un Quality Event.',
    formula: 'Promedio en días hábiles de fechaCierre - fechaHoraReporte para QE en CERRADO/VERIFICADO cerrados en el periodo',
    unidad: 'DIAS',
    metaTipo: 'ABSOLUTO',
    meta: 15,
    frecuencia: 'MENSUAL',
    fuente: 'Quality Events',
  },
  'KPI-03': {
    id: 'KPI-03',
    nombre: 'Tasa de reincidencia (reaperturas)',
    descripcion: 'Porcentaje de Quality Events cerrados en el periodo que corresponden a una reapertura (ciclo > 1).',
    formula: '% de QE con ciclo > 1 sobre QE en CERRADO/VERIFICADO cerrados en el periodo',
    unidad: 'PORCENTAJE',
    metaTipo: 'ABSOLUTO',
    meta: 5,
    frecuencia: 'TRIMESTRAL',
    fuente: 'Quality Events',
  },
  'KPI-04': {
    id: 'KPI-04',
    nombre: 'Índice de frecuencia de incidentes',
    descripcion: 'Tasa de incidentes con lesionados por cada 1,000,000 de horas trabajadas, comparada contra el mismo periodo del año anterior.',
    formula: '(N.º incidentes con huboLesionados=true x 1 000 000) / horas trabajadas del periodo',
    unidad: 'TASA',
    metaTipo: 'REDUCCION_INTERANUAL',
    meta: 10,
    frecuencia: 'MENSUAL',
    fuente: 'Incidentes y horas trabajadas',
  },
  'KPI-05': {
    id: 'KPI-05',
    nombre: 'Tasa de eficacia de acciones correctivas',
    descripcion: 'Porcentaje de acciones correctivas (origen QE/NC) cuyo padre fue verificado como efectivo.',
    formula: "% de AC (origen QE/NC) cuyo padre tiene resultadoVerificacion='EFECTIVO' sobre ACs cerradas cuyo padre fue verificado en el periodo",
    unidad: 'PORCENTAJE',
    metaTipo: 'ABSOLUTO',
    meta: 85,
    frecuencia: 'MENSUAL',
    fuente: 'Quality Events, No Conformidades',
  },
  'KPI-06': {
    id: 'KPI-06',
    nombre: '% Documentos vigentes bajo control',
    descripcion: 'Porcentaje de documentos publicados cuya fecha de revisión próxima no está vencida.',
    formula: '% de Documento en PUBLICADO con fechaRevisionProxima >= hoy sobre el total de Documento en PUBLICADO',
    unidad: 'PORCENTAJE',
    metaTipo: 'ABSOLUTO',
    meta: 100,
    frecuencia: 'MENSUAL',
    fuente: 'Documentos',
  },
  'KPI-07': {
    id: 'KPI-07',
    nombre: 'Tiempo promedio de investigación',
    descripcion: 'Promedio de días hábiles entre el reporte de un Quality Event y su transición a análisis completado.',
    formula: 'Promedio en días hábiles de fechaAnalisisCompletado - fechaHoraReporte para QE con transición a ANALISIS_COMPLETADO en el periodo',
    unidad: 'DIAS',
    metaTipo: 'ABSOLUTO',
    meta: 7,
    frecuencia: 'MENSUAL',
    fuente: 'Quality Events',
  },
  'KPI-08': {
    id: 'KPI-08',
    nombre: 'ACs vencidas activas',
    descripcion: 'Conteo en tiempo real de acciones correctivas (QE, NC, Incidentes) vencidas y aún no cerradas.',
    formula: 'Conteo de AC (QE+NC+Incidentes) con estado no terminal y plazoFecha < hoy',
    unidad: 'CONTEO',
    metaTipo: 'ABSOLUTO',
    meta: 3,
    frecuencia: 'TIEMPO_REAL',
    fuente: 'Quality Events, No Conformidades, Incidentes',
  },
  'KPI-09': {
    id: 'KPI-09',
    nombre: 'NCs por área (mapa de calor)',
    descripcion: 'Distribución de Quality Events por área afectada en el periodo, para identificar las áreas con mayor concentración.',
    formula: 'Conteo de QE por areaAfectada en el periodo, ranking descendente',
    unidad: 'DISTRIBUCION',
    metaTipo: 'ABSOLUTO',
    meta: 3,
    frecuencia: 'MENSUAL',
    fuente: 'Quality Events',
  },
}
