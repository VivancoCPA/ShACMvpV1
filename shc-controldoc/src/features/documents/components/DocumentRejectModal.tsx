import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { rejectSchema } from '../schemas/documentAction.schema'
import type { RejectInput } from '../schemas/documentAction.schema'
import { useChangeStatus } from '../hooks/useDocumentActions'

interface DocumentRejectModalProps {
  documentId: string
  onClose: () => void
}

export function DocumentRejectModal({ documentId, onClose }: DocumentRejectModalProps) {
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const changeStatus = useChangeStatus(documentId)
  const modalRef = useRef<HTMLDivElement>(null)
  const headingId = `reject-modal-${documentId}`

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RejectInput>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { notificarAutor: true },
  })

  // Focus trap
  useEffect(() => {
    const el = modalRef.current
    if (!el) return
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, textarea, input, [tabindex]:not([tabindex="-1"])',
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

  async function onSubmit(data: RejectInput) {
    await changeStatus.mutateAsync({
      estado: 'BORRADOR',
      motivo: data.motivo,
      notificarAutor: data.notificarAutor,
    })
    toast.success(t('reject.successMessage'))
    onClose()
    navigate(-1)
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
        <h2
          id={headingId}
          className="mb-4 text-lg font-semibold text-ink dark:text-on-dark"
        >
          {t('reject.title')}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="mb-4">
            <label
              htmlFor="reject-motivo"
              className="mb-1.5 block text-sm font-medium text-body dark:text-on-dark"
            >
              {t('reject.motivoLabel')}
            </label>
            <textarea
              id="reject-motivo"
              rows={4}
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-muted-soft focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark"
              placeholder={t('reject.motivoPlaceholder')}
              {...register('motivo')}
            />
            {errors.motivo && (
              <p className="mt-1.5 text-xs text-error" role="alert">
                {errors.motivo.message}
              </p>
            )}
            <p className="mt-1 text-xs text-muted dark:text-on-dark-soft">
              {t('reject.motivoHint')}
            </p>
          </div>

          <div className="mb-5 flex items-center gap-2">
            <input
              id="reject-notify"
              type="checkbox"
              className="h-4 w-4 rounded border-hairline text-coral accent-coral"
              {...register('notificarAutor')}
            />
            <label
              htmlFor="reject-notify"
              className="text-sm text-body dark:text-on-dark"
            >
              {t('reject.notifyAuthor')}
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
            >
              {t('reject.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || changeStatus.isPending}
              className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {t('reject.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
