import { z } from 'zod'
import { todayCalendarDateIso, addCalendarDays } from '../../../utils/date.utils'

export const REVISION_PERIODICA_MIN_GAP_DAYS = 30

// revision-periodica-fecha-editable (D6): fechaRevisionProxima es opcional (REG/INF puede
// dejarse vacío); cuando SÍ tiene valor, debe cumplir el margen mínimo de 30 días desde hoy —
// misma regla que el backend (ConfirmarRevisionPeriodicaValidator), aquí solo para feedback
// inmediato en el formulario; el servidor sigue siendo quien la hace cumplir de verdad.
export const confirmarRevisionPeriodicaSchema = z.object({
  fechaRevisionProxima: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.fechaRevisionProxima) return

  const minimo = addCalendarDays(todayCalendarDateIso(), REVISION_PERIODICA_MIN_GAP_DAYS)
  if (data.fechaRevisionProxima < minimo) {
    ctx.addIssue({
      code: 'custom',
      path: ['fechaRevisionProxima'],
      message: `La próxima revisión debe ser al menos ${REVISION_PERIODICA_MIN_GAP_DAYS} días después de hoy.`,
    })
  }
})

export type ConfirmarRevisionPeriodicaInput = z.infer<typeof confirmarRevisionPeriodicaSchema>
