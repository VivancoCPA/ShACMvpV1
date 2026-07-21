import type { DocType } from '../types/documents.types'

// RN-DOC-020: brecha mínima en días entre fechaVigencia y fechaRevisionProxima.
export const DOC_REVISION_MIN_GAP_DAYS = 30

// RN-DOC-006: ventana de alerta (en días) antes de fechaRevisionProxima para
// disparar la notificación de revisión periódica (default, configurable por tipo
// según el PRD; hoy un único umbral global).
export const DOC_REVISION_ALERT_DAYS = 30

// RN-DOC-020 / PRD tabla 4.1 — periodicidad sugerida (en meses) para
// autocompletar fechaRevisionProxima según el tipo de documento. REG y INF
// quedan fuera (null): REG cambia con el proceso vinculado (no una fecha fija)
// y para INF fechaRevisionProxima es opcional ("no aplica revisión periódica").
export const DOC_PERIODICIDAD_POR_TIPO: Record<DocType, number | null> = {
  POL: 12,
  PRC: 12,
  INS: 24,
  REG: null,
  INF: null,
  MAT: 6,
  PLAN: 12,
}
