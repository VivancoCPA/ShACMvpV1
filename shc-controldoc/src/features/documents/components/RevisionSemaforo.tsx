import { useTranslation } from 'react-i18next'
import { calendarDaysUntil, formatCalendarDate } from '../../../utils/date.utils'
import { getRevisionPeriodicaNivel } from '../utils/revisionPeriodica'

interface RevisionSemaforoProps {
  fechaRevisionProxima: string | null | undefined
}

// Punto de color + fecha, siempre visibles; el texto de días relativo ("en N días"/"hace N
// días"/"hoy") también es visible sin hover en ámbar y rojo — antes vivía en un tooltip que no
// aparecía en verde/vencido y no funciona en pantallas táctiles (semaforo-revision-con-fecha).
// El color nunca es el único portador de información.
function RelativeDays({ diasRestantes, t }: { diasRestantes: number; t: (key: string, options?: Record<string, unknown>) => string }) {
  if (diasRestantes === 0) return <span>{t('semaforo.hoy')}</span>
  if (diasRestantes > 0) return <span>{t('semaforo.enDias', { count: diasRestantes })}</span>
  return <span>{t('semaforo.haceDias', { count: Math.abs(diasRestantes) })}</span>
}

export function RevisionSemaforo({ fechaRevisionProxima }: RevisionSemaforoProps) {
  const { t, i18n } = useTranslation('documents')

  // El backend real serializa un DateTime? vacío como JSON null (Program.cs no configura
  // DefaultIgnoreCondition), no como clave ausente — a diferencia de lo que este componente
  // asumía (=== undefined). Con null, calendarDaysUntil(null) lanzaba un TypeError que el
  // ErrorBoundary de DocumentsPage atrapaba, tumbando toda la lista (fix-fechas-utc).
  if (fechaRevisionProxima == null) {
    return <span className="text-muted dark:text-on-dark-soft">—</span>
  }

  // fechaRevisionProxima es una fecha de calendario (fix-fechas-utc) — calendarDaysUntil/
  // formatCalendarDate no la desfasan un día en zonas horarias negativas, a diferencia de
  // differenceInCalendarDays(parseISO(...), new Date()) o new Date(iso) formateado localmente.
  const diasRestantes = calendarDaysUntil(fechaRevisionProxima)
  const fecha = formatCalendarDate(fechaRevisionProxima, i18n.language)

  // revision-periodica-trazabilidad: el corte verde/no-verde usa el mismo helper que el aviso
  // del detalle del documento (getRevisionPeriodicaNivel) — los umbrales de 8/1 días de abajo
  // son una subdivisión visual propia de este semáforo, sin equivalente en el aviso del detalle.
  if (getRevisionPeriodicaNivel(diasRestantes) === 'ok') {
    return (
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-success dark:bg-success" />
        <span className="text-xs text-body dark:text-on-dark">{fecha}</span>
      </span>
    )
  }

  if (diasRestantes >= 8) {
    return (
      <span className="flex items-start gap-1.5">
        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-warning dark:bg-warning" />
        <span className="flex flex-col">
          <span className="text-xs text-body dark:text-on-dark">{fecha}</span>
          <span className="text-xs text-muted dark:text-on-dark-soft">
            <RelativeDays diasRestantes={diasRestantes} t={t} />
          </span>
        </span>
      </span>
    )
  }

  if (diasRestantes >= 1) {
    return (
      <span className="flex items-start gap-1.5">
        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-error dark:bg-error" />
        <span className="flex flex-col">
          <span className="flex items-center gap-1.5">
            <span className="text-xs text-body dark:text-on-dark">{fecha}</span>
            <span className="rounded-[9999px] bg-error/20 px-1.5 py-0.5 text-xs font-medium text-error dark:bg-error/15 dark:text-error">
              {t('semaforo.proximo')}
            </span>
          </span>
          <span className="text-xs text-muted dark:text-on-dark-soft">
            <RelativeDays diasRestantes={diasRestantes} t={t} />
          </span>
        </span>
      </span>
    )
  }

  return (
    <span className="flex items-start gap-1.5">
      <span className="mt-1 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-error dark:bg-error" />
      <span className="flex flex-col">
        <span className="flex items-center gap-1.5">
          <span className="text-xs text-body dark:text-on-dark">{fecha}</span>
          <span className="rounded-[9999px] bg-error/20 px-1.5 py-0.5 text-xs font-medium text-error dark:bg-error/15 dark:text-error">
            {t('semaforo.vencido')}
          </span>
        </span>
        <span className="text-xs text-muted dark:text-on-dark-soft">
          <RelativeDays diasRestantes={diasRestantes} t={t} />
        </span>
      </span>
    </span>
  )
}
