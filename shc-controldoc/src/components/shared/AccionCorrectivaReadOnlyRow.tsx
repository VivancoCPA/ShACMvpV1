import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { DeadlineBadge } from './DeadlineBadge'
import type { AccionCorrectivaTipo } from '../../constants/accionCorrectivaTipo.constants'

// Forma mínima común a las AC de QE, incidente y NC: la fila solo lee, nunca actúa.
export interface AccionCorrectivaReadOnly {
  id: string
  titulo?: string
  descripcion: string
  tipo?: AccionCorrectivaTipo
  responsableNombre: string
  estado: string
  plazoFecha: string
  verificadaPorNombre?: string | null
  verificadaEn?: string | null
}

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-muted-soft/20 text-muted dark:bg-muted-soft/20 dark:text-on-dark-soft',
  EN_EJECUCION: 'bg-amber/20 text-amber dark:bg-amber/20 dark:text-amber',
  COMPLETADA: 'bg-teal/20 text-teal dark:bg-teal/20 dark:text-teal',
  CERRADA: 'bg-success/20 text-success dark:bg-success/20 dark:text-success',
  VENCIDA: 'bg-error/20 text-error dark:bg-error/20 dark:text-error',
}

interface AccionCorrectivaReadOnlyRowProps {
  ac: AccionCorrectivaReadOnly
  href?: string
}

// solicitudes-ac-y-ac-del-qe-en-origen: AC del QE mostradas en solo lectura desde el incidente o
// la NC de origen (y las AC propias "anteriores"). Sin botones: el flujo se trabaja en el QE.
export function AccionCorrectivaReadOnlyRow({ ac, href }: AccionCorrectivaReadOnlyRowProps) {
  const { t, i18n } = useTranslation('common')
  const formatoFecha = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  return (
    <li className="py-3">
      {ac.titulo && <p className="text-sm font-medium text-body dark:text-on-dark">{ac.titulo}</p>}
      <p className="text-sm text-body dark:text-on-dark-soft">{ac.descripcion}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {ac.tipo && (
          <span className="rounded-pill bg-surface-cream px-2 py-0.5 text-xs font-medium text-body dark:bg-surface-dark-soft dark:text-on-dark-soft">
            {t(`acTipo.${ac.tipo}`)}
          </span>
        )}
        <span
          className={`rounded-pill px-2 py-0.5 text-xs font-medium ${ESTADO_COLORS[ac.estado] ?? ESTADO_COLORS.PENDIENTE}`}
        >
          {t(`acEstado.${ac.estado}`, { defaultValue: ac.estado })}
        </span>
        <span className="text-xs text-muted dark:text-on-dark-soft">{ac.responsableNombre}</span>
        <DeadlineBadge fechaCierre={ac.plazoFecha} estado={ac.estado} />
      </div>
      {ac.estado === 'CERRADA' && ac.verificadaPorNombre && ac.verificadaEn && (
        <p className="mt-1 text-xs text-success dark:text-success">
          {t('acReadOnly.verificadaPor', {
            nombre: ac.verificadaPorNombre,
            fecha: formatoFecha.format(new Date(ac.verificadaEn)),
          })}
        </p>
      )}
      {href && (
        <Link
          to={href}
          className="mt-1 inline-flex items-center gap-1 text-xs text-coral hover:underline dark:text-coral"
        >
          <ArrowUpRight size={12} aria-hidden="true" />
          {t('acReadOnly.verEnQE')}
        </Link>
      )}
    </li>
  )
}
