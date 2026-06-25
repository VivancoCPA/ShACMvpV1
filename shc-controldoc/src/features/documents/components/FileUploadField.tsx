import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const ACCEPTED_TYPES_GENERIC = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])
const ACCEPTED_TYPES_ORIGINAL = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])
const ACCEPTED_TYPES_DISTRIBUCION = new Set(['application/pdf'])
const MAX_BYTES = 50 * 1024 * 1024 // 50 MiB

type FileUploadVariant = 'generic' | 'original' | 'distribucion'

interface FileUploadFieldProps {
  value: File | null
  onChange: (file: File | null) => void
  existingFileUrl?: string
  existingFileName?: string
  disabled?: boolean
  isUploading?: boolean
  variant?: FileUploadVariant
  frozenMessage?: string
  replaceLabel?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileNameFromUrl(url: string): string {
  return url.split('/').pop() ?? url
}

export function FileUploadField({
  value,
  onChange,
  existingFileUrl,
  existingFileName,
  disabled = false,
  isUploading = false,
  variant = 'generic',
  frozenMessage,
  replaceLabel,
}: FileUploadFieldProps) {
  const { t } = useTranslation('documents')
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [showExisting, setShowExisting] = useState(!!(existingFileUrl || existingFileName) && !value)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const acceptedTypes =
    variant === 'original' ? ACCEPTED_TYPES_ORIGINAL :
    variant === 'distribucion' ? ACCEPTED_TYPES_DISTRIBUCION :
    ACCEPTED_TYPES_GENERIC

  const acceptAttr =
    variant === 'original' ? '.docx,.xlsx' :
    variant === 'distribucion' ? '.pdf' :
    '.pdf,.doc,.docx,.xls,.xlsx'

  const formatHint =
    variant === 'original' ? t('archivo.formatosOriginal') :
    variant === 'distribucion' ? t('archivo.formatosDistribucion') :
    t('archivo.formatosAceptados')

  const replaceBtnLabel = replaceLabel ?? t('form.upload_replace')

  useEffect(() => {
    setShowExisting(!!(existingFileUrl || existingFileName) && !value)
  }, [existingFileUrl, existingFileName, value])

  useEffect(() => {
    if (isUploading && value) {
      setProgress(0)
      const steps = [
        { pct: 25, delay: 300 },
        { pct: 50, delay: 700 },
        { pct: 75, delay: 1100 },
        { pct: 100, delay: 1500 },
      ]
      timeoutsRef.current = steps.map(({ pct, delay }) =>
        setTimeout(() => setProgress(pct), delay),
      )
    } else {
      setProgress(null)
    }
    return () => {
      timeoutsRef.current.forEach(clearTimeout)
      timeoutsRef.current = []
    }
  }, [isUploading, value])

  function validate(file: File): string | null {
    if (!acceptedTypes.has(file.type)) return t('form.error_file_type')
    if (file.size > MAX_BYTES) return t('form.error_file_size')
    return null
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    const err = validate(file)
    if (err) {
      setError(err)
      onChange(null)
    } else {
      setError(null)
      setShowExisting(false)
      onChange(file)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (!disabled) handleFiles(e.dataTransfer.files)
  }

  function handleClear() {
    onChange(null)
    setError(null)
    setProgress(null)
    setShowExisting(!!(existingFileUrl || existingFileName))
    if (inputRef.current) inputRef.current.value = ''
  }

  const dropZoneBase =
    'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors'
  const dropZoneIdle =
    'border-hairline bg-canvas hover:border-coral/60 dark:border-hairline/30 dark:bg-surface-dark dark:hover:border-coral/40'
  const dropZoneDragging =
    'border-coral/70 bg-coral/5 dark:border-coral/50 dark:bg-coral/10'
  const dropZoneDisabled =
    'border-hairline/50 bg-surface-soft opacity-60 cursor-not-allowed dark:border-hairline/20 dark:bg-surface-dark-elevated'

  const dropZoneCls = `${dropZoneBase} ${
    disabled ? dropZoneDisabled : isDragging ? dropZoneDragging : dropZoneIdle
  } ${!disabled ? 'cursor-pointer' : ''}`

  // Frozen state — original file locked (RN-DOC-015)
  if (frozenMessage) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber/30 bg-amber/5 px-4 py-3 dark:border-amber/20 dark:bg-amber/10">
        <span className="text-lg">🔒</span>
        <span className="flex-1 text-sm text-muted dark:text-on-dark-soft">{frozenMessage}</span>
      </div>
    )
  }

  // Show existing file preview (edit mode, no new file selected)
  const displayName = existingFileName ?? (existingFileUrl ? fileNameFromUrl(existingFileUrl) : null)
  if (showExisting && displayName) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-soft px-4 py-3 dark:border-hairline/30 dark:bg-surface-dark-elevated">
        <span className="text-lg text-muted dark:text-on-dark-soft">📄</span>
        <span className="flex-1 truncate text-sm text-ink dark:text-on-dark">
          {displayName}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={() => setShowExisting(false)}
            className="text-sm text-coral hover:text-coral-dark dark:hover:text-coral-dark"
          >
            {replaceBtnLabel}
          </button>
        )}
      </div>
    )
  }

  // Show selected file
  if (value) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-soft px-4 py-3 dark:border-hairline/30 dark:bg-surface-dark-elevated">
          <span className="text-lg text-muted dark:text-on-dark-soft">📄</span>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-ink dark:text-on-dark">{value.name}</p>
            <p className="text-xs text-muted dark:text-on-dark-soft">{formatBytes(value.size)}</p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Quitar archivo"
              className="rounded p-1 text-muted transition-colors hover:text-error dark:text-on-dark-soft dark:hover:text-error"
            >
              ✕
            </button>
          )}
        </div>
        {progress !== null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline dark:bg-surface-dark-elevated">
            <div
              className="h-full rounded-full bg-coral transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  // Drop zone (empty state)
  return (
    <div className="space-y-1">
      <div
        className={dropZoneCls}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => { if (!disabled) inputRef.current?.click() }}
        role="button"
        aria-label={t('form.upload_drag')}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click() }}
      >
        <span className="text-2xl text-muted dark:text-on-dark-soft">📁</span>
        <p className="text-sm font-medium text-ink dark:text-on-dark">{t('form.upload_drag')}</p>
        <p className="text-xs text-muted dark:text-on-dark-soft">{formatHint}</p>
      </div>
      {error && (
        <p role="alert" className="text-xs text-error">{error}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
