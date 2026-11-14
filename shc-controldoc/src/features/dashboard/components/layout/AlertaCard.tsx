import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export type AlertaNivel = 'error' | 'warning' | 'info'

interface AlertaCardBaseProps {
  valor: number
  titulo: string
  subtitulo?: string
  nivel: AlertaNivel
}

// Destino: o un enlace (otra pantalla, o `#id`), o un selector que filtra/selecciona una lista de la
// misma página vía `?alerta=` (dashboard-alertas-coherentes D1). Nunca los dos.
type AlertaCardProps = AlertaCardBaseProps &
  (
    | { to: string; onSelect?: never; activa?: never }
    | { onSelect: () => void; activa?: boolean; to?: never }
  )

// No hay token "info" en el design system: se usa la paleta azul de Tailwind, igual que
// QEStatusBadge/QETypeBadge.
const NIVEL_CLASSES: Record<AlertaNivel, { fondo: string; numero: string }> = {
  error: { fondo: 'bg-error/10 dark:bg-error/15', numero: 'text-error dark:text-error' },
  warning: { fondo: 'bg-amber/15 dark:bg-amber/15', numero: 'text-warning dark:text-amber' },
  info: { fondo: 'bg-blue-500/10 dark:bg-blue-400/15', numero: 'text-blue-700 dark:text-blue-300' },
}

// Anillo de la tarjeta seleccionada, en el color del nivel.
const ANILLO_ACTIVA: Record<AlertaNivel, string> = {
  error: 'ring-2 ring-error ring-offset-2 ring-offset-canvas dark:ring-error dark:ring-offset-surface-dark',
  warning: 'ring-2 ring-amber ring-offset-2 ring-offset-canvas dark:ring-amber dark:ring-offset-surface-dark',
  info: 'ring-2 ring-blue-500 ring-offset-2 ring-offset-canvas dark:ring-blue-400 dark:ring-offset-surface-dark',
}

const NEUTRO = { fondo: 'bg-surface-soft dark:bg-surface-dark-soft', numero: 'text-muted dark:text-on-dark-soft' }

export function AlertaCard(props: AlertaCardProps) {
  const { valor, titulo, subtitulo, nivel } = props
  const { t } = useTranslation('dashboard')
  const enCero = valor === 0
  const clases = enCero ? NEUTRO : NIVEL_CLASSES[nivel]
  const textoSecundario = enCero ? t('layout.todoEnOrden') : subtitulo

  const className = `flex items-center gap-3 rounded-lg px-4 py-3 transition hover:brightness-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral dark:hover:brightness-110 ${clases.fondo}`
  const contenido = (
    <>
      <span className={`text-3xl font-bold leading-none tabular-nums ${clases.numero}`}>{valor}</span>
      <span className="min-w-0">
        <span className={`block text-sm font-medium ${enCero ? 'text-muted dark:text-on-dark-soft' : 'text-ink dark:text-on-dark'}`}>
          {titulo}
        </span>
        {textoSecundario && (
          <span className="block text-xs text-muted dark:text-on-dark-soft">{textoSecundario}</span>
        )}
      </span>
    </>
  )
  const ariaLabel = `${valor} ${titulo}`

  if (props.onSelect) {
    const activa = props.activa ?? false
    return (
      <button
        type="button"
        onClick={props.onSelect}
        aria-pressed={activa}
        aria-label={ariaLabel}
        data-nivel={enCero ? 'neutro' : nivel}
        className={`w-full text-left ${className}${activa ? ` ${ANILLO_ACTIVA[nivel]}` : ''}`}
      >
        {contenido}
      </button>
    )
  }

  const to = props.to ?? ''
  if (to.startsWith('#')) {
    return (
      <a href={to} aria-label={ariaLabel} data-nivel={enCero ? 'neutro' : nivel} className={className}>
        {contenido}
      </a>
    )
  }
  return (
    <Link to={to} aria-label={ariaLabel} data-nivel={enCero ? 'neutro' : nivel} className={className}>
      {contenido}
    </Link>
  )
}
