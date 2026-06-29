import { useState, useRef, useEffect } from 'react'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Info,
  MapPin,
  Paperclip,
  X,
  Zap,
  ShieldAlert,
  HardHat,
  Eye,
} from 'lucide-react'
import { useAuthStore } from '../../../stores/authStore'
import { useCreateIncident, useUpdateIncident } from '../hooks/useIncidents'
import { useLocales } from '../hooks/useLocales'
import { useZonasByLocal } from '../hooks/useZonasByLocal'
import { getAutoSeveridad } from '../utils/incidentSeveridad'
import { getPlazoInvestigacion } from '../utils/incidentPlazoInvestigacion'
import { CondicionEntornoValues } from '../types/incident.types'
import {
  updateIncidentFormSchema,
  type UpdateIncidentFormInput,
} from '../schemas/incidentForm.schema'
import { AREAS_SHAC, CONDICION_ENTORNO_LABELS } from '../../../constants/shared.constants'
import type { Incidente, IncidentType, IncidentSeveridad, IncidenteUbicacion } from '../types/incident.types'
import type { IncidentEvidencia } from '../types/incident.types'

const TIPO_ICONS: Record<IncidentType, React.ReactNode> = {
  ACCIDENTE: <HardHat size={22} />,
  INCIDENTE: <AlertTriangle size={22} />,
  CUASI_ACCIDENTE: <Zap size={22} />,
  CONDICION_INSEGURA: <ShieldAlert size={22} />,
}

const TIPO_VALUES: IncidentType[] = ['ACCIDENTE', 'INCIDENTE', 'CUASI_ACCIDENTE', 'CONDICION_INSEGURA']
const SEVERIDAD_VALUES: IncidentSeveridad[] = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA']
const MAX_FILES = 5
const MAX_FILE_BYTES = 10 * 1024 * 1024

interface EvidenciaPreviewItem {
  file: File
  previewUrl: string | null
}

function buildPreview(file: File): EvidenciaPreviewItem {
  const isPdf = file.type === 'application/pdf'
  return { file, previewUrl: isPdf ? null : URL.createObjectURL(file) }
}

interface EvidenciasZonaProps {
  existingEvidencias?: IncidentEvidencia[]
  onFilesChange: (files: File[]) => void
  tipoAccidente: boolean
}

function EvidenciasZona({ existingEvidencias, onFilesChange, tipoAccidente }: EvidenciasZonaProps) {
  const { t } = useTranslation('incidents')
  const [previews, setPreviews] = useState<EvidenciaPreviewItem[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    setFileError(null)

    const allFiles = [...previews.map((p) => p.file), ...selected]
    if (allFiles.length > MAX_FILES) {
      setFileError(t('form.evidencias.errorMaxFiles'))
      return
    }

    for (const f of selected) {
      if (f.size > MAX_FILE_BYTES) {
        setFileError(t('form.evidencias.errorMaxSize', { nombre: f.name }))
        return
      }
    }

    const newPreviews = [...previews, ...selected.map(buildPreview)]
    setPreviews(newPreviews)
    onFilesChange(newPreviews.map((p) => p.file))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    const updated = previews.filter((_, i) => i !== index)
    const old = previews[index]
    if (old.previewUrl) URL.revokeObjectURL(old.previewUrl)
    setPreviews(updated)
    onFilesChange(updated.map((p) => p.file))
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-body dark:text-on-dark-soft">
        <Paperclip size={14} className="mr-1 inline-block" />
        {t('form.evidencias.label')}
      </label>

      {/* Existing evidencias (edit mode, not removable) */}
      {existingEvidencias && existingEvidencias.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {existingEvidencias.map((ev) => (
            <div key={ev.id} className="relative">
              {ev.tipo === 'imagen' ? (
                <div className="h-20 w-20 overflow-hidden rounded-md border border-hairline dark:border-hairline/20">
                  <img
                    src={ev.url}
                    alt={ev.nombre}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-hairline bg-surface-soft p-1 dark:border-hairline/20 dark:bg-surface-dark-soft">
                  <FileText size={20} className="text-muted dark:text-on-dark-soft" />
                  <span className="max-w-full truncate text-center text-[10px] text-muted dark:text-on-dark-soft">
                    {ev.nombre}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New file previews */}
      {previews.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {previews.map((p, i) => (
            <div key={i} className="relative">
              {p.previewUrl ? (
                <div className="relative h-20 w-20 overflow-hidden rounded-md border border-hairline dark:border-hairline/20">
                  <img src={p.previewUrl} alt={p.file.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink/60 text-white hover:bg-ink"
                    aria-label={t('form.evidencias.removeFile')}
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <div className="relative flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-hairline bg-surface-soft p-1 dark:border-hairline/20 dark:bg-surface-dark-soft">
                  <FileText size={20} className="text-muted dark:text-on-dark-soft" />
                  <span className="max-w-full truncate text-center text-[10px] text-muted dark:text-on-dark-soft">
                    {p.file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink/60 text-white hover:bg-ink"
                    aria-label={t('form.evidencias.removeFile')}
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <label
        htmlFor="evidencias-upload"
        className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-hairline bg-canvas px-3 py-2 text-sm text-muted hover:border-coral hover:text-coral dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:border-coral dark:hover:text-coral"
      >
        <Paperclip size={14} />
        {t('form.evidencias.uploadLabel', { max: MAX_FILES - previews.length })}
      </label>
      <input
        ref={fileInputRef}
        id="evidencias-upload"
        type="file"
        multiple
        accept="image/jpeg,image/png,application/pdf"
        className="sr-only"
        onChange={onFileChange}
      />
      {fileError && <p className="mt-1 text-xs text-error">{fileError}</p>}
      {tipoAccidente && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-amber">
          <Info size={12} className="mt-0.5 shrink-0" />
          {t('form.evidencias.acidenteNota')}
        </div>
      )}
    </div>
  )
}

interface IncidentFormProps {
  mode: 'create' | 'edit'
  incident?: Incidente
  onCancel?: () => void
}

export function IncidentForm({ mode, incident, onCancel }: IncidentFormProps) {
  const { t } = useTranslation('incidents')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isJefeCalidad = user?.rol === 'JEFE_CALIDAD_SYST'
  const isEdit = mode === 'edit'

  const [investigacionOpen, setInvestigacionOpen] = useState(true)
  const [newEvidencias, setNewEvidencias] = useState<File[]>([])
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const createMutation = useCreateIncident()
  const updateMutation = useUpdateIncident()

  type FormValues = UpdateIncidentFormInput

  const defaultValues = isEdit && incident
    ? {
        tipo: incident.tipo,
        descripcion: incident.descripcion,
        areaId: incident.areaId,
        turno: incident.turno as 'DIA' | 'TARDE' | 'NOCHE',
        fechaEvento: incident.fechaEvento.slice(0, 16),
        huboLesionados: incident.huboLesionados,
        numPersonasAfectadas: incident.numPersonasAfectadas,
        severidad: incident.severidad,
        personalInvolucrado: incident.personalInvolucrado?.join('\n'),
        testigos: incident.testigos?.join('\n'),
        equiposInvolucrados: incident.equiposInvolucrados?.join('\n'),
        condicionesEntorno: incident.condicionesEntorno ?? [],
        atencionMedicaRequerida: incident.atencionMedicaRequerida ?? false,
        atencionMedicaDescripcion: incident.atencionMedicaDescripcion,
        localId: incident.localId ?? '',
        zonaId: incident.zonaId ?? '',
        ubicacion: incident.ubicacion,
      }
    : { huboLesionados: false, condicionesEntorno: [], atencionMedicaRequerida: false }

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(updateIncidentFormSchema),
    defaultValues,
  })

  const tipoValue = useWatch({ control, name: 'tipo' }) as IncidentType | undefined
  const huboLesionadosValue = useWatch({ control, name: 'huboLesionados' }) as boolean
  const numAfectadasValue = useWatch({ control, name: 'numPersonasAfectadas' }) as number | undefined
  const severidadValue = useWatch({ control, name: 'severidad' }) as IncidentSeveridad | undefined
  const atencionMedicaValue = useWatch({ control, name: 'atencionMedicaRequerida' }) as boolean | undefined
  const localIdValue = useWatch({ control, name: 'localId' }) as string | undefined
  const ubicacionValue = useWatch({ control, name: 'ubicacion' }) as IncidenteUbicacion | undefined

  const { data: locales = [] } = useLocales()
  const { data: zonas = [] } = useZonasByLocal(localIdValue ?? '')
  const selectedLocal = locales.find((l) => l.id === localIdValue)

  // Auto-calc severity when tipo or numPersonasAfectadas changes
  useEffect(() => {
    if (!tipoValue) return
    if (!isJefeCalidad) {
      setValue('severidad', getAutoSeveridad(tipoValue, huboLesionadosValue ? numAfectadasValue : undefined))
    }
  }, [tipoValue, numAfectadasValue, huboLesionadosValue, isJefeCalidad, setValue])

  // Clear numPersonasAfectadas when huboLesionados is false
  useEffect(() => {
    if (!huboLesionadosValue) {
      setValue('numPersonasAfectadas', undefined)
    }
  }, [huboLesionadosValue, setValue])

  const plazoInvestigacion = severidadValue ? getPlazoInvestigacion(severidadValue) : null

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    setValue('ubicacion', { x, y })
  }

  const onSubmit = async (data: FormValues) => {
    const mockEvidencias: IncidentEvidencia[] = newEvidencias.map((f, i) => ({
      id: `ev-new-${Date.now()}-${i}`,
      url: URL.createObjectURL(f),
      nombre: f.name,
      tipo: f.type === 'application/pdf' ? 'pdf' : 'imagen',
      tamanioKb: Math.round(f.size / 1024),
      creadoEn: new Date().toISOString(),
      creadoPor: user?.id ?? 'user-mock',
    }))

    if (isEdit && incident) {
      await updateMutation.mutateAsync({
        id: incident.id,
        data: {
          ...data,
          personalInvolucrado: data.personalInvolucrado
            ? data.personalInvolucrado.split('\n').filter(Boolean)
            : undefined,
          testigos: data.testigos
            ? data.testigos.split('\n').filter(Boolean)
            : undefined,
          equiposInvolucrados: data.equiposInvolucrados
            ? data.equiposInvolucrados.split('\n').filter(Boolean)
            : undefined,
          ...(mockEvidencias.length > 0 ? { evidencias: [...(incident.evidencias ?? []), ...mockEvidencias] } : {}),
        },
      })
      navigate(`/incidents/${incident.id}`)
    } else {
      const result = await createMutation.mutateAsync({
        ...data,
        ...(mockEvidencias.length > 0 ? { evidencias: mockEvidencias } : {}),
      } as Parameters<typeof createMutation.mutateAsync>[0])
      navigate(`/incidents/${(result as Incidente).id}`)
    }
  }

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink h-10 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const selectClass = inputClass
  const textareaClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'block text-sm font-medium text-body dark:text-on-dark-soft mb-1'
  const errorClass = 'mt-1 text-xs text-error'

  return (
    <>
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 text-white hover:text-on-dark-soft"
            onClick={() => setLightboxUrl(null)}
            aria-label={t('form.evidencias.cerrarLightbox')}
          >
            <X size={24} />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        noValidate
        className="space-y-6"
      >
        {/* ─── Bloque Reporte inicial ─── */}
        <div className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <h2 className="mb-5 text-sm font-semibold text-ink dark:text-on-dark">
            {t('form.bloques.reporteInicial')}
          </h2>

          {/* Radio cards — Tipo */}
          <div className="mb-5">
            <p className={labelClass}>
              {t('form.fields.tipo')} <span className="text-error">*</span>
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TIPO_VALUES.map((tipo) => {
                const selected = tipoValue === tipo
                return (
                  <label
                    key={tipo}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors ${
                      selected
                        ? 'border-coral bg-coral/5 text-coral dark:bg-coral/10'
                        : 'border-hairline bg-canvas text-muted hover:border-coral/50 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft'
                    }`}
                  >
                    <input
                      type="radio"
                      value={tipo}
                      className="sr-only"
                      {...register('tipo')}
                    />
                    <span className={selected ? 'text-coral' : ''}>{TIPO_ICONS[tipo]}</span>
                    <span className="text-xs font-medium">{t(`tipo.${tipo}`)}</span>
                  </label>
                )
              })}
            </div>
            {errors.tipo && <p className={errorClass}>{errors.tipo.message as string}</p>}
          </div>

          {/* Descripción */}
          <div className="mb-4">
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
            {errors.descripcion && <p className={errorClass}>{errors.descripcion.message as string}</p>}
          </div>

          {/* Área + Turno */}
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="areaId" className={labelClass}>
                {t('form.fields.area')} <span className="text-error">*</span>
              </label>
              <select id="areaId" className={selectClass} {...register('areaId')}>
                <option value="">{t('form.placeholders.select')}</option>
                {AREAS_SHAC.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              {errors.areaId && <p className={errorClass}>{errors.areaId.message as string}</p>}
            </div>

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
              {errors.turno && <p className={errorClass}>{errors.turno.message as string}</p>}
            </div>
          </div>

          {/* Fecha evento */}
          <div className="mb-4">
            <label htmlFor="fechaEvento" className={labelClass}>
              {t('form.fields.fechaEvento')} <span className="text-error">*</span>
            </label>
            <input
              id="fechaEvento"
              type="datetime-local"
              className={inputClass}
              {...register('fechaEvento')}
            />
            {errors.fechaEvento && <p className={errorClass}>{errors.fechaEvento.message as string}</p>}
          </div>

          {/* Severidad */}
          <div className="mb-4">
            <label htmlFor="severidad" className={labelClass}>
              {t('form.fields.severidad')}
              {!isJefeCalidad && (
                <span className="ml-1 text-xs font-normal text-muted dark:text-on-dark-soft">
                  {t('form.severidad.autocalculada')}
                </span>
              )}
            </label>
            <select
              id="severidad"
              className={selectClass}
              disabled={!isJefeCalidad}
              {...register('severidad')}
            >
              <option value="">{t('form.placeholders.select')}</option>
              {SEVERIDAD_VALUES.map((s) => (
                <option key={s} value={s}>{t(`severidad.${s}`)}</option>
              ))}
            </select>
          </div>

          {/* Hubo lesionados toggle */}
          <div className="mb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={huboLesionadosValue}
                onClick={() => setValue('huboLesionados', !huboLesionadosValue)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  huboLesionadosValue ? 'bg-coral' : 'bg-muted-soft'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    huboLesionadosValue ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <label className="text-sm text-body dark:text-on-dark-soft">
                {t('form.fields.huboLesionados')}
              </label>
            </div>
          </div>

          {/* numPersonasAfectadas (condicional) */}
          {huboLesionadosValue && (
            <div className="mb-4">
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
                <p className={errorClass}>{errors.numPersonasAfectadas.message as string}</p>
              )}
            </div>
          )}

          {/* ─── Bloque Ubicación ─── */}
          <div className="mb-5 border-t border-hairline pt-5 dark:border-hairline/20">
            <p className={`${labelClass} mb-4 font-semibold`}>
              {t('form.bloques.ubicacion')}
            </p>

            {/* Local select */}
            <div className="mb-4">
              <label htmlFor="localId" className={labelClass}>
                {t('form.fields.localId')}
              </label>
              <Controller
                name="localId"
                control={control}
                render={({ field }) => (
                  <select
                    id="localId"
                    className={selectClass}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      field.onChange(e.target.value)
                      setValue('zonaId', '')
                      setValue('ubicacion', undefined)
                    }}
                  >
                    <option value="">{t('form.placeholders.localId')}</option>
                    {locales.map((l) => (
                      <option key={l.id} value={l.id}>{l.nombre}</option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Zona select */}
            <div className="mb-4">
              <label htmlFor="zonaId" className={labelClass}>
                {t('form.fields.zonaId')}
              </label>
              <select
                id="zonaId"
                className={selectClass}
                disabled={!localIdValue}
                {...register('zonaId')}
              >
                <option value="">{t('form.placeholders.zonaId')}</option>
                {zonas.map((z) => (
                  <option key={z.id} value={z.id}>{z.nombre}</option>
                ))}
              </select>
            </div>

            {/* Interactive floor plan */}
            {localIdValue && selectedLocal?.planoPngUrl && (
              <div>
                <p className={labelClass}>{t('form.fields.ubicacionPlano')}</p>
                <p className="mb-2 text-xs text-muted dark:text-on-dark-soft">
                  <MapPin size={11} className="mr-1 inline-block" />
                  {t('form.ubicacion.clickHint')}
                </p>
                <div
                  className="relative cursor-crosshair overflow-hidden rounded-md border border-hairline dark:border-hairline/20"
                  style={{ maxWidth: '360px' }}
                  onClick={handleMapClick}
                >
                  <img
                    src={selectedLocal.planoPngUrl}
                    alt={selectedLocal.nombre}
                    className="w-full select-none"
                    draggable={false}
                  />
                  {ubicacionValue && (
                    <div
                      className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-coral shadow-md"
                      style={{ left: `${ubicacionValue.x}%`, top: `${ubicacionValue.y}%` }}
                    />
                  )}
                </div>
                {ubicacionValue && (
                  <button
                    type="button"
                    onClick={() => setValue('ubicacion', undefined)}
                    className="mt-1.5 text-xs text-muted hover:text-error dark:text-on-dark-soft dark:hover:text-error"
                  >
                    {t('form.ubicacion.limpiar')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Zona de evidencias */}
          <EvidenciasZona
            existingEvidencias={isEdit ? incident?.evidencias : undefined}
            onFilesChange={setNewEvidencias}
            tipoAccidente={tipoValue === 'ACCIDENTE'}
          />
        </div>

        {/* ─── Bloque Investigación (solo edit) ─── */}
        {isEdit && (
          <div className="rounded-lg border border-hairline bg-surface-card dark:border-hairline/20 dark:bg-surface-dark-elevated">
            <button
              type="button"
              onClick={() => setInvestigacionOpen((v) => !v)}
              className="flex w-full items-center justify-between px-6 py-4 text-left"
            >
              <h2 className="text-sm font-semibold text-ink dark:text-on-dark">
                {t('form.bloques.investigacion')}
              </h2>
              {investigacionOpen ? (
                <ChevronUp size={16} className="text-muted dark:text-on-dark-soft" />
              ) : (
                <ChevronDown size={16} className="text-muted dark:text-on-dark-soft" />
              )}
            </button>

            {investigacionOpen && (
              <div className="space-y-5 border-t border-hairline px-6 pb-6 pt-5 dark:border-hairline/20">
                {/* Nota plazo investigación */}
                {plazoInvestigacion !== null && (
                  <div className="flex items-center gap-2 rounded-md border border-teal/30 bg-teal/10 px-3 py-2">
                    <Info size={14} className="shrink-0 text-teal" />
                    <p className="text-xs text-teal">
                      {t('form.investigacion.plazoDias', { dias: plazoInvestigacion })}
                    </p>
                  </div>
                )}

                {/* Personal involucrado */}
                <div>
                  <label htmlFor="personalInvolucrado" className={labelClass}>
                    {t('form.fields.personalInvolucrado')}
                  </label>
                  <textarea
                    id="personalInvolucrado"
                    rows={2}
                    className={textareaClass}
                    placeholder={t('form.placeholders.porLinea')}
                    {...register('personalInvolucrado')}
                  />
                </div>

                {/* Testigos */}
                <div>
                  <label htmlFor="testigos" className={labelClass}>
                    {t('form.fields.testigos')}
                  </label>
                  <textarea
                    id="testigos"
                    rows={2}
                    className={textareaClass}
                    placeholder={t('form.placeholders.porLinea')}
                    {...register('testigos')}
                  />
                </div>

                {/* Equipos involucrados */}
                <div>
                  <label htmlFor="equiposInvolucrados" className={labelClass}>
                    {t('form.fields.equiposInvolucrados')}
                  </label>
                  <textarea
                    id="equiposInvolucrados"
                    rows={2}
                    className={textareaClass}
                    placeholder={t('form.placeholders.porLinea')}
                    {...register('equiposInvolucrados')}
                  />
                </div>

                {/* Condiciones entorno — checkboxes */}
                <div>
                  <p className={labelClass}>{t('form.fields.condicionesEntorno')}</p>
                  <Controller
                    name="condicionesEntorno"
                    control={control}
                    render={({ field }) => {
                      const selected = (field.value ?? []) as string[]
                      return (
                        <div className="flex flex-wrap gap-3">
                          {CondicionEntornoValues.map((c) => {
                            const checked = selected.includes(c)
                            return (
                              <label key={c} className="flex cursor-pointer items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    if (checked) {
                                      field.onChange(selected.filter((v) => v !== c))
                                    } else {
                                      field.onChange([...selected, c])
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-hairline text-coral focus:ring-coral dark:border-hairline/20"
                                />
                                <span className="text-sm text-body dark:text-on-dark-soft">
                                  {CONDICION_ENTORNO_LABELS[c]}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      )
                    }}
                  />
                </div>

                {/* Atención médica toggle */}
                <div>
                  <div className="flex items-center gap-3">
                    <Controller
                      name="atencionMedicaRequerida"
                      control={control}
                      render={({ field }) => (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!!field.value}
                          onClick={() => field.onChange(!field.value)}
                          className={`relative h-5 w-9 rounded-full transition-colors ${
                            field.value ? 'bg-coral' : 'bg-muted-soft'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                              field.value ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      )}
                    />
                    <label className="text-sm text-body dark:text-on-dark-soft">
                      {t('form.fields.atencionMedicaRequerida')}
                    </label>
                  </div>
                </div>

                {/* atencionMedicaDescripcion (condicional) */}
                {atencionMedicaValue && (
                  <div>
                    <label htmlFor="atencionMedicaDescripcion" className={labelClass}>
                      {t('form.fields.atencionMedicaDescripcion')}
                    </label>
                    <textarea
                      id="atencionMedicaDescripcion"
                      rows={3}
                      maxLength={500}
                      className={textareaClass}
                      {...register('atencionMedicaDescripcion')}
                    />
                  </div>
                )}

                {/* Informe médico adjunto */}
                <div>
                  <label htmlFor="informeMedicoAdjunto" className={labelClass}>
                    {t('form.fields.informeMedicoAdjunto')}
                  </label>
                  <input
                    id="informeMedicoAdjunto"
                    type="file"
                    accept="application/pdf"
                    className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-body hover:file:bg-surface-cream dark:text-on-dark-soft dark:file:bg-surface-dark dark:file:text-on-dark-soft"
                    {...register('informeMedicoAdjunto')}
                  />
                  {tipoValue === 'ACCIDENTE' && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber">
                      <Info size={12} className="mt-0.5 shrink-0" />
                      {t('form.investigacion.informeMedicoNota')}
                    </div>
                  )}
                </div>

                {/* Lightbox trigger for existing evidencias (edit mode only) */}
                {incident?.evidencias && incident.evidencias.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted dark:text-on-dark-soft">
                      {t('form.evidencias.existentes')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {incident.evidencias.map((ev) =>
                        ev.tipo === 'imagen' ? (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => setLightboxUrl(ev.url)}
                            className="group relative h-16 w-16 overflow-hidden rounded-md border border-hairline dark:border-hairline/20"
                            aria-label={ev.nombre}
                          >
                            <img src={ev.url} alt={ev.nombre} className="h-full w-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-ink/0 transition-colors group-hover:bg-ink/30">
                              <Eye size={16} className="text-white opacity-0 group-hover:opacity-100" />
                            </div>
                          </button>
                        ) : (
                          <div key={ev.id} className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-md border border-hairline bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark-soft">
                            <FileText size={18} className="text-muted dark:text-on-dark-soft" />
                            <span className="max-w-full truncate px-1 text-center text-[9px] text-muted dark:text-on-dark-soft">
                              {ev.nombre}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Actions ─── */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel ?? (() => navigate('/incidents'))}
            className="rounded-md border border-hairline bg-canvas px-5 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
          >
            {t('form.actions.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
            className="rounded-md bg-coral px-5 py-2.5 text-sm font-medium text-white hover:bg-coral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:opacity-60"
          >
            {isSubmitting ? t('form.actions.submitting') : t('form.actions.submit')}
          </button>
        </div>
      </form>
    </>
  )
}
