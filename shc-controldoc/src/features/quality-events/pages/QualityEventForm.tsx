import { useMemo, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { SearchableSelect } from '../../../components/shared/SearchableSelect'
import { NormativaVinculadaCombobox } from '../components/NormativaVinculadaCombobox'
import { qualityEventCreateSchema } from '../schemas/qualityEventCreate.schema'
import type { QualityEventCreateInput } from '../schemas/qualityEventCreate.schema'
import { qualityEventEditReporteInicialSchema } from '../schemas/qualityEventEditReporteInicial.schema'
import type { QualityEventEditReporteInicialInput } from '../schemas/qualityEventEditReporteInicial.schema'
import { useCreateQualityEvent } from '../hooks/useCreateQualityEvent'
import { useQualityEvent } from '../hooks/useQualityEvent'
import { useEditarReporteInicial } from '../hooks/useEditarReporteInicial'
import { useEditarSeveridad } from '../hooks/useEditarSeveridad'
import { getIncident, getIncidents } from '../../incidents/api/incidents.api'
import { INCIDENT_QUERY_KEYS, useIncident } from '../../incidents/hooks/useIncidents'
import type { Incidente } from '../../incidents/types/incident.types'
import { useCandidatosResponsableQE } from '../hooks/useCandidatosResponsableQE'
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../../../utils/datetimeLocal'
import { getNonconformities } from '../../nonconformities/api/nonconformities.api'
import { useVincularNC } from '../../nonconformities/hooks/useNonconformities'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { useAuthStore } from '../../../stores/authStore'
import { resolveQEEditAccess } from '../utils/qualityEventPermissions'
import { useUserNames } from '../../users/hooks/useUserNames'
import { useAreas } from '../../areas/hooks/useAreas'
import {
  QE_ORIGIN_LABELS,
  QE_TYPE_LABELS,
  QE_SEVERITY_LABELS,
  QE_MINERALES,
} from '../../../constants/shared.constants'
import type { QEOrigin, QEType, QESeverity, QualityEvent, NormativaVinculada } from '../types/qualityEvent.types'
import type { QEEditAccess } from '../types/qualityEventPermissions.types'

const QE_ORIGINS = Object.keys(QE_ORIGIN_LABELS) as QEOrigin[]
const QE_TYPES = Object.keys(QE_TYPE_LABELS) as QEType[]
const QE_SEVERITIES = Object.keys(QE_SEVERITY_LABELS) as QESeverity[]
const MINERALES = QE_MINERALES

// Flat form state covers all branches of the discriminated union
type QEFormValues = {
  origen: QEOrigin | ''
  tipo: QEType | ''
  severidad: QESeverity | ''
  descripcion: string
  areaId: string
  turno: 'DIA' | 'TARDE' | 'NOCHE' | ''
  fechaHoraEvento: string
  mineralInvolucrado: string
  incidenteId: string
  ncId: string
  hallazgoCodigo: string
  normativaVinculada: NormativaVinculada | undefined
  reporteExternoRef: {
    nombreCliente: string
    fechaRecepcion: string
  }
  responsableInvestigacionId: string
}

// Campos que se copian del incidente de origen (qe-precarga-incidente-responsable D1/D8).
const PRECARGA_FIELDS = ['descripcion', 'fechaHoraEvento', 'turno', 'areaId', 'severidad', 'tipo'] as const

function valoresDesdeIncidente(inc: Incidente): Pick<QEFormValues, (typeof PRECARGA_FIELDS)[number]> {
  return {
    descripcion: inc.descripcion,
    fechaHoraEvento: toDatetimeLocalValue(inc.fechaEvento),
    // IncidentTurno admite 'TODOS', que el QE no tiene — en ese caso el usuario elige el turno.
    turno: inc.turno === 'TODOS' ? '' : inc.turno,
    areaId: inc.areaId,
    severidad: inc.severidad,
    tipo: 'SST',
  }
}

function SkeletonBlock() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-hairline dark:bg-surface-dark-soft" />
      ))}
    </div>
  )
}

interface QualityEventFormBodyProps {
  qe?: QualityEvent
  access: QEEditAccess | null
  isEditMode: boolean
  /** Incidente de la URL (`?incidenteId=`), ya cargado por la página — fuente de la precarga inicial. */
  incidenteInicial?: Incidente
}

function QualityEventFormBody({ qe, access, isEditMode, incidenteInicial }: QualityEventFormBodyProps) {
  const { t } = useTranslation('qualityEvents')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const esJca = user?.rol === 'JEFE_CALIDAD_SYST'
  const { data: candidatosResponsable = [] } = useCandidatosResponsableQE(!isEditMode && esJca)
  // Incidente cuyos datos se copiaron al formulario (nota "Datos copiados…") y el que espera
  // confirmación de reemplazo — estado de UI, no derivado.
  const [incidentePrecargado, setIncidentePrecargado] = useState<{ id: string; numero: string } | null>(
    incidenteInicial ? { id: incidenteInicial.id, numero: incidenteInicial.numero } : null,
  )
  const [reemplazoPendiente, setReemplazoPendiente] = useState<Incidente | null>(null)
  const { mutate: mutateCreate, isPending: isPendingCreate } = useCreateQualityEvent()
  const { mutate: mutateVincularNC, isPending: isPendingVincularNC } = useVincularNC()
  const { mutate: mutateEditReporteInicial, isPending: isPendingEditReporteInicial } = useEditarReporteInicial()
  const { mutate: mutateEditSeveridad, isPending: isPendingEditSeveridad } = useEditarSeveridad()
  const { data: areas } = useAreas()
  const areasActivas = useMemo(() => (areas ?? []).filter((a) => a.activo), [areas])
  const nombreArea = (id: string) => areas?.find((a) => a.id === id)?.nombre ?? id
  const [mineralFreeText, setMineralFreeText] = useState(() =>
    Boolean(qe?.mineralInvolucrado) && !MINERALES.includes(qe?.mineralInvolucrado as typeof MINERALES[number]),
  )
  const { getName } = useUserNames([qe?.reportadoPorId])

  const origenParam = searchParams.get('origen') as QEOrigin | null
  const initialOrigen = origenParam && QE_ORIGINS.includes(origenParam) ? origenParam : ''
  const initialNcId = searchParams.get('ncId') ?? ''
  const initialIncidenteId = searchParams.get('incidenteId') ?? ''
  const initialNcNumero = searchParams.get('ncNumero') ?? ''
  const initialNcArea = searchParams.get('ncArea') ?? ''
  const initialIncidenteNumero = searchParams.get('incidenteNumero') ?? ''
  const initialIncidenteArea = searchParams.get('incidenteArea') ?? ''

  // RN-QE-013 — mount-time fallback from query params, used as the initial areaAfectada default
  // and as a placeholder until the linked NC/Incidente list loads (see `origenEntidad` below).
  const initialOrigenEntidad = useMemo(() => {
    if (initialOrigen === 'O2_NC_DETECTADA' && initialNcArea) {
      return { tipoEtiqueta: 'la NC' as const, numero: initialNcNumero, area: initialNcArea }
    }
    if (initialOrigen === 'O1_INCIDENTE_CAMPO' && initialIncidenteArea) {
      return { tipoEtiqueta: 'el Incidente' as const, numero: initialIncidenteNumero, area: initialIncidenteArea }
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    resetField,
    control,
    formState: { errors, dirtyFields },
  } = useForm<QEFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: isEditMode ? undefined : (zodResolver(qualityEventCreateSchema) as any),
    defaultValues: qe
      ? {
          origen: qe.origen,
          tipo: qe.tipo,
          severidad: qe.severidad,
          descripcion: qe.descripcion,
          areaId: qe.areaId,
          turno: qe.turno,
          fechaHoraEvento: toDatetimeLocalValue(qe.fechaHoraEvento),
          mineralInvolucrado: qe.mineralInvolucrado ?? '',
          incidenteId: qe.incidenteId ?? '',
          ncId: qe.ncId ?? '',
          hallazgoCodigo: qe.hallazgoCodigo ?? '',
          normativaVinculada: qe.normativaVinculada,
          reporteExternoRef: qe.reporteExternoRef ?? { nombreCliente: '', fechaRecepcion: '' },
          responsableInvestigacionId: qe.responsableInvestigacionId ?? '',
        }
      : {
          origen: initialOrigen,
          tipo: '',
          severidad: '',
          descripcion: '',
          areaId: initialOrigenEntidad?.area ?? '',
          turno: '',
          fechaHoraEvento: '',
          ...(incidenteInicial ? valoresDesdeIncidente(incidenteInicial) : {}),
          mineralInvolucrado: '',
          incidenteId: initialOrigen === 'O1_INCIDENTE_CAMPO' ? initialIncidenteId : '',
          ncId: initialOrigen === 'O2_NC_DETECTADA' ? initialNcId : '',
          hallazgoCodigo: '',
          normativaVinculada: undefined,
          reporteExternoRef: { nombreCliente: '', fechaRecepcion: '' },
          responsableInvestigacionId: '',
        },
  })

  const origenValue = watch('origen')
  const severidadValue = watch('severidad')
  const descripcionValue = watch('descripcion') ?? ''
  const mineralValue = watch('mineralInvolucrado') ?? ''
  const areaIdValue = watch('areaId') ?? ''
  const ncIdValue = watch('ncId')
  const incidenteIdValue = watch('incidenteId')

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

  const incidents = useMemo(() => incidentsQuery.data?.items ?? [], [incidentsQuery.data])
  const nonconformities = useMemo(() => ncsQuery.data?.items ?? [], [ncsQuery.data])

  // RN-QE-013 — shared by both entry points: query-param prefill (button on NC/Incidente detail)
  // and manual selection via the searchable combobox below. Falls back to `initialOrigenEntidad`
  // (query params) until the linked entity is found in the loaded list.
  const origenEntidad = useMemo(() => {
    if (origenValue === 'O2_NC_DETECTADA') {
      const nc = nonconformities.find((n) => n.id === ncIdValue)
      if (nc) return { tipoEtiqueta: 'la NC' as const, numero: nc.numero, area: nc.areaId }
      return initialOrigenEntidad?.tipoEtiqueta === 'la NC' ? initialOrigenEntidad : null
    }
    if (origenValue === 'O1_INCIDENTE_CAMPO') {
      const inc = incidents.find((i) => i.id === incidenteIdValue)
      if (inc) return { tipoEtiqueta: 'el Incidente' as const, numero: inc.numero, area: inc.areaId }
      return initialOrigenEntidad?.tipoEtiqueta === 'el Incidente' ? initialOrigenEntidad : null
    }
    return null
  }, [origenValue, nonconformities, ncIdValue, incidents, incidenteIdValue, initialOrigenEntidad])

  const showAreaDivergeWarning =
    !!origenEntidad && !!areaIdValue && areaIdValue !== origenEntidad.area

  // resetField con defaultValue: los campos precargados quedan "no tocados", así un segundo cambio
  // de incidente sin ediciones del usuario reemplaza directo, sin volver a pedir confirmación.
  const aplicarPrecarga = (inc: Incidente) => {
    const valores = valoresDesdeIncidente(inc)
    for (const campo of PRECARGA_FIELDS) resetField(campo, { defaultValue: valores[campo] })
    setIncidentePrecargado({ id: inc.id, numero: inc.numero })
  }

  const handleIncidenteSeleccionado = (id: string) => {
    void queryClient
      .fetchQuery({ queryKey: INCIDENT_QUERY_KEYS.detail(id), queryFn: () => getIncident(id) })
      .then((inc) => {
        const tocados = PRECARGA_FIELDS.some((campo) => dirtyFields[campo])
        if (tocados) setReemplazoPendiente(inc)
        else aplicarPrecarga(inc)
      })
      .catch(() => {
        // Sin detalle del incidente: el formulario queda como estaba (solo cambia el vínculo).
      })
  }

  const clearOriginFields = () => {
    setValue('incidenteId', '')
    setValue('ncId', '')
    setValue('hallazgoCodigo', '')
    setValue('normativaVinculada', undefined)
    setValue('reporteExternoRef', { nombreCliente: '', fechaRecepcion: '' })
  }

  const handleOrigenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    clearOriginFields()
    setValue('origen', e.target.value as QEOrigin | '')
  }

  const onSubmitCreate = (data: QEFormValues) => {
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
      fechaHoraEvento: data.fechaHoraEvento ? fromDatetimeLocalValue(data.fechaHoraEvento) : '',
      mineralInvolucrado: data.mineralInvolucrado || undefined,
      responsableInvestigacionId: data.responsableInvestigacionId || undefined,
    } as unknown as QualityEventCreateInput

    mutateCreate(payload, {
      onSuccess: (created) => {
        // RN-QE-001 — el Incidente origen (O1_INCIDENTE_CAMPO) ya queda vinculado por el backend
        // en la misma transacción que la creación del QE (incidentes-qe-estado-alertas D3);
        // useCreateQualityEvent invalida la caché de incidentes, así que se navega directo.
        // RN-QE-013 — la NC origen (O2_NC_DETECTADA) todavía se vincula con un segundo request
        // (nc.qeGeneradoId) antes de navegar, para que canCrearQE deje de habilitar "Crear QE" al
        // volver al detalle de la NC. Un fallo en el vínculo no bloquea navegar al QE ya creado
        // — useVincularNC ya notifica el error por separado.
        if (payload.origen === 'O2_NC_DETECTADA' && payload.ncId) {
          mutateVincularNC(
            { id: payload.ncId, qeGeneradoId: created.id },
            { onSettled: () => navigate(`/quality-events/${created.id}`) },
          )
          return
        }
        navigate(`/quality-events/${created.id}`)
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : ''
        toast.error(msg || t('form.errors.generic'))
      },
    })
  }

  const onSubmitEdit = (data: QEFormValues) => {
    if (!qe) return

    if (data.fechaHoraEvento && new Date(data.fechaHoraEvento) > new Date()) {
      setError('fechaHoraEvento', {
        type: 'manual',
        message: t('form.errors.fechaFutura'),
      })
      return
    }

    // datetime-local has no timezone info, so compare it against the anterior value converted to
    // the same local format (toDatetimeLocalValue) — otherwise an untouched field would spuriously
    // "change" by the local UTC offset on every submit.
    const fechaHoraEventoChanged = data.fechaHoraEvento !== toDatetimeLocalValue(qe.fechaHoraEvento)
    const fechaHoraEventoIso =
      fechaHoraEventoChanged && data.fechaHoraEvento
        ? fromDatetimeLocalValue(data.fechaHoraEvento)
        : qe.fechaHoraEvento

    const candidate: Record<string, unknown> = {
      descripcion: data.descripcion,
      areaId: data.areaId,
      turno: data.turno,
      fechaHoraEvento: fechaHoraEventoIso,
      mineralInvolucrado: data.mineralInvolucrado || undefined,
    }
    if (qe.origen === 'O1_INCIDENTE_CAMPO') candidate.incidenteId = data.incidenteId
    if (qe.origen === 'O2_NC_DETECTADA') candidate.ncId = data.ncId
    if (qe.origen === 'O3_HALLAZGO_AUDITORIA') {
      candidate.hallazgoCodigo = data.hallazgoCodigo
      candidate.normativaVinculada = data.normativaVinculada
    }
    if (qe.origen === 'O4_REPORTE_EXTERNO') candidate.reporteExternoRef = data.reporteExternoRef

    const parsed = qualityEventEditReporteInicialSchema.safeParse(candidate)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof QEFormValues
        setError(field, { type: 'manual', message: issue.message })
      }
      return
    }

    const diffed: Partial<QualityEventEditReporteInicialInput> = {}
    for (const campo of Object.keys(parsed.data) as (keyof QualityEventEditReporteInicialInput)[]) {
      if (campo === 'fechaHoraEvento') {
        if (fechaHoraEventoChanged) diffed.fechaHoraEvento = parsed.data.fechaHoraEvento
        continue
      }
      const anterior = (qe as unknown as Record<string, unknown>)[campo]
      const nuevo = parsed.data[campo]
      if (JSON.stringify(nuevo) !== JSON.stringify(anterior)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(diffed as any)[campo] = nuevo
      }
    }

    const severidadChanged = Boolean(access?.severidad) && data.severidad && data.severidad !== qe.severidad

    const goBack = () => {
      toast.success(t('toasts.edited'))
      navigate(`/quality-events/${qe.id}`)
    }

    const onMutationError = (err: unknown) => {
      const msg = err instanceof Error ? err.message : ''
      toast.error(msg || t('form.errors.generic'))
    }

    const applySeveridadIfNeeded = () => {
      if (severidadChanged) {
        mutateEditSeveridad(
          { id: qe.id, data: { severidad: data.severidad as QESeverity } },
          { onSuccess: goBack, onError: onMutationError },
        )
      } else {
        goBack()
      }
    }

    if (Object.keys(diffed).length > 0) {
      mutateEditReporteInicial(
        { id: qe.id, data: diffed as QualityEventEditReporteInicialInput },
        { onSuccess: applySeveridadIfNeeded, onError: onMutationError },
      )
    } else {
      applySeveridadIfNeeded()
    }
  }

  const onSubmit = isEditMode ? onSubmitEdit : onSubmitCreate
  const isPending = isEditMode
    ? isPendingEditReporteInicial || isPendingEditSeveridad
    : isPendingCreate || isPendingVincularNC
  const showSeveridadField = !isEditMode || Boolean(access?.severidad)

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink h-10 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const selectClass = inputClass
  const textareaClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'block text-sm font-medium text-body dark:text-on-dark-soft mb-1'
  const errorClass = 'mt-1 text-sm text-error'
  const readOnlyValueClass = 'text-sm text-ink dark:text-on-dark'

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      noValidate
      className="mx-auto max-w-3xl"
    >
      <div className="rounded-xl border border-hairline bg-surface-card p-8 dark:border-hairline/20 dark:bg-surface-dark-elevated">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">

        {/* ── Read-only reporte-inicial header (edit mode only) ── */}
        {isEditMode && qe && (
          <div className="md:col-span-2 grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border border-hairline bg-surface-soft p-4 dark:border-hairline/20 dark:bg-surface-dark-soft sm:grid-cols-2">
            <div>
              <p className={labelClass}>{t('form.fields.numero')}</p>
              <p className={readOnlyValueClass}>{qe.numero}</p>
            </div>
            <div>
              <p className={labelClass}>{t('form.fields.fechaHoraReporte')}</p>
              <p className={readOnlyValueClass}>{new Date(qe.fechaHoraReporte).toLocaleString()}</p>
            </div>
            <div>
              <p className={labelClass}>{t('form.fields.origen')}</p>
              <p className={readOnlyValueClass}>{QE_ORIGIN_LABELS[qe.origen]}</p>
            </div>
            <div>
              <p className={labelClass}>{t('form.fields.tipo')}</p>
              <p className={readOnlyValueClass}>{QE_TYPE_LABELS[qe.tipo]}</p>
            </div>
            <div className="sm:col-span-2">
              <p className={labelClass}>{t('form.fields.reportadoPor')}</p>
              <p className={readOnlyValueClass}>{getName(qe.reportadoPorId)}</p>
            </div>
          </div>
        )}

        {!isEditMode && (
          <>
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
          </>
        )}

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
                      sublabel: `${inc.descripcion.slice(0, 60)}${inc.descripcion.length > 60 ? '…' : ''} (${nombreArea(inc.areaId)})`,
                    }))}
                    value={field.value || undefined}
                    onChange={(id) => {
                      field.onChange(id ?? '')
                      if (id && id !== incidentePrecargado?.id) handleIncidenteSeleccionado(id)
                    }}
                  />
                )}
              />
            )}
            {errors.incidenteId && (
              <p className={errorClass}>{errors.incidenteId.message as string}</p>
            )}
            {reemplazoPendiente && (
              <div
                role="alertdialog"
                aria-labelledby="qe-reemplazo-incidente-text"
                className="mt-2 flex flex-wrap items-center gap-3 rounded-md border border-amber/40 bg-amber/10 px-4 py-3 dark:border-amber/30 dark:bg-amber/10"
              >
                <p id="qe-reemplazo-incidente-text" className="flex-1 text-sm text-body dark:text-on-dark">
                  {t('form.confirmReemplazoIncidente', { numero: reemplazoPendiente.numero })}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    aplicarPrecarga(reemplazoPendiente)
                    setReemplazoPendiente(null)
                  }}
                  className="rounded-md bg-coral px-3 py-1.5 text-sm font-medium text-white hover:bg-coral-dark dark:bg-coral dark:hover:bg-coral-dark"
                >
                  {t('form.confirmReemplazoAcciones.reemplazar')}
                </button>
                <button
                  type="button"
                  onClick={() => setReemplazoPendiente(null)}
                  className="rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
                >
                  {t('form.confirmReemplazoAcciones.mantener')}
                </button>
              </div>
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
                        sublabel: `${text.slice(0, 60)}${text.length > 60 ? '…' : ''} (${nombreArea(nc.areaId)})`,
                      }
                    })}
                    value={field.value || undefined}
                    onChange={(id) => {
                      field.onChange(id ?? '')
                      const nc = nonconformities.find((n) => n.id === id)
                      if (nc) setValue('areaId', nc.areaId)
                    }}
                  />
                )}
              />
            )}
            {errors.ncId && <p className={errorClass}>{errors.ncId.message as string}</p>}
          </div>
        )}

        {origenValue === 'O3_HALLAZGO_AUDITORIA' && (
          <div className="md:col-span-2 grid grid-cols-1 gap-y-4">
            <div>
              <label className={labelClass} htmlFor="hallazgoCodigo">
                {t('form.fields.hallazgoCodigo')} <span className="text-error">*</span>
              </label>
              <input
                id="hallazgoCodigo"
                type="text"
                maxLength={200}
                className={inputClass}
                placeholder={t('form.hallazgoCodigoPlaceholder')}
                {...register('hallazgoCodigo')}
              />
              {errors.hallazgoCodigo && (
                <p className={errorClass}>{errors.hallazgoCodigo.message as string}</p>
              )}
            </div>
            <div>
              <Controller
                name="normativaVinculada"
                control={control}
                render={({ field }) => (
                  <NormativaVinculadaCombobox
                    ariaLabel={t('form.fields.clausula')}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.normativaVinculada && (
                <p className={errorClass}>
                  {errors.normativaVinculada.message ?? errors.normativaVinculada.normaOtraDetalle?.message}
                </p>
              )}
            </div>
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

        {!isEditMode && (
          <>
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
          </>
        )}

        {/* ── Severidad (half width, conditional in edit mode) ── */}
        {showSeveridadField && (
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
        )}

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
          {!isEditMode &&
            origenValue === 'O1_INCIDENTE_CAMPO' &&
            incidentePrecargado &&
            incidentePrecargado.id === incidenteIdValue && (
              <p className="mt-1.5 text-xs text-muted dark:text-on-dark-soft">
                {t('form.precargaIncidente', { numero: incidentePrecargado.numero })}
              </p>
            )}
        </div>

        {/* ── Área afectada (full width) ── */}
        <div className="md:col-span-2">
          <label className={labelClass} htmlFor="areaId">
            {t('form.fields.areaAfectada')} <span className="text-error">*</span>
          </label>
          <select id="areaId" className={selectClass} {...register('areaId')}>
            <option value="">{t('form.placeholders.select')}</option>
            {areasActivas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.nombre}
              </option>
            ))}
          </select>
          {errors.areaId && (
            <p className={errorClass}>{errors.areaId.message as string}</p>
          )}
          {showAreaDivergeWarning && origenEntidad && (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {t('form.areaDivergeWarning', {
                tipoEtiqueta: origenEntidad.tipoEtiqueta,
                numero: origenEntidad.numero,
                areaOrigen: nombreArea(origenEntidad.area),
              })}
            </p>
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

        {/* ── Responsable de investigación (full width, opcional, solo JCA en alta) ── */}
        {!isEditMode && esJca && (
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="responsableInvestigacionId">
              {t('form.fields.responsableInvestigacion')}
            </label>
            <Controller
              name="responsableInvestigacionId"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  id="responsableInvestigacionId"
                  ariaLabel={t('form.fields.responsableInvestigacion')}
                  placeholder={t('form.placeholders.responsableInvestigacion')}
                  options={candidatosResponsable.map((c) => ({
                    id: c.id,
                    label: c.nombreCompleto,
                    sublabel: t(`roles.${c.rol}`),
                  }))}
                  value={field.value || undefined}
                  onChange={(id) => field.onChange(id ?? '')}
                />
              )}
            />
          </div>
        )}

        {/* ── Footer buttons (full width) ── */}
        <div className="md:col-span-2 flex items-center justify-end gap-3 border-t border-hairline pt-4 dark:border-hairline/20">
          <button
            type="button"
            onClick={() => navigate(isEditMode && qe ? `/quality-events/${qe.id}` : '/quality-events')}
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
  )
}

export function QualityEventForm() {
  const { t } = useTranslation('qualityEvents')
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)
  const user = useAuthStore((s) => s.user)

  const { data: qe, isLoading: qeLoading } = useQualityEvent(id ?? '')
  const access = qe && user ? resolveQEEditAccess(qe, user) : null

  // D1/D8 — el incidente de la URL se carga aquí, antes de cualquier return, para que el body
  // nazca con la precarga en sus defaultValues (sin useEffect que sincronice el formulario).
  const [searchParams] = useSearchParams()
  const incidenteIdParam =
    !isEditMode && searchParams.get('origen') === 'O1_INCIDENTE_CAMPO' ? (searchParams.get('incidenteId') ?? '') : ''
  const { data: incidenteInicial, isLoading: incidenteLoading } = useIncident(incidenteIdParam)

  if (isEditMode) {
    if (qeLoading) {
      return (
        <PageWrapper title={t('form.editTitle')}>
          <SkeletonBlock />
        </PageWrapper>
      )
    }
    if (!qe) {
      return <Navigate to="/quality-events" replace />
    }
    if (!access?.reporteInicial) {
      return <Navigate to={`/quality-events/${qe.id}`} replace />
    }
  }

  if (incidenteIdParam && incidenteLoading) {
    return (
      <PageWrapper title={t('form.createTitle')}>
        <SkeletonBlock />
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title={isEditMode ? t('form.editTitle') : t('form.createTitle')}>
      <QualityEventFormBody
        key={qe?.id ?? 'create'}
        qe={qe}
        access={access}
        isEditMode={isEditMode}
        incidenteInicial={incidenteInicial}
      />
    </PageWrapper>
  )
}
