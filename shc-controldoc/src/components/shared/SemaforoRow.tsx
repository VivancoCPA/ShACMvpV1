import { useTranslation } from 'react-i18next'
import type { SemaforoEstadoFila } from '../../features/dashboard/types/semaforo.types'

interface SemaforoRowProps {
  estado: SemaforoEstadoFila
  codigo: string
  descripcion: string
  diasHabilesRestantes: number
  onClick?: () => void
}

const BORDER_CLASS: Record<SemaforoEstadoFila, string> = {
  VERDE: 'border-l-success',
  AMARILLO: 'border-l-warning',
  ROJO: 'border-l-error',
}

const TEXT_CLASS: Record<SemaforoEstadoFila, string> = {
  VERDE: 'text-success dark:text-success',
  AMARILLO: 'text-warning dark:text-warning',
  ROJO: 'text-error dark:text-error',
}

export function SemaforoRow({ estado, codigo, descripcion, diasHabilesRestantes, onClick }: SemaforoRowProps) {
  const { t } = useTranslation()

  const plazoTexto =
    diasHabilesRestantes > 0
      ? t('dashboard:semaforo.venceEn', { dias: diasHabilesRestantes })
      : diasHabilesRestantes === 0
        ? t('dashboard:semaforo.venceHoy')
        : t('dashboard:semaforo.vencidoHace', { dias: Math.abs(diasHabilesRestantes) })

  const className = `flex w-full items-center justify-between gap-4 rounded-lg rounded-l-none border-y border-r border-y-hairline border-r-hairline dark:border-y-hairline/20 dark:border-r-hairline/20 bg-surface-card dark:bg-surface-dark-elevated border-l-[3px] ${BORDER_CLASS[estado]} px-4 py-3 text-left`

  const content = (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink dark:text-on-dark">{codigo}</p>
        <p className="truncate text-sm text-muted dark:text-on-dark-soft">{descripcion}</p>
      </div>
      <span className={`shrink-0 text-sm font-medium ${TEXT_CLASS[estado]}`}>{plazoTexto}</span>
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}
