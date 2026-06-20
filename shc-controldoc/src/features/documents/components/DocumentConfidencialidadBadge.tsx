import { Globe, Building2, Lock, ShieldOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DocConfidencialidad } from '../../../types/documents.types'

interface DocumentConfidencialidadBadgeProps {
  confidencialidad: DocConfidencialidad
}

const CONFIG: Record<
  DocConfidencialidad,
  { icon: React.ElementType; classes: string }
> = {
  PUBLICO: {
    icon: Globe,
    classes: 'bg-success/20 text-success dark:bg-success/15 dark:text-success',
  },
  INTERNO: {
    icon: Building2,
    classes: 'bg-teal/20 text-teal dark:bg-teal/15 dark:text-teal',
  },
  CONFIDENCIAL: {
    icon: Lock,
    classes: 'bg-amber/20 text-amber dark:bg-amber/15 dark:text-amber',
  },
  RESTRINGIDO: {
    icon: ShieldOff,
    classes: 'bg-error/20 text-error dark:bg-error/15 dark:text-error',
  },
}

export function DocumentConfidencialidadBadge({
  confidencialidad,
}: DocumentConfidencialidadBadgeProps) {
  const { t } = useTranslation('documents')
  const { icon: Icon, classes } = CONFIG[confidencialidad]

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[9999px] px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(`confidencialidad.${confidencialidad}`)}
    </span>
  )
}
