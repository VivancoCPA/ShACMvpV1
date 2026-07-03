import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { SearchableSelect } from '../../../components/shared/SearchableSelect'
import { qualityEventCreateSchema } from '../schemas/qualityEventCreate.schema'
import type { QualityEventCreateInput } from '../schemas/qualityEventCreate.schema'
import { useCreateQualityEvent } from '../hooks/useCreateQualityEvent'
import { getIncidents } from '../../incidents/api/incidents.api'
import { getNonconformities } from '../../nonconformities/api/nonconformities.api'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import {
  QE_ORIGIN_LABELS,
  QE_TYPE_LABELS,
  QE_SEVERITY_LABELS,
  AREAS_SHAC,
} from '../../../constants/shared.constants'
import type { QEOrigin, QEType, QESeverity } from '../types/qualityEvent.types'

const QE_ORIGINS = Object.keys(QE_ORIGIN_LABELS) as QEOrigin[]
const QE_TYPES = Object.keys(QE_TYPE_LABELS) as QEType[]
const QE_SEVERITIES = Object.keys(QE_SEVERITY_LABELS) as QESeverity[]

const MINERALES = [
  'Cobre',
  'Zinc',
  'Plomo',
  'Hierro',
  'Molibdeno',
  'Plata',
  'Oro',
  'Estaño',
  'Concentrado de cobre',
  'Concentrado de zinc',
  'Concentrado de plomo',
] as const

// Flat form state covers all branches of the discriminated union
type QEFormValues = {
  origen: QEOrigin | ''
  tipo: QEType | ''
  severidad: QESeverity | ''
  descripcion: string
  areaAfectada: string
  turno: 'DIA' | 'TARDE' | 'NOCHE' | ''
  fechaHoraEvento: string
  mineralInvolucrado: string
  incidenteId: string
  ncId: string
  hallazgoAuditoriaRef: string
  reporteExternoRef: {
    nombreCliente: string
    fechaRecepcion: string
  }
}

export function QualityEventForm() {
  const { t } = useTranslation('qualityEvents')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { mutate, isPending } = useCreateQualityEvent()
  const [mineralFreeText, setMineralFreeText] = useState(false)

  const origenParam = searchParams.get('origen') as QEOrigin | null
  const initialOrigen = origenParam && QE_ORIGINS.includes(origenParam) ? origenParam : ''
  const initialNcId = searchParams.get('ncId') ?? ''
  const initialIncidenteId = searchParams.get('incidenteId') ?? ''

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm<QEFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(qualityEventCreateSchema) as any,
    defaultValues: {
      origen: initialOrigen,
      tipo: '',
      severidad: '',
      descripcion: '',
      areaAfectada: '',
      turno: '',
      fechaHoraEvento: '',
      mineralInvolucrado: '',
      incidenteId: initialOrigen === 'O1_INCIDENTE_CAMPO' ? initialIncidenteId : '',
      ncId: initialOrigen === 'O2_NC_DETECTADA' ? initialNcId : '',
      hallazgoAuditoriaRef: '',
      reporteExternoRef: { nombreCliente: '', fechaRecepcion: '' },
    },
  })

  const origenValue = watch('origen')
  const severidadValue = watch('severidad')
  const descripcionValue = watch('descripcion') ?? ''
  const mineralValue = watch('mineralInvolucrado') ?? ''

  // O1 — incidents query (enabled only when origin is O1)
  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'list', { pageSize: 200 }],
    queryFn: () => getIncidents({ pageSize: 200 }),
    enabled: origenValue === 'O1_INCIDENTE_CAMPO',
  })

  // O2 — non-conformities query (enabled only when origin is O2)
  const ncsQuery = useQuery({
    queryKey: ['nonconformities', 'list', { pageSize: 200 }],
    queryFn: () => getNonconformities({ pageSize: 200 }),
    enabled: origenValue === 'O2_NC_DETECTADA',
  })

  const incidents = incidentsQuery.data?.items ?? []
  const nonconformities = ncsQuery.data?.items ?? []

  const clearOriginFields = () => {
    setValue('incidenteId', '')
    setValue('ncId', '')
    setValue('hallazgoAuditoriaRef', '')
    setValue('reporteExternoRef', { nombreCliente: '', fechaRecepcion: '' })
  }

  const handleOrigenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    clearOriginFields()
    setValue('origen', e.target.value as QEOrigin | '')
  }

  const onSubmit = (data: QEFormValues) => {
    // Future-date validation — datetime-local value is in local time, compare without Z suffix
    if (data.fechaHoraEvento) {
      if (new Date(data.fechaHoraEvento) > new Date()) {
        setError('fechaHoraEvento', {
          type: 'manual',
          message: t('form.errors.fechaFutura'),
        })
        return
      }
    }

    // Convert datetime-local (YYYY-MM-DDTHH:mm) to ISO 8601 UTC
    const payload = {
      ...data,
      fechaHoraEvento: data.fechaHoraEvento ? new Date(data.fechaHoraEvento).toISOString() : '',
      mineralInvolucrado: data.mineralInvolucrado || undefined,
    } as unknown as QualityEventCreateInput

    mutate(payload, {
      onSuccess: (qe) => navigate(`/quality-events/${qe.id}`),
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : ''
        toast.error(msg || t('form.errors.generic'))
      },
    })
  }

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink h-10 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const selectClass = inputClass
  const textareaClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'block text-sm font-medium text-body dark:text-on-dark-soft mb-1'
  const errorClass = 'mt-1 text-sm text-error'

  return (
    <PageWrapper title={t('form.createTitle')}>
      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        noValidate
        className="mx-auto max-w-3xl"
      >
        <div className="rounded-xl border border-hairline bg-surface-card p-8 dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">

          {/* ── Origen select (full width) ── */}
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="origen">
              {t('form.fields.origen')} <span className="text-error">*</span>
            </label>
            <select
              id="origen"
              className={selectClass}
              {...register('origen')}
              onChange={handleOrigenChange}
            >
              <option value="">{t('form.placeholders.select')}</option>
              {QE_ORIGINS.map((o) => (
                <option key={o} value={o}>
                  {QE_ORIGIN_LABELS[o]}
                </option>
              ))}
            </select>
            {errors.origen && <p className={errorClass}>{errors.origen.message as string}</p>}
          </div>

          {/* ── Origin-specific conditional sections (full width) ── */}
          {origenValue === 'O1_INCIDENTE_CAMPO' && (
            <div className="md:col-span-2">
              <label className={labelClass} htmlFor="incidenteId">
                {t('form.fields.incidenteId')} <span className="text-error">*</span>
              </label>
              {incidentsQuery.isLoading ? (
                <p className="text-sm text-muted dark:text-on-dark-soft">{t('form.placeholders.search')}…</p>
              ) : incidents.length === 0 ? (
                <p className="text-sm text-muted dark:text-on-dark-soft">{t('form.noIncidents')}</p>
              ) : (
                <Controller
                  name="incidenteId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      id="incidenteId"
                      ariaLabel={t('form.fields.incidenteId')}
                      placeholder={t('form.placeholders.search')}
                      options={incidents.map((inc) => ({
                        id: inc.id,
                        label: inc.numero,
                        sublabel: `${inc.descripcion.slice(0, 60)}${inc.descripcion.length > 60 ? '…' : ''} (${inc.areaId})`,
                      }))}
                      value={field.value || undefined}
                      onChange={(id) => field.onChange(id ?? '')}
                    />
                  )}
                />
              )}
              {errors.incidenteId && (
                <p className={errorClass}>{errors.incidenteId.message as string}</p>
              )}
            </div>
          )}

          {origenValue === 'O2_NC_DETECTADA' && (
            <div className="md:col-span-2">
              <label className={labelClass} htmlFor="ncId">
                {t('form.fields.ncId')} <span className="text-error">*</span>
              </label>
              {ncsQuery.isLoading ? (
                <p className="text-sm text-muted dark:text-on-dark-soft">{t('form.placeholders.search')}…</p>
              ) : nonconformities.length === 0 ? (
                <p className="text-sm text-muted dark:text-on-dark-soft">{t('form.noNonconformities')}</p>
              ) : (
                <Controller
                  name="ncId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      id="ncId"
                      ariaLabel={t('form.fields.ncId')}
                      placeholder={t('form.placeholders.search')}
                      options={nonconformities.map((nc) => {
                        const text = nc.titulo ?? nc.descripcion
                        return {
                          id: nc.id,
                          label: nc.numero,
                          sublabel: `${text.slice(0, 60)}${text.length > 60 ? '…' : ''} (${nc.areaAfectada})`,
                        }
                      })}
                      value={field.value || undefined}
                      onChange={(id) => field.onChange(id ?? '')}
                    />
                  )}
                />
              )}
              {errors.ncId && <p className={errorClass}>{errors.ncId.message as string}</p>}
            </div>
          )}

          {origenValue === 'O3_HALLAZGO_AUDITORIA' && (
            <div className="md:col-span-2">
              <label className={labelClass} htmlFor="hallazgoAuditoriaRef">
                {t('form.fields.hallazgoAuditoriaRef')} <span className="text-error">*</span>
              </label>
              <input
                id="hallazgoAuditoriaRef"
                type="text"
                maxLength={200}
                className={inputClass}
                placeholder={t('form.hallazgoPlaceholder')}
                {...register('hallazgoAuditoriaRef')}
              />
              {errors.hallazgoAuditoriaRef && (
                <p className={errorClass}>{errors.hallazgoAuditoriaRef.message as string}</p>
              )}
            </div>
          )}

          {origenValue === 'O4_REPORTE_EXTERNO' && (
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className={labelClass} htmlFor="reporteExternoRef.nombreCliente">
                  {t('form.fields.nombreCliente')} <span className="text-error">*</span>
                </label>
                <input
                  id="reporteExternoRef.nombreCliente"
                  type="text"
                  maxLength={200}
                  className={inputClass}
                  placeholder={t('form.placeholders.nombreCliente')}
                  {...register('reporteExternoRef.nombreCliente')}
                />
                {errors.reporteExternoRef?.nombreCliente && (
                  <p className={errorClass}>
                    {errors.reporteExternoRef.nombreCliente.message as string}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="reporteExternoRef.fechaRecepcion">
                  {t('form.fields.fechaRecepcion')} <span className="text-error">*</span>
                </label>
                <input
                  id="reporteExternoRef.fechaRecepcion"
                  type="date"
                  className={inputClass}
                  {...register('reporteExternoRef.fechaRecepcion')}
                />
                {errors.reporteExternoRef?.fechaRecepcion && (
                  <p className={errorClass}>
                    {errors.reporteExternoRef.fechaRecepcion.message as string}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Tipo (half width) ── */}
          <div>
            <label className={labelClass} htmlFor="tipo">
              {t('form.fields.tipo')} <span className="text-error">*</span>
            </label>
            <select id="tipo" className={selectClass} {...register('tipo')}>
              <option value="">{t('form.placeholders.select')}</option>
              {QE_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {QE_TYPE_LABELS[tp]}
                </option>
              ))}
            </select>
            {errors.tipo && <p className={errorClass}>{errors.tipo.message as string}</p>}
          </div>

          {/* ── Severidad (half width) ── */}
          <div>
            <label className={labelClass} htmlFor="severidad">
              {t('form.fields.severidad')} <span className="text-error">*</span>
            </label>
            <select id="severidad" className={selectClass} {...register('severidad')}>
              <option value="">{t('form.placeholders.select')}</option>
              {QE_SEVERITIES.map((sv) => (
                <option key={sv} value={sv}>
                  {QE_SEVERITY_LABELS[sv]}
                </option>
              ))}
            </select>
            {errors.severidad && <p className={errorClass}>{errors.severidad.message as string}</p>}
          </div>

          {/* ── CRITICA banner (full width, conditional) ── */}
          {severidadValue === 'CRITICA' && (
            <div className="md:col-span-2 flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-warning">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p className="text-sm">{t('form.criticaBanner')}</p>
            </div>
          )}

          {/* ── Descripcion (full width) ── */}
          <div className="md:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-body dark:text-on-dark-soft" htmlFor="descripcion">
                {t('form.fields.descripcion')} <span className="text-error">*</span>
              </label>
              <span
                className={`text-xs ${descripcionValue.length >= 1900 ? 'text-error' : 'text-muted dark:text-on-dark-soft'}`}
              >
                {descripcionValue.length}/2000
              </span>
            </div>
            <textarea
              id="descripcion"
              rows={4}
              maxLength={2000}
              className={textareaClass}
              placeholder={t('form.placeholders.descripcion')}
              {...register('descripcion')}
            />
            {errors.descripcion && (
              <p className={errorClass}>{errors.descripcion.message as string}</p>
            )}
          </div>

          {/* ── Área afectada (full width) ── */}
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="areaAfectada">
              {t('form.fields.areaAfectada')} <span className="text-error">*</span>
            </label>
            <select id="areaAfectada" className={selectClass} {...register('areaAfectada')}>
              <option value="">{t('form.placeholders.select')}</option>
              {AREAS_SHAC.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            {errors.areaAfectada && (
              <p className={errorClass}>{errors.areaAfectada.message as string}</p>
            )}
          </div>

          {/* ── Mineral involucrado (full width, optional) ── */}
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="mineralSelect">
              {t('form.fields.mineralInvolucrado')}
            </label>
            {!mineralFreeText ? (
              <select
                id="mineralSelect"
                className={selectClass}
                value={MINERALES.includes(mineralValue as typeof MINERALES[number]) ? mineralValue : (mineralValue ? '_OTRO' : '')}
                onChange={(e) => {
                  if (e.target.value === '_OTRO') {
                    setMineralFreeText(true)
                    setValue('mineralInvolucrado', '')
                  } else {
                    setValue('mineralInvolucrado', e.target.value)
                  }
                }}
              >
                <option value="">{t('form.placeholders.select')}</option>
                {MINERALES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="_OTRO">{t('form.mineralOtro')}</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={100}
                  className={`${inputClass} flex-1`}
                  placeholder={t('form.placeholders.mineralInvolucrado')}
                  {...register('mineralInvolucrado')}
                />
                <button
                  type="button"
                  onClick={() => { setMineralFreeText(false); setValue('mineralInvolucrado', '') }}
                  className="rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-muted hover:text-ink dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:text-on-dark"
                >
                  ← Lista
                </button>
              </div>
            )}
          </div>

          {/* ── Turno (half width) ── */}
          <div>
            <label className={labelClass} htmlFor="turno">
              {t('form.fields.turno')} <span className="text-error">*</span>
            </label>
            <select id="turno" className={selectClass} {...register('turno')}>
              <option value="">{t('form.placeholders.select')}</option>
              <option value="DIA">{t('form.turno.DIA')}</option>
              <option value="TARDE">{t('form.turno.TARDE')}</option>
              <option value="NOCHE">{t('form.turno.NOCHE')}</option>
            </select>
            {errors.turno && <p className={errorClass}>{errors.turno.message as string}</p>}
          </div>

          {/* ── Fecha y hora del evento (half width) ── */}
          <div>
            <label className={labelClass} htmlFor="fechaHoraEvento">
              {t('form.fields.fechaHoraEvento')} <span className="text-error">*</span>
            </label>
            <input
              id="fechaHoraEvento"
              type="datetime-local"
              className={inputClass}
              {...register('fechaHoraEvento')}
            />
            {errors.fechaHoraEvento && (
              <p className={errorClass}>{errors.fechaHoraEvento.message as string}</p>
            )}
          </div>

          {/* ── Footer buttons (full width) ── */}
          <div className="md:col-span-2 flex items-center justify-end gap-3 border-t border-hairline pt-4 dark:border-hairline/20">
            <button
              type="button"
              onClick={() => navigate('/quality-events')}
              className="rounded-md border border-hairline bg-canvas px-5 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
            >
              {t('form.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-coral px-5 py-2.5 text-sm font-medium text-white hover:bg-coral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:opacity-60"
            >
              {isPending ? t('form.actions.submitting') : t('form.actions.submit')}
            </button>
          </div>

          </div>
        </div>
      </form>
    </PageWrapper>
  )
}
