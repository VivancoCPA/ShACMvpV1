import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { AccionCorrectivaReadOnlyRow, type AccionCorrectivaReadOnly } from './AccionCorrectivaReadOnlyRow'
import { useQEAcciones } from '../../features/quality-events/hooks/useQEAcciones'
import { useQualityEvent } from '../../features/quality-events/hooks/useQualityEvent'

interface AccionesCorrectivasDelQEProps {
  qeId: string
  /** Namespace del origen: las claves `acSection.*` existen en ambos. */
  namespace: 'incidents' | 'nonconformities'
  titleId: string
  accionesPropias: AccionCorrectivaReadOnly[]
  solicitarACButton: ReactNode
}

// solicitudes-ac-y-ac-del-qe-en-origen: con QE vinculado, el análisis y las AC se trabajan en el
// QE — el incidente/NC muestra esas AC en solo lectura y sus AC propias quedan como "anteriores".
// La lista se refresca sola: el flujo de AC del QE invalida ['quality-events'].
export function AccionesCorrectivasDelQE({
  qeId,
  namespace,
  titleId,
  accionesPropias,
  solicitarACButton,
}: AccionesCorrectivasDelQEProps) {
  const { t } = useTranslation(namespace)
  const { data: qe } = useQualityEvent(qeId)
  const { data: accionesQE = [], isLoading, isError } = useQEAcciones(qeId)
  const solicitudesPendientes = qe?.solicitudesAC ?? 0
  const qeHref = `/quality-events/${qeId}`

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id={titleId} className="text-base font-medium text-ink dark:text-on-dark">
          <Link to={qeHref} className="hover:underline dark:text-on-dark">
            {qe?.numero ? t('acSection.delQE', { numero: qe.numero }) : t('acSection.delQESinNumero')}
          </Link>
          {accionesQE.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted dark:text-on-dark-soft">
              ({accionesQE.length})
            </span>
          )}
        </h3>

        <div className="flex items-center gap-3">
          {!isLoading && accionesQE.length === 0 && solicitarACButton}
          <Link
            to={qeHref}
            className="flex items-center gap-1 text-xs font-medium text-coral hover:underline dark:text-coral"
          >
            <ArrowUpRight size={14} />
            {t('acSection.actions.verQE')}
          </Link>
        </div>
      </div>

      {isLoading ? (
        <p className="py-4 text-sm text-muted dark:text-on-dark-soft">{t('acSection.cargandoQE')}</p>
      ) : isError ? (
        <p className="py-4 text-sm text-error dark:text-error">{t('acSection.errorQE')}</p>
      ) : accionesQE.length === 0 ? (
        <p className="py-4 text-sm text-muted dark:text-on-dark-soft">{t('acSection.qeSinAC')}</p>
      ) : (
        <ul className="divide-y divide-hairline dark:divide-hairline/20">
          {accionesQE.map((ac) => (
            <AccionCorrectivaReadOnlyRow key={ac.id} ac={ac} href={`${qeHref}#qe-ac-section`} />
          ))}
        </ul>
      )}

      {solicitudesPendientes > 0 && (
        <p className="mt-2 text-xs font-medium text-warning dark:text-warning">
          {t('acSection.solicitudesPendientes', { n: solicitudesPendientes })}
        </p>
      )}

      {accionesQE.length > 0 && solicitarACButton && (
        <div className="mt-3 flex justify-end">{solicitarACButton}</div>
      )}

      {accionesPropias.length > 0 && (
        <details className="mt-4 rounded-md border border-hairline px-4 py-2 dark:border-hairline/20">
          <summary className="cursor-pointer text-sm font-medium text-body dark:text-on-dark-soft">
            {t('acSection.anteriores')} ({accionesPropias.length})
          </summary>
          <ul className="divide-y divide-hairline dark:divide-hairline/20">
            {accionesPropias.map((ac) => (
              <AccionCorrectivaReadOnlyRow key={ac.id} ac={ac} />
            ))}
          </ul>
        </details>
      )}
    </>
  )
}
