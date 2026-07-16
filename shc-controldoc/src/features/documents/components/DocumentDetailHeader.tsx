import { useTranslation } from 'react-i18next'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { DocumentConfidencialidadBadge } from './DocumentConfidencialidadBadge'
import { RevisionSemaforo } from './RevisionSemaforo'
import { useAuthStore } from '../../../stores/authStore'
import { resolveUserDisplayName } from '../../../mocks/fixtures/userIdentity.fixtures'
import type { Documento } from '../../../types/documents.types'

interface DocumentDetailHeaderProps {
  documento: Documento
}

function formatDate(iso: string | undefined, locale: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso))
}

export function DocumentDetailHeader({ documento }: DocumentDetailHeaderProps) {
  const { t, i18n } = useTranslation('documents')
  const locale = i18n.language
  const user = useAuthStore((s) => s.user)

  const isJefeDocOrDireccion =
    user?.rol === 'JEFE_CONTROL_DOCUMENTARIO' || user?.rol === 'ALTA_DIRECCION'

  const showPeriodicReviewSemaforo =
    documento.estado === 'PUBLICADO' || documento.estado === 'EN_REVISION_PERIODICA'

  return (
    <div className="space-y-4">
      {/* Banners */}
      {documento.estado === 'OBSOLETO' && (
        <div className="rounded-md border border-error/30 bg-error/10 p-3 text-sm text-error">
          {t('detail.banners.obsoleto')}
        </div>
      )}

      {documento.qeVinculados.length > 0 && (
        <div className="rounded-md border border-amber/30 bg-amber/10 p-3 text-sm text-amber">
          {t('detail.banners.qeVinculados', { ids: documento.qeVinculados.join(', ') })}
        </div>
      )}

      {documento.confidencialidad === 'RESTRINGIDO' && isJefeDocOrDireccion && (
        <div className="rounded-md border border-teal/30 bg-teal/10 p-3 text-sm text-teal">
          {t('detail.banners.restringido', {
            roles: (documento.rolesAutorizados ?? []).join(', '),
          })}
        </div>
      )}

      {/* Header card — unified: title + badges + metadata grid */}
      <div className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted dark:text-on-dark-soft">
            {documento.codigo}
          </span>
          <StatusBadge status={documento.estado} />
          <DocumentConfidencialidadBadge confidencialidad={documento.confidencialidad} />
          {showPeriodicReviewSemaforo && (
            <RevisionSemaforo fechaRevisionProxima={documento.fechaRevisionProxima} />
          )}
        </div>

        <h1 className="text-2xl font-semibold text-ink dark:text-on-dark">
          {documento.titulo}
        </h1>

        {/* Metadata grid */}
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Tipo</dt>
            <dd className="mt-0.5 text-body dark:text-on-dark">
              {t(`types.${documento.tipo}`, { defaultValue: documento.tipo })}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Versión</dt>
            <dd className="mt-0.5 font-mono text-body dark:text-on-dark">{documento.version}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Área</dt>
            <dd className="mt-0.5 text-body dark:text-on-dark">{documento.area}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Autor</dt>
            <dd className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">{resolveUserDisplayName(documento.autorId)}</dd>
          </div>
          {documento.revisorId && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Revisor</dt>
              <dd className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">{resolveUserDisplayName(documento.revisorId)}</dd>
            </div>
          )}
          {documento.aprobadorId && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Aprobador</dt>
              <dd className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">{resolveUserDisplayName(documento.aprobadorId)}</dd>
            </div>
          )}
          {documento.fechaEmision && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Emisión</dt>
              <dd className="mt-0.5 text-body dark:text-on-dark">{formatDate(documento.fechaEmision, locale)}</dd>
            </div>
          )}
          {documento.fechaVigencia && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Vigencia</dt>
              <dd className="mt-0.5 text-body dark:text-on-dark">{formatDate(documento.fechaVigencia, locale)}</dd>
            </div>
          )}
          {documento.fechaRevisionProxima && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Próx. revisión</dt>
              <dd className="mt-0.5 text-body dark:text-on-dark">{formatDate(documento.fechaRevisionProxima, locale)}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
