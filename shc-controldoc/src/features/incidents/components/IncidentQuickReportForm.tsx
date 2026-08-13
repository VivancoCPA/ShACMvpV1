import { useState, useRef, useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Camera, MapPin, X, CheckCircle2, CloudOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '../../../stores/authStore'
import { enqueue, OfflineQueueError, type QueuedIncidentPayload } from '../../../lib/offlineQueue'
import { createIncident } from '../api/incidents.api'
import { INCIDENT_QUERY_KEYS } from '../hooks/useIncidents'
import { useAreas } from '../../areas/hooks/useAreas'
import { useGeolocationCapture } from '../hooks/useGeolocationCapture'
import { notifyIncidentEnqueued } from '../stores/offlineQueueStore'
import { compressPhoto } from '../utils/compressPhoto'
import { classifySubmitError } from '../utils/classifySubmitError'
import {
  mobileIncidentReportSchema,
  type MobileIncidentReportInput,
} from '../schemas/mobileIncidentReport.schema'
import type { IncidentType, IncidentEvidencia, Incidente } from '../types/incident.types'
import type { CreateIncidentInput } from '../schemas/createIncident.schema'

type SubmitResult = { type: 'created'; incidente: Incidente } | { type: 'queued' }

const TIPO_VALUES: IncidentType[] = ['ACCIDENTE', 'INCIDENTE', 'CUASI_ACCIDENTE', 'CONDICION_INSEGURA']
const MAX_FILES = 5

interface PhotoPreview {
  file: File
  previewUrl: string
  caption?: string
}

export function IncidentQuickReportForm() {
  const { t } = useTranslation('incidents')
  const user = useAuthStore((s) => s.user)
  const empresaActivaId = useAuthStore((s) => s.empresaActivaId)
  const queryClient = useQueryClient()
  const { data: areas = [] } = useAreas()
  const areasActivas = areas.filter((a) => a.activo)

  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [isCompressingPhotos, setIsCompressingPhotos] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { status: geoStatus, geoUbicacion, capture: captureGeo } = useGeolocationCapture()

  useEffect(() => {
    captureGeo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MobileIncidentReportInput>({
    resolver: zodResolver(mobileIncidentReportSchema),
    defaultValues: { huboLesionados: false },
  })

  const huboLesionadosValue = useWatch({ control, name: 'huboLesionados' }) as boolean

  const onPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    setPhotoError(null)

    if (photos.length + selected.length > MAX_FILES) {
      setPhotoError(t('mobile.form.evidencias.errorMaxFiles'))
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setIsCompressingPhotos(true)
    try {
      // Comprimidas antes de agregarlas al estado, no al sincronizar (m7-f2-offline-sync
      // design.md D2): lo que termina en `photos`/encolado ya es el archivo final y liviano.
      const compressedFiles = await Promise.all(selected.map((file) => compressPhoto(file)))
      const newPhotos = [
        ...photos,
        ...compressedFiles.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
      ]
      setPhotos(newPhotos)
      setValue('evidencias', newPhotos.map((p) => p.file))
    } finally {
      setIsCompressingPhotos(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removePhoto = (index: number) => {
    const updated = photos.filter((_, i) => i !== index)
    URL.revokeObjectURL(photos[index].previewUrl)
    setPhotos(updated)
    setValue('evidencias', updated.map((p) => p.file))
    setValue('evidenciaCaptions', updated.map((p) => p.caption))
  }

  const updatePhotoCaption = (index: number, caption: string) => {
    const updated = photos.map((p, i) => (i === index ? { ...p, caption } : p))
    setPhotos(updated)
    setValue('evidenciaCaptions', updated.map((p) => p.caption))
  }

  const onSubmit = async (data: MobileIncidentReportInput) => {
    const evidencias: IncidentEvidencia[] = photos.map((p, i) => ({
      id: `ev-mobile-${Date.now()}-${i}`,
      url: p.previewUrl,
      nombre: p.file.name,
      tipo: 'imagen',
      tamanioKb: Math.round(p.file.size / 1024),
      creadoEn: new Date().toISOString(),
      creadoPor: user?.id ?? 'user-mock',
      ...(p.caption ? { descripcion: p.caption } : {}),
    }))

    const queuedPayload: QueuedIncidentPayload = {
      tipo: data.tipo,
      descripcion: data.descripcion,
      areaId: data.areaId,
      turno: data.turno,
      fechaEvento: new Date().toISOString(),
      huboLesionados: data.huboLesionados,
      ...(data.numPersonasAfectadas !== undefined ? { numPersonasAfectadas: data.numPersonasAfectadas } : {}),
      ...(data.severidad ? { severidad: data.severidad } : {}),
    }

    const payload: CreateIncidentInput = {
      ...queuedPayload,
      ...(evidencias.length > 0 ? { evidencias } : {}),
      ...(geoUbicacion ? { geoUbicacion } : {}),
    }

    // Sin conexión (o sin empresa activa resuelta) no se intenta el request:
    // se encola directo. Ver design.md D6 — este submit NO reutiliza
    // `useCreateIncident` a propósito, para no heredar su `onError` de nivel
    // de hook (compartido con `IncidentNewPage` de escritorio, que siempre
    // muestra `toast.error`).
    const queueLocally = async () => {
      if (!empresaActivaId) {
        toast.error(t('toasts.createError'))
        return
      }
      try {
        await enqueue({
          payload: queuedPayload,
          photoBlobs: photos.map((p) => p.file),
          photoCaptions: photos.map((p) => p.caption),
          geoUbicacion,
          empresaId: empresaActivaId,
        })
        setSubmitResult({ type: 'queued' })
        void notifyIncidentEnqueued()
      } catch (error) {
        toast.error(error instanceof OfflineQueueError ? error.message : t('mobile.offline.enqueueError'))
      }
    }

    if (!navigator.onLine) {
      await queueLocally()
      return
    }

    try {
      const result = await createIncident(payload)
      void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      toast.success(t('toasts.created'))
      setSubmitResult({ type: 'created', incidente: result })
    } catch (error) {
      if (classifySubmitError(error) === 'network') {
        await queueLocally()
        return
      }
      toast.error(t('toasts.createError'))
    }
  }

  const reportarOtro = () => {
    setSubmitResult(null)
    setPhotos([])
    reset({ huboLesionados: false })
    captureGeo()
  }

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink h-11 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const selectClass = inputClass
  const textareaClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'block text-sm font-medium text-body dark:text-on-dark-soft mb-1'
  const errorClass = 'mt-1 text-xs text-error'

  if (submitResult?.type === 'created') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-hairline bg-surface-card p-8 text-center dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <CheckCircle2 size={40} className="text-success" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-ink dark:text-on-dark">
            {t('mobile.success.title')}
          </h2>
          <p className="text-sm text-muted dark:text-on-dark-soft">
            {t('mobile.success.numero', { numero: submitResult.incidente.numero })}
          </p>
          <button
            type="button"
            onClick={reportarOtro}
            className="mt-2 w-full rounded-md bg-coral px-5 py-3 text-sm font-medium text-white hover:bg-coral-dark"
          >
            {t('mobile.success.reportarOtro')}
          </button>
        </div>
      </div>
    )
  }

  if (submitResult?.type === 'queued') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-hairline bg-surface-card p-8 text-center dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <CloudOff size={40} className="text-muted dark:text-on-dark-soft" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-ink dark:text-on-dark">
            {t('mobile.offline.queuedTitle')}
          </h2>
          <p className="text-sm text-muted dark:text-on-dark-soft">
            {t('mobile.offline.queuedMessage')}
          </p>
          <button
            type="button"
            onClick={reportarOtro}
            className="mt-2 w-full rounded-md bg-coral px-5 py-3 text-sm font-medium text-white hover:bg-coral-dark"
          >
            {t('mobile.success.reportarOtro')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-5">
      <h1 className="font-display text-xl font-normal tracking-tight text-ink dark:text-on-dark">
        {t('mobile.form.title')}
      </h1>

      {/* Tipo */}
      <div>
        <label htmlFor="tipo" className={labelClass}>
          {t('form.fields.tipo')} <span className="text-error">*</span>
        </label>
        <select id="tipo" className={selectClass} {...register('tipo')}>
          <option value="">{t('form.placeholders.select')}</option>
          {TIPO_VALUES.map((tipo) => (
            <option key={tipo} value={tipo}>{t(`tipo.${tipo}`)}</option>
          ))}
        </select>
        {errors.tipo && <p className={errorClass}>{errors.tipo.message}</p>}
      </div>

      {/* Área */}
      <div>
        <label htmlFor="areaId" className={labelClass}>
          {t('form.fields.area')} <span className="text-error">*</span>
        </label>
        <select id="areaId" className={selectClass} {...register('areaId')}>
          <option value="">{t('form.placeholders.select')}</option>
          {areasActivas.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>
        {errors.areaId && <p className={errorClass}>{errors.areaId.message}</p>}
      </div>

      {/* Turno */}
      <div>
        <label htmlFor="turno" className={labelClass}>
          {t('form.fields.turno')} <span className="text-error">*</span>
        </label>
        <select id="turno" className={selectClass} {...register('turno')}>
          <option value="">{t('form.placeholders.select')}</option>
          <option value="DIA">{t('turno.DIA')}</option>
          <option value="TARDE">{t('turno.TARDE')}</option>
          <option value="NOCHE">{t('turno.NOCHE')}</option>
        </select>
        {errors.turno && <p className={errorClass}>{errors.turno.message}</p>}
      </div>

      {/* Descripción */}
      <div>
        <label htmlFor="descripcion" className={labelClass}>
          {t('form.fields.descripcion')} <span className="text-error">*</span>
        </label>
        <textarea
          id="descripcion"
          rows={4}
          maxLength={2000}
          className={textareaClass}
          placeholder={t('form.placeholders.descripcion')}
          {...register('descripcion')}
        />
        {errors.descripcion && <p className={errorClass}>{errors.descripcion.message}</p>}
      </div>

      {/* Severidad percibida (opcional) */}
      <div>
        <label htmlFor="severidad" className={labelClass}>
          {t('form.fields.severidad')}
          <span className="ml-1 text-xs font-normal text-muted dark:text-on-dark-soft">
            {t('mobile.form.severidadOpcional')}
          </span>
        </label>
        <select
          id="severidad"
          className={selectClass}
          {...register('severidad', { setValueAs: (v: string) => (v === '' ? undefined : v) })}
        >
          <option value="">{t('form.placeholders.select')}</option>
          <option value="BAJA">{t('severidad.BAJA')}</option>
          <option value="MEDIA">{t('severidad.MEDIA')}</option>
          <option value="ALTA">{t('severidad.ALTA')}</option>
          <option value="CRITICA">{t('severidad.CRITICA')}</option>
        </select>
      </div>

      {/* Hubo lesionados */}
      <div className="flex items-center gap-3">
        <input
          id="huboLesionados"
          type="checkbox"
          className="h-5 w-5 rounded border-hairline text-coral focus:ring-coral dark:border-hairline/20"
          {...register('huboLesionados')}
        />
        <label htmlFor="huboLesionados" className="text-sm text-body dark:text-on-dark-soft">
          {t('form.fields.huboLesionados')}
        </label>
      </div>

      {huboLesionadosValue && (
        <div>
          <label htmlFor="numPersonasAfectadas" className={labelClass}>
            {t('form.fields.numPersonasAfectadas')} <span className="text-error">*</span>
          </label>
          <input
            id="numPersonasAfectadas"
            type="number"
            min={1}
            className={inputClass}
            {...register('numPersonasAfectadas', { valueAsNumber: true })}
          />
          {errors.numPersonasAfectadas && (
            <p className={errorClass}>{errors.numPersonasAfectadas.message}</p>
          )}
        </div>
      )}

      {/* Ubicación GPS */}
      <div className="rounded-md border border-hairline bg-surface-soft px-3.5 py-2.5 dark:border-hairline/20 dark:bg-surface-dark-soft">
        <div className="flex items-center gap-2 text-sm">
          <MapPin size={16} className="shrink-0 text-muted dark:text-on-dark-soft" aria-hidden="true" />
          {geoStatus === 'capturing' && (
            <span className="flex items-center gap-1.5 text-muted dark:text-on-dark-soft">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              {t('mobile.gps.capturing')}
            </span>
          )}
          {geoStatus === 'success' && (
            <span className="text-success">{t('mobile.gps.captured')}</span>
          )}
          {(geoStatus === 'denied' || geoStatus === 'error' || geoStatus === 'unsupported') && (
            <span className="text-muted dark:text-on-dark-soft">{t('mobile.gps.unavailable')}</span>
          )}
          {geoStatus === 'idle' && (
            <span className="text-muted dark:text-on-dark-soft">{t('mobile.gps.idle')}</span>
          )}
        </div>
      </div>

      {/* Fotos */}
      <div>
        <label className={labelClass}>{t('mobile.form.evidencias.label')}</label>

        {photos.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div key={i} className="w-20">
                <div className="relative h-20 w-20 overflow-hidden rounded-md border border-hairline dark:border-hairline/20">
                  <img src={p.previewUrl} alt={p.file.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/60 text-white hover:bg-ink"
                    aria-label={t('form.evidencias.removeFile')}
                  >
                    <X size={12} />
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={140}
                  value={p.caption ?? ''}
                  onChange={(e) => updatePhotoCaption(i, e.target.value)}
                  placeholder={t('mobile.form.evidencias.captionPlaceholder')}
                  aria-label={t('mobile.form.evidencias.captionAriaLabel')}
                  className="mt-1 w-20 rounded border border-hairline bg-canvas px-1 py-0.5 text-[10px] text-ink focus:outline-none focus:ring-1 focus:ring-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
                />
                {errors.evidenciaCaptions?.[i] && (
                  <p className="text-[10px] text-error">{errors.evidenciaCaptions[i]?.message}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <label
          htmlFor="mobile-photo-upload"
          aria-disabled={isCompressingPhotos}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-hairline bg-canvas px-3 py-3 text-sm text-muted hover:border-coral hover:text-coral aria-disabled:pointer-events-none aria-disabled:opacity-60 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark-soft"
        >
          {isCompressingPhotos ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Camera size={16} />
          )}
          {isCompressingPhotos ? t('mobile.form.evidencias.compressing') : t('mobile.form.evidencias.uploadLabel')}
        </label>
        <input
          ref={fileInputRef}
          id="mobile-photo-upload"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          disabled={isCompressingPhotos}
          className="sr-only"
          onChange={(e) => void onPhotoChange(e)}
        />
        {photoError && <p className={errorClass}>{photoError}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting || isCompressingPhotos}
        className="w-full rounded-md bg-coral px-5 py-3 text-sm font-medium text-white hover:bg-coral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:opacity-60"
      >
        {isSubmitting ? t('form.actions.submitting') : t('mobile.form.submit')}
      </button>
    </form>
  )
}
