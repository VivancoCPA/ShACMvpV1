import { AlertTriangle, ClipboardX, Search, Mail } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { QEOrigin } from '../types/qualityEvent.types'

const ORIGIN_CONFIG: Record<QEOrigin, { icon: LucideIcon; label: string; classes: string }> = {
  O1_INCIDENTE_CAMPO: {
    icon: AlertTriangle,
    label: 'Campo',
    classes: 'bg-amber/10 text-amber dark:bg-amber/15',
  },
  O2_NC_DETECTADA: {
    icon: ClipboardX,
    label: 'NC',
    classes: 'bg-error/10 text-error dark:bg-error/15',
  },
  O3_HALLAZGO_AUDITORIA: {
    icon: Search,
    label: 'Auditoría',
    classes: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  },
  O4_REPORTE_EXTERNO: {
    icon: Mail,
    label: 'Externo',
    classes: 'bg-teal/10 text-teal dark:bg-teal/15',
  },
}

interface QEOriginBadgeProps {
  origin: QEOrigin
  className?: string
}

export function QEOriginBadge({ origin, className }: QEOriginBadgeProps) {
  const { icon: Icon, label, classes } = ORIGIN_CONFIG[origin]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium ${classes}${className ? ` ${className}` : ''}`}
    >
      <Icon size={10} aria-hidden="true" />
      {label}
    </span>
  )
}
