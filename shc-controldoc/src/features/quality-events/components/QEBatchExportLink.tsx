import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface QEBatchExportLinkProps {
  count: number
  disabled: boolean
  onClick: () => void
}

export function QEBatchExportLink({ count, disabled, onClick }: QEBatchExportLinkProps) {
  const { t } = useTranslation('qualityEvents')
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-coral hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline dark:text-coral dark:disabled:text-on-dark-soft"
    >
      <Download size={14} aria-hidden="true" />
      {t('list.batchExport.exportarConteo', { count })}
    </button>
  )
}
