import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { signatureSchema } from '../schemas/documentAction.schema'
import type { SignatureInput } from '../schemas/documentAction.schema'
import { useSignDocument } from '../hooks/useDocumentActions'
import { useAuthStore } from '../../../stores/authStore'

interface DocumentSignatureModalProps {
  documentId: string
  onClose: () => void
}

export function DocumentSignatureModal({ documentId, onClose }: DocumentSignatureModalProps) {
  const { t } = useTranslation('documents')
  const tienePinFirma = useAuthStore((s) => s.user?.tienePinFirma)
  const signMutation = useSignDocument(documentId)
  const modalRef = useRef<HTMLDivElement>(null)
  const headingId = `sig-modal-${documentId}`
  // true cuando el backend respondió errorCode: 'PIN_NO_CONFIGURADO' aunque tienePinFirma
  // fuera true al abrir el modal (el PIN se reseteó entre medio) — ver design.md D6.
  const [pinResetMidSession, setPinResetMidSession] = useState(false)
  const [genericError, setGenericError] = useState<string | null>(null)
  const noPinConfigured = tienePinFirma === false || pinResetMidSession

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignatureInput>({
    resolver: zodResolver(signatureSchema),
  })

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

  async function onSubmit(data: SignatureInput) {
    setGenericError(null)
    try {
      await signMutation.mutateAsync({ pin: data.pin })
      onClose()
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { errorCode?: string; message?: string } } })
        ?.response
      if (response?.data?.errorCode === 'PIN_NO_CONFIGURADO') {
        setPinResetMidSession(true)
        return
      }
      if (response?.status === 401) {
        setError('pin', { message: t('signature.errorInvalid') })
        return
      }
      setGenericError(response?.data?.message ?? t('signature.errorGeneric'))
    }
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
          {t('signature.title')}
        </h2>

        <p className="mb-5 rounded-md bg-amber/10 px-3 py-2.5 text-sm text-amber dark:bg-amber/15">
          {t('signature.legalText')}
        </p>

        {noPinConfigured ? (
          <div className="mb-5 rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-body dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark">
            <p className="mb-1.5">{t('signature.noPinConfigured')}</p>
            <Link to="/perfil" className="font-medium text-coral hover:underline">
              {t('signature.configurePinLink')}
            </Link>
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {!noPinConfigured && (
            <div className="mb-5">
              <label
                htmlFor="sig-pin"
                className="mb-1.5 block text-sm font-medium text-body dark:text-on-dark"
              >
                {t('signature.pinLabel')}
              </label>
              <input
                id="sig-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoComplete="off"
                className="h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-muted-soft focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark"
                placeholder={t('signature.pinPlaceholder')}
                {...register('pin')}
              />
              {errors.pin && (
                <p className="mt-1.5 text-xs text-error" role="alert">
                  {errors.pin.message}
                </p>
              )}
            </div>
          )}

          {genericError && (
            <p className="mb-5 text-xs text-error" role="alert">
              {genericError}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
            >
              {t('signature.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || signMutation.isPending || noPinConfigured}
              className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-50"
            >
              {t('signature.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
