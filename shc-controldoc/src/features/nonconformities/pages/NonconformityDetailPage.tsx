import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, AlertTriangle, ArrowLeft } from 'lucide-react'
import { useNonconformity, useAnularNonconformity } from '../hooks/useNonconformities'
import { getNCPermissions } from '../utils/ncPermissions'
import { useAuthStore } from '../../../stores/authStore'
import { NCStatusBadge } from '../../../components/shared/NCStatusBadge'
import { SeverityBadge } from '../../../components/shared/SeverityBadge'
import { DeadlineBadge } from '../../../components/shared/DeadlineBadge'
import { AnularNCModal } from '../components/AnularNCModal'
import { ACSection } from '../components/ACSection'
import type { AuditTrailEntry } from '../types/nonconformity.types'
import { getUsersStore } from '../../../mocks/fixtures/auth.fixtures'
import { resolveUserDisplayName } from '../../../mocks/fixtures/userIdentity.fixtures'
import { useArea } from '../../areas/hooks/useAreas'

function SkeletonRow() {
  return (
    <div className="h-4 animate-pulse rounded bg-hairline dark:bg-surface-dark-soft" />
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-muted dark:text-on-dark-soft">{label}</dt>
      <dd className="mt-0.5 text-sm text-body dark:text-on-dark sm:col-span-2 sm:mt-0">
        {children}
      </dd>
    </div>
  )
}

function AuditTrailItem({ entry }: { entry: AuditTrailEntry }) {
  const { i18n } = useTranslation()
  const formatted = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(entry.timestamp))

  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-body dark:text-on-dark">{entry.accion}</span>
        <time className="shrink-0 text-xs text-muted dark:text-on-dark-soft">{formatted}</time>
      </div>
      <p className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">
        {entry.realizadoPorNombre}
        {entry.estadoAnterior && entry.estadoNuevo && (
          <span>
            {' '}· {entry.estadoAnterior} → {entry.estadoNuevo}
          </span>
        )}
        {entry.campoModificado && (
          <span>
            {' '}· {entry.campoModificado}: {entry.valorAnterior} → {entry.valorNuevo}
          </span>
        )}
      </p>
    </li>
  )
}

export function NonconformityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('nonconformities')
  const user = useAuthStore((s) => s.user)

  const { data: nc, isLoading, isError, refetch } = useNonconformity(id ?? '')
  const { data: area } = useArea(nc?.areaId ?? '')
  const anularMutation = useAnularNonconformity()

  const [showAnularModal, setShowAnularModal] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    )
  }

  if (isError || !nc) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-error/30 bg-error/5 px-6 py-8 text-center">
          <p className="mb-4 text-sm text-error">{t('detail.error')}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
          >
            {t('detail.retry')}
          </button>
        </div>
      </div>
    )
  }

  const permissions = user ? getNCPermissions(nc, user.rol) : null

  const handleAnular = (justificacion: string) => {
    anularMutation.mutate(
      { id: nc.id, justificacion },
      {
        onSuccess: () => {
          setShowAnularModal(false)
          navigate('/nonconformities')
        },
      },
    )
  }

  const sortedAudit = [...nc.auditTrail].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  const fechaDeteccionFormatted = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'short',
  }).format(new Date(nc.fechaDeteccion))

  return (
    <div className="p-6">
      {showAnularModal && (
        <AnularNCModal
          isPending={anularMutation.isPending}
          onConfirm={handleAnular}
          onClose={() => setShowAnularModal(false)}
        />
      )}

      <div className="mx-auto max-w-3xl">
        {/* Back + Header */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate('/nonconformities')}
            className="mb-3 flex items-center gap-1.5 text-sm text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
          >
            <ArrowLeft size={14} />
            {t('detail.back')}
          </button>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-medium text-coral">{nc.numero}</p>
              <h1 className="mt-0.5 font-display text-2xl font-normal text-ink dark:text-on-dark">
                {nc.titulo ?? nc.descripcion.slice(0, 80)}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <SeverityBadge severity={nc.severidad} />
              <NCStatusBadge status={nc.estado} />
            </div>
          </div>
        </div>

        {/* ANULADA alert */}
        {nc.estado === 'ANULADA' && nc.justificacionAnulacion && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-error/20 bg-error/5 px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-error" />
            <div>
              <p className="text-sm font-medium text-error">{t('detail.anulada.title')}</p>
              <p className="mt-0.5 text-sm text-body dark:text-on-dark-soft">
                <span className="font-medium">{t('detail.anulada.justificacion')}:</span>{' '}
                {nc.justificacionAnulacion}
              </p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {permissions && (
          <div className="mb-6 flex flex-wrap gap-2">
            {permissions.canCrearQE && (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/quality-events/nuevo?origen=O2_NC_DETECTADA&ncId=${encodeURIComponent(nc.id)}&ncNumero=${encodeURIComponent(nc.numero)}&ncArea=${encodeURIComponent(nc.areaId)}`,
                  )
                }
                className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
              >
                {t('detail.actions.crearQE')}
              </button>
            )}
            {permissions.canAnular && nc.estado !== 'ANULADA' && (
              <button
                type="button"
                onClick={() => setShowAnularModal(true)}
                className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white hover:bg-error/80"
              >
                {t('detail.actions.anular')}
              </button>
            )}
          </div>
        )}

        {/* Info card */}
        <div className="mb-6 rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <h2 className="mb-2 text-sm font-semibold text-ink dark:text-on-dark">
            {t('detail.sections.info')}
          </h2>
          <dl className="divide-y divide-hairline dark:divide-hairline/20">
            <FieldRow label={t('detail.fields.dominio')}>
              {t(`dominio.${nc.dominio}`)}
            </FieldRow>
            <FieldRow label={t('detail.fields.origen')}>
              {t(`origen.${nc.origen}`)}
            </FieldRow>
            <FieldRow label={t('detail.fields.tipo')}>
              {t(`tipo.${nc.tipo}`)}
            </FieldRow>
            <FieldRow label={t('detail.fields.area')}>{area?.nombre ?? nc.areaId}</FieldRow>
            {nc.procesoInvolucrado && (
              <FieldRow label={t('detail.fields.proceso')}>{nc.procesoInvolucrado}</FieldRow>
            )}
            <FieldRow label={t('detail.fields.fechaDeteccion')}>{fechaDeteccionFormatted}</FieldRow>
            {nc.fechaCierre && (
              <FieldRow label={t('detail.fields.fechaCierre')}>
                <DeadlineBadge fechaCierre={nc.fechaCierre} estado={nc.estado} />
              </FieldRow>
            )}
            {(() => {
              const detectadoPorId = nc.detectadoPorId
              if (!detectadoPorId) return null
              const u = getUsersStore().find((x) => x.id === detectadoPorId)
              return (
                <FieldRow label={t('detail.fields.detectadoPor')}>
                  {u ? `${u.nombre} ${u.apellido} (${u.rol})` : resolveUserDisplayName(detectadoPorId)}
                </FieldRow>
              )
            })()}
            {nc.turno && (
              <FieldRow label={t('detail.fields.turno')}>
                {t(`form.turno.${nc.turno}`)}
              </FieldRow>
            )}
            {nc.mineralInvolucrado && (
              <FieldRow label={t('detail.fields.mineral')}>{nc.mineralInvolucrado}</FieldRow>
            )}
            {nc.requiereIPER && (
              <FieldRow label={t('detail.fields.requiereIPER')}>
                <span className="text-amber">✓ {t('detail.fields.requiereIPER')}</span>
              </FieldRow>
            )}
          </dl>
        </div>

        {/* Descripción */}
        <div className="mb-6 rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <h2 className="mb-2 text-sm font-semibold text-ink dark:text-on-dark">
            {t('detail.sections.info')}
          </h2>
          <p className="whitespace-pre-wrap text-sm text-body dark:text-on-dark-soft">
            {nc.descripcion}
          </p>
          {nc.accionInmediata && (
            <div className="mt-3 border-t border-hairline pt-3 dark:border-hairline/20">
              <p className="mb-1 text-xs font-medium text-muted dark:text-on-dark-soft">
                {t('detail.fields.accionInmediata')}
              </p>
              <p className="text-sm text-body dark:text-on-dark-soft">{nc.accionInmediata}</p>
            </div>
          )}
        </div>

        {/* Acciones Correctivas */}
        <div className="mb-6 rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <ACSection
            ncId={nc.id}
            ncNumero={nc.numero}
            accionesCorrectivas={nc.accionesCorrectivas}
            ncEstado={nc.estado}
            canAsignarAC={permissions?.canAsignarAC ?? false}
            canCerrarAC={permissions?.canCerrarAC ?? false}
            qeGeneradoId={nc.qeGeneradoId}
          />
        </div>

        {/* Audit Trail — collapsible, only for canVerAuditTrail */}
        {permissions?.canVerAuditTrail && (
          <div className="rounded-lg border border-hairline bg-surface-card dark:border-hairline/20 dark:bg-surface-dark-elevated">
            <button
              type="button"
              onClick={() => setAuditOpen((v) => !v)}
              className="flex w-full items-center justify-between px-6 py-4 text-left"
            >
              <h2 className="text-sm font-semibold text-ink dark:text-on-dark">
                {t('detail.sections.auditTrail')}
                <span className="ml-2 text-xs font-normal text-muted dark:text-on-dark-soft">
                  ({sortedAudit.length})
                </span>
              </h2>
              {auditOpen ? (
                <ChevronUp size={16} className="text-muted dark:text-on-dark-soft" />
              ) : (
                <ChevronDown size={16} className="text-muted dark:text-on-dark-soft" />
              )}
            </button>

            {auditOpen && (
              <ul className="divide-y divide-hairline border-t border-hairline px-6 dark:divide-hairline/20 dark:border-hairline/20">
                {sortedAudit.map((entry) => (
                  <AuditTrailItem key={entry.id} entry={entry} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
