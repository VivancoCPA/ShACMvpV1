import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { validateAvatarFile } from '../../users/schemas/avatarFile.schema'

interface LogoUploadFieldProps {
  value: string | undefined
  onChange: (base64: string | undefined) => void
  error: string | null
  onError: (message: string | null) => void
}

// Mismo patrón que avatarBase64 en UserFormModal (me-f4-admin-empresas design.md, D6):
// conversión a data URI en el cliente vía FileReader, no FormData/File crudo.
export function LogoUploadField({ value, onChange, error, onError }: LogoUploadFieldProps) {
  const { t } = useTranslation('empresas')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateAvatarFile(file)
    if (!validation.ok) {
      onError(validation.message ? t(validation.message) : null)
      return
    }
    onError(null)

    const reader = new FileReader()
    reader.onload = () => onChange(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleClear() {
    onChange(undefined)
    onError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <label className="mb-1 block text-sm font-medium text-body dark:text-on-dark-soft">
        {t('form.fields.logo')}
      </label>

      {value ? (
        <div className="flex items-center gap-3">
          <img
            src={value}
            alt={t('form.logoPreviewAlt')}
            className="h-16 w-16 rounded-md border border-hairline object-contain dark:border-hairline/20"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-sm text-coral hover:text-coral-dark"
          >
            {t('form.actions.reemplazarLogo')}
          </button>
          <button
            type="button"
            onClick={handleClear}
            aria-label={t('form.actions.quitarLogo')}
            className="rounded p-1 text-muted transition-colors hover:text-error dark:text-on-dark-soft dark:hover:text-error"
          >
            ✕
          </button>
        </div>
      ) : (
        <label
          htmlFor="logoFile"
          className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-hairline bg-canvas px-3.5 py-4 text-sm text-muted hover:border-coral hover:text-coral dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark-soft"
        >
          {t('form.dragHintLogo')}
        </label>
      )}

      <input
        ref={inputRef}
        id="logoFile"
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        onChange={handleChange}
      />
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  )
}
