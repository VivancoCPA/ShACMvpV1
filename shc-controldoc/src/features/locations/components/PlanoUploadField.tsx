import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const MAX_PLANO_BYTES = 2 * 1024 * 1024

interface PlanoUploadFieldProps {
  value: File | null
  onChange: (file: File | null) => void
  existingUrl?: string
  disabled?: boolean
}

export function PlanoUploadField({
  value,
  onChange,
  existingUrl,
  disabled = false,
}: PlanoUploadFieldProps) {
  const { t } = useTranslation('locations')
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!value) {
      setObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(value)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  const previewUrl = value ? objectUrl : (existingUrl ?? null)

  function validate(file: File): string | null {
    if (file.type !== 'image/png') return t('form.plano.formatoInvalido')
    if (file.size > MAX_PLANO_BYTES) return t('form.plano.tamanoInvalido')
    return null
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    const validationError = validate(file)
    if (validationError) {
      setError(validationError)
      onChange(null)
    } else {
      setError(null)
      onChange(file)
    }
  }

  function handleClear() {
    onChange(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const fileInput = (
    <input
      ref={inputRef}
      id="planoUrl"
      type="file"
      accept="image/png"
      disabled={disabled}
      className="sr-only"
      onChange={(e) => handleFiles(e.target.files)}
    />
  )

  if (previewUrl) {
    return (
      <div className="space-y-2">
        <div className="overflow-hidden rounded-lg border border-hairline bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark-elevated">
          <img
            src={previewUrl}
            alt={t('form.plano.previewAlt')}
            className="h-40 w-full object-contain"
          />
        </div>
        <div className="flex items-center gap-3">
          {!disabled && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-sm text-coral hover:text-coral-dark dark:hover:text-coral-dark"
            >
              {t('form.plano.reemplazar')}
            </button>
          )}
          {!disabled && value && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={t('form.plano.quitar')}
              className="rounded p-1 text-muted transition-colors hover:text-error dark:text-on-dark-soft dark:hover:text-error"
            >
              ✕
            </button>
          )}
        </div>
        {fileInput}
        {error && (
          <p role="alert" className="text-xs text-error">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <label
        htmlFor="planoUrl"
        className={`flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-hairline bg-canvas px-3.5 py-4 text-sm text-muted hover:border-coral hover:text-coral dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:border-coral dark:hover:text-coral ${
          disabled ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        {t('form.plano.dragHint')}
      </label>
      {fileInput}
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  )
}
