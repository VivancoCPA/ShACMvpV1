import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Info,
  Paperclip,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { useAuthStore } from '../../../stores/authStore'
import { useIncident, useDeleteIncident } from '../hooks/useIncidents'
import { useLocales } from '../hooks/useLocales'
import { getIncidentPermissions } from '../utils/incidentPermissions'
import { getPlazoInvestigacion } from '../utils/incidentPlazoInvestigacion'
import { SeverityBadge } from '../../../components/shared/SeverityBadge'
import { IncidentStatusBadge } from '../components/IncidentStatusBadge'
import { IncidentTypeBadge } from '../components/IncidentTypeBadge'
import { EscaladoBanner } from '../components/EscaladoBanner'
import { IncidentACSection } from '../components/IncidentACSection'
import { formatShortDate } from '../../../utils/date.utils'
import { CONDICION_ENTORNO_LABELS } from '../../../constants/shared.constants'
import type { NCSeveridad } from '../../nonconformities/types/nonconformity.types'
import type { IncidentEvidencia } from '../types/incident.types'

function SkeletonBlock() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-hairline dark:bg-surface-dark-soft" />
      ))}
    </div>
  )
}

interface DeleteModalProps {
  numero: string
  onConfirm: () => void
  onClose: () => void
  isPending: boolean
}

function DeleteModal({ numero, onConfirm, onClose, isPending }: DeleteModalProps) {
  const { t } = useTranslation('incidents')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('delete.confirm.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <h2 className="mb-2 font-medium text-ink dark:text-on-dark">{t('delete.confirm.title')}</h2>
        <p className="mb-5 text-sm text-muted dark:text-on-dark-soft">
          {t('delete.confirm.message', { numero })}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
          >
            {t('delete.confirm.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white hover:bg-error/80 disabled:opacity-60"
          >
            {t('delete.confirm.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface LightboxProps {
  url: string
  onClose: () => void
}

function Lightbox({ url, onClose }: LightboxProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 text-white hover:text-on-dark-soft"
        aria-label="Cerrar"
      >
        <X size={24} />
      </button>
      <img
        src={url}
        alt=""
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

interface EvidenciasSubBlockProps {
  evidencias: IncidentEvidencia[]
  onLightbox: (url: string) => void
}

function EvidenciasSubBlock({ evidencias, onLightbox }: EvidenciasSubBlockProps) {
  const { t } = useTranslation('incidents')

  return (
    <div className="border-t border-hairline pt-4 dark:border-hairline/20">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted dark:text-on-dark-soft">
        <Paperclip size={13} />
        {t('detail.evidencias.title')}
      </p>
      <div className="flex flex-wrap gap-2">
        {evidencias.map((ev) =>
          ev.tipo === 'imagen' ? (
            <button
              key={ev.id}
              type="button"
              onClick={() => onLightbox(ev.url)}
              className="group relative h-20 w-20 overflow-hidden rounded-md border border-hairline dark:border-hairline/20"
              aria-label={ev.nombre}
            >
              <img src={ev.url} alt={ev.nombre} className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-ink/0 transition-colors group-hover:bg-ink/30">
                <Eye size={16} className="text-white opacity-0 group-hover:opacity-100" />
              </div>
            </button>
          ) : (
            <a
              key={ev.id}
              href={ev.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-hairline bg-surface-soft p-1 hover:border-coral dark:border-hairline/20 dark:bg-surface-dark-soft"
            >
              <FileText size={20} className="text-muted dark:text-on-dark-soft" />
              <span className="max-w-full truncate text-center text-[10px] text-muted dark:text-on-dark-soft">
                {ev.nombre}
              </span>
              <span className="text-[9px] text-muted dark:text-on-dark-soft">
                {ev.tamanioKb} KB
              </span>
            </a>
          )
        )}
      </div>
    </div>
  )
}

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('incidents')
  const user = useAuthStore((s) => s.user)

  const { data: incident, isLoading, isError } = useIncident(id ?? '')
  const deleteMutation = useDeleteIncident()
  const { data: locales = [] } = useLocales()

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [investigacionOpen, setInvestigacionOpen] = useState(true)
  const [descripcionOpen, setDescripcionOpen] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  useEffect(() => {
    if (incident?.deletedAt) {
      navigate('/incidents', { replace: true })
    }
  }, [incident, navigate])

  if (isLoading) return <SkeletonBlock />

  if (isError || !incident) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-error/30 bg-error/5 px-6 py-8 text-center">
          <p className="mb-4 text-sm text-muted dark:text-on-dark-soft">{t('detail.notFound')}</p>
          <button
            type="button"
            onClick={() => navigate('/incidents')}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
          >
            {t('detail.backToList')}
          </button>
        </div>
      </div>
    )
  }

  const permissions = user ? getIncidentPermissions(incident, user.rol) : null
  const isAnulado = incident.estado === 'ANULADO'
  const plazo = getPlazoInvestigacion(incident.severidad)
  const hasEvidencias = (incident.evidencias?.length ?? 0) > 0
  const missingInformeMedico = incident.tipo === 'ACCIDENTE' && !incident.informeMedicoAdjunto
  const missingEvidencias = incident.tipo === 'ACCIDENTE' && !hasEvidencias
  const selectedLocal = locales.find((l) => l.id === incident.localId)

  const handleDelete = () => {
    deleteMutation.mutate(incident.id, {
      onSuccess: () => navigate('/incidents'),
    })
  }

  const fechaEvento = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(incident.fechaEvento))

  const fechaReporte = formatShortDate(incident.fechaReporte, i18n.language)

  return (
    <div className="p-6">
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {showDeleteModal && (
        <DeleteModal
          numero={incident.numero}
          onConfirm={handleDelete}
          onClose={() => setShowDeleteModal(false)}
          isPending={deleteMutation.isPending}
        />
      )}

      <div className={`mx-auto max-w-3xl ${isAnulado ? 'opacity-70' : ''}`}>
        {/* Breadcrumb + back */}
        <button
          type="button"
          onClick={() => navigate('/incidents')}
          className="mb-3 flex items-center gap-1.5 text-sm text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <ArrowLeft size={14} />
          {t('detail.backToList')}
        </button>
        <p className="mb-1 text-xs text-muted dark:text-on-dark-soft">
          {t('list.title')} / {incident.numero}
        </p>

        {/* Cabecera */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-mono text-2xl font-semibold text-ink dark:text-on-dark">
              {incident.numero}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <IncidentTypeBadge type={incident.tipo} />
              <IncidentStatusBadge status={incident.estado} />
              <SeverityBadge severity={incident.severidad as NCSeveridad} />
            </div>
          </div>

          {/* Acción buttons */}
          {!isAnulado && permissions && (
            <div className="flex items-center gap-2">
              {permissions.canCrearQE && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/quality-events/nuevo?origen=O1_INCIDENTE_CAMPO&incidenteId=${encodeURIComponent(incident.id)}&incidenteNumero=${encodeURIComponent(incident.numero)}&incidenteArea=${encodeURIComponent(incident.areaId)}`,
                    )
                  }
                  className="flex items-center gap-1.5 rounded-md bg-coral px-3 py-1.5 text-sm font-medium text-white hover:bg-coral-dark"
                >
                  {t('detail.actions.crearQE')}
                </button>
              )}
              {permissions.canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/incidents/${incident.id}/editar`)}
                  className="flex items-center gap-1.5 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
                >
                  <Pencil size={14} />
                  {t('detail.actions.editar')}
                </button>
              )}
              {permissions.canDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-1.5 rounded-md border border-error/30 bg-error/5 px-3 py-1.5 text-sm font-medium text-error hover:bg-error/10"
                >
                  <Trash2 size={14} />
                  {t('detail.actions.eliminar')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Escalado banner */}
        <EscaladoBanner severidad={incident.severidad} />

        {/* Metadatos */}
        <div className="mb-4 rounded-lg border border-hairline bg-surface-card p-5 dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted dark:text-on-dark-soft">{t('detail.fields.fechaEvento')}</dt>
              <dd className="mt-0.5 text-sm text-body dark:text-on-dark">{fechaEvento}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted dark:text-on-dark-soft">{t('detail.fields.area')}</dt>
              <dd className="mt-0.5 text-sm text-body dark:text-on-dark">{incident.areaId}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted dark:text-on-dark-soft">{t('detail.fields.turno')}</dt>
              <dd className="mt-0.5 text-sm text-body dark:text-on-dark">{t(`turno.${incident.turno}`)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted dark:text-on-dark-soft">{t('detail.fields.fechaReporte')}</dt>
              <dd className="mt-0.5 text-sm text-body dark:text-on-dark">{fechaReporte}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted dark:text-on-dark-soft">{t('detail.fields.reportadoPor')}</dt>
              <dd className="mt-0.5 text-sm text-body dark:text-on-dark">{incident.reportadoPorId}</dd>
            </div>
          </dl>
        </div>

        {/* Bloque Descripción del evento */}
        <div className="mb-4 rounded-lg border border-hairline bg-surface-card dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <button
            type="button"
            onClick={() => setDescripcionOpen((v) => !v)}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <h2 className="text-sm font-semibold text-ink dark:text-on-dark">
              {t('detail.sections.descripcion')}
            </h2>
            {descripcionOpen ? (
              <ChevronUp size={16} className="text-muted dark:text-on-dark-soft" />
            ) : (
              <ChevronDown size={16} className="text-muted dark:text-on-dark-soft" />
            )}
          </button>

          {descripcionOpen && (
            <div className="space-y-4 border-t border-hairline px-6 pb-6 pt-4 dark:border-hairline/20">
              <p className="whitespace-pre-wrap text-sm text-body dark:text-on-dark-soft">
                {incident.descripcion}
              </p>

              {incident.huboLesionados && (
                <div className="text-sm text-body dark:text-on-dark-soft">
                  <span className="font-medium">{t('detail.fields.huboLesionados')}:</span>{' '}
                  {t('detail.fields.siConPersonas', { num: incident.numPersonasAfectadas ?? 1 })}
                </div>
              )}

              {incident.condicionesEntorno && incident.condicionesEntorno.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted dark:text-on-dark-soft">
                    {t('detail.fields.condicionesEntorno')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {incident.condicionesEntorno.map((c) => (
                      <span
                        key={c}
                        className="rounded-pill bg-surface-soft px-2.5 py-0.5 text-xs text-body dark:bg-surface-dark dark:text-on-dark-soft"
                      >
                        {CONDICION_ENTORNO_LABELS[c]}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {incident.equiposInvolucrados && incident.equiposInvolucrados.length > 0 && (
                <div>
                  <p className="mb-0.5 text-xs font-medium text-muted dark:text-on-dark-soft">
                    {t('detail.fields.equiposInvolucrados')}
                  </p>
                  <p className="text-sm text-body dark:text-on-dark-soft">
                    {incident.equiposInvolucrados.join(', ')}
                  </p>
                </div>
              )}

              {incident.personalInvolucrado && incident.personalInvolucrado.length > 0 && (
                <div>
                  <p className="mb-0.5 text-xs font-medium text-muted dark:text-on-dark-soft">
                    {t('detail.fields.personalInvolucrado')}
                  </p>
                  <p className="text-sm text-body dark:text-on-dark-soft">
                    {incident.personalInvolucrado.join(', ')}
                  </p>
                </div>
              )}

              {incident.testigos && incident.testigos.length > 0 && (
                <div>
                  <p className="mb-0.5 text-xs font-medium text-muted dark:text-on-dark-soft">
                    {t('detail.fields.testigos')}
                  </p>
                  <p className="text-sm text-body dark:text-on-dark-soft">
                    {incident.testigos.join(', ')}
                  </p>
                </div>
              )}

              {incident.atencionMedicaRequerida && (
                <div>
                  <p className="mb-0.5 text-xs font-medium text-muted dark:text-on-dark-soft">
                    {t('detail.fields.atencionMedica')}
                  </p>
                  {incident.atencionMedicaDescripcion && (
                    <p className="text-sm text-body dark:text-on-dark-soft">
                      {incident.atencionMedicaDescripcion}
                    </p>
                  )}
                </div>
              )}

              {incident.informeMedicoAdjunto && (
                <a
                  href={incident.informeMedicoAdjunto}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-coral hover:underline"
                >
                  <FileText size={14} />
                  {t('detail.fields.informeMedico')}
                </a>
              )}

              {/* Evidencias sub-block */}
              {hasEvidencias && (
                <EvidenciasSubBlock
                  evidencias={incident.evidencias!}
                  onLightbox={setLightboxUrl}
                />
              )}

              {/* Alerta ACCIDENTE sin evidencias */}
              {missingEvidencias && (
                <div className="flex items-start gap-2 rounded-md border border-amber/30 bg-amber/10 px-3 py-2.5">
                  <Info size={14} className="mt-0.5 shrink-0 text-amber" />
                  <p className="text-xs text-amber">{t('detail.alertas.sinEvidencias')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bloque Ubicación */}
        {incident.localId && (
          <div className="mb-4 rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated">
            <h2 className="mb-4 text-sm font-semibold text-ink dark:text-on-dark">
              {t('detail.sections.ubicacion')}
            </h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-xs text-muted dark:text-on-dark-soft">{t('detail.fields.local')}</dt>
                <dd className="mt-0.5 text-sm text-body dark:text-on-dark">
                  {incident.localNombre ?? incident.localId}
                </dd>
              </div>
              {incident.zonaId && (
                <div>
                  <dt className="text-xs text-muted dark:text-on-dark-soft">{t('detail.fields.zona')}</dt>
                  <dd className="mt-0.5 text-sm text-body dark:text-on-dark">
                    {incident.zonaNombre ?? incident.zonaId}
                  </dd>
                </div>
              )}
            </dl>
            {selectedLocal?.planoPngUrl && incident.ubicacion && (
              <div className="mt-4">
                <div
                  className="relative overflow-hidden rounded-md border border-hairline dark:border-hairline/20"
                  style={{ maxWidth: '240px' }}
                >
                  <img
                    src={selectedLocal.planoPngUrl}
                    alt={incident.localNombre ?? incident.localId}
                    className="w-full"
                  />
                  <div
                    className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-coral shadow-md"
                    style={{ left: `${incident.ubicacion.x}%`, top: `${incident.ubicacion.y}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bloque Información de investigación */}
        <div className="mb-4 rounded-lg border border-hairline bg-surface-card dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <button
            type="button"
            onClick={() => setInvestigacionOpen((v) => !v)}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <h2 className="text-sm font-semibold text-ink dark:text-on-dark">
              {t('detail.sections.investigacion')}
            </h2>
            {investigacionOpen ? (
              <ChevronUp size={16} className="text-muted dark:text-on-dark-soft" />
            ) : (
              <ChevronDown size={16} className="text-muted dark:text-on-dark-soft" />
            )}
          </button>

          {investigacionOpen && (
            <div className="space-y-3 border-t border-hairline px-6 pb-6 pt-4 dark:border-hairline/20">
              <div className="flex items-center gap-2 rounded-md border border-hairline bg-surface-soft px-3 py-2 dark:border-hairline/20 dark:bg-surface-dark-soft">
                <Info size={13} className="shrink-0 text-muted dark:text-on-dark-soft" />
                <p className="text-xs text-muted dark:text-on-dark-soft">
                  {t('detail.investigacion.plazoDias', { dias: plazo })}
                </p>
              </div>

              <p className="text-sm text-body dark:text-on-dark-soft">
                <span className="font-medium">{t('detail.fields.estado')}:</span>{' '}
                {t(`status.${incident.estado}`)}
              </p>

              {/* Alerta ACCIDENTE sin informe médico */}
              {missingInformeMedico && (
                <div className="flex items-start gap-2 rounded-md border border-amber/30 bg-amber/10 px-3 py-2.5">
                  <Info size={14} className="mt-0.5 shrink-0 text-amber" />
                  <p className="text-xs text-amber">{t('detail.alertas.sinInformeMedico')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Acciones Correctivas */}
        <div className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <IncidentACSection
            incidenteId={incident.id}
            incidenteNumero={incident.numero}
            incidenteEstado={incident.estado}
            accionesCorrectivas={incident.accionesCorrectivas ?? []}
            canAsignarAC={permissions?.canAddAC ?? false}
            canCerrarAC={permissions?.canCerrarAC ?? false}
            qeId={incident.qeId}
          />
        </div>
      </div>
    </div>
  )
}
