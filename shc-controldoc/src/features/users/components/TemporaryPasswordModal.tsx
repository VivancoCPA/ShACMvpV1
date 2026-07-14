import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Copy, Check } from 'lucide-react'

interface TemporaryPasswordModalProps {
  nombre: string
  password: string
  onClose: () => void
}

export function TemporaryPasswordModal({ nombre, password, onClose }: TemporaryPasswordModalProps) {
  const { t } = useTranslation('users')
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('temporaryPassword.cerrar')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <h2 className="font-medium text-ink dark:text-on-dark">{t('temporaryPassword.titulo')}</h2>
        <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">
          {t('temporaryPassword.mensaje', { nombre })}
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-md border border-hairline bg-surface-soft px-3 py-2 dark:border-hairline/20 dark:bg-surface-dark-soft">
          <code className="flex-1 select-all font-mono text-sm text-ink dark:text-on-dark">{password}</code>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? t('temporaryPassword.copiado') : t('temporaryPassword.copiar')}
            className="flex items-center gap-1 rounded-md border border-hairline bg-canvas px-2 py-1 text-xs font-medium text-ink transition-colors hover:bg-surface-cream dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? t('temporaryPassword.copiado') : t('temporaryPassword.copiar')}
          </button>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
          >
            {t('temporaryPassword.cerrar')}
          </button>
        </div>
      </div>
    </div>
  )
}
