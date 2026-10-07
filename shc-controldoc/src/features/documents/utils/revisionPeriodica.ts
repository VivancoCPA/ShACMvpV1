import { DOC_REVISION_ALERT_DAYS } from '../../../config/businessRules.config'

export type RevisionPeriodicaNivel = 'ok' | 'proximo' | 'vencido'

// revision-periodica-trazabilidad: único lugar con el umbral de "¿hace falta prestarle
// atención a esta revisión periódica?" — RevisionSemaforo (para su corte verde/no-verde) y el
// aviso del detalle del documento (DocumentDetailHeader) consumen este helper en vez de repetir
// la comparación contra DOC_REVISION_ALERT_DAYS cada uno por su lado.
export function getRevisionPeriodicaNivel(diasRestantes: number): RevisionPeriodicaNivel {
  if (diasRestantes > DOC_REVISION_ALERT_DAYS) return 'ok'
  if (diasRestantes <= 0) return 'vencido'
  return 'proximo'
}
