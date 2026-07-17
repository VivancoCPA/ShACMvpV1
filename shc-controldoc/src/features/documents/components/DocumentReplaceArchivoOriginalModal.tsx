import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUploadField } from './FileUploadField'
import { useReplaceArchivoOriginal } from '../hooks/useDocumentActions'

interface DocumentReplaceArchivoOriginalModalProps {
  documentId: string
  archivoOriginalNombre?: string | null
  onClose: () => void
}

export function DocumentReplaceArchivoOriginalModal({
  documentId,
  archivoOriginalNombre,
  onClose,
}: DocumentReplaceArchivoOriginalModalProps) {
  const { t } = useTranslation('documents')
  const modalRef = useRef<HTMLDivElement>(null)
  const headingId = `replace-archivo-original-modal-${documentId}`
  const [file, setFile] = useState<File | null>(null)

  const replaceArchivoOriginal = useReplaceArchivoOriginal(documentId)

  // Focus trap
  useEffect(() => {
    const el = modalRef.current
    if (!el) return
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, input, [tabindex]:not([tabindex="-1"])',
    )
    focusable[0]?.focus()

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleConfirm() {
    if (!file) return
    await replaceArchivoOriginal.mutateAsync(file)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm dark:bg-ink/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="w-full max-w-md rounded-xl bg-surface-card p-6 shadow-xl dark:bg-surface-dark-elevated"
      >
        <h2 id={headingId} className="mb-1 text-lg font-semibold text-ink dark:text-on-dark">
          {t('archivo.original.modal.title')}
        </h2>
        <p className="mb-4 text-xs text-muted dark:text-on-dark-soft">
          {t('archivo.original.modal.hint')}
        </p>

        {archivoOriginalNombre && (
          <p className="mb-3 text-sm text-body dark:text-on-dark">
            {t('archivo.original.modal.archivoActual', { nombre: archivoOriginalNombre })}
          </p>
        )}

        <FileUploadField
          value={file}
          onChange={setFile}
          variant="original"
          isUploading={replaceArchivoOriginal.isPending}
        />

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={replaceArchivoOriginal.isPending}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft disabled:opacity-50 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
          >
            {t('archivo.original.modal.cancelar')}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!file || replaceArchivoOriginal.isPending}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('archivo.original.modal.confirmar')}
          </button>
        </div>
      </div>
    </div>
  )
}
