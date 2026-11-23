import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  Hourglass,
  ListChecks,
  PenLine,
  Search,
  UserPlus,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '../../../stores/authStore'
import { UserAvatar } from '../../../components/ui/UserAvatar'
import { contarDiasHabiles } from '../utils/qualityEventHelpers'
import type { QESiguientePasoCodigo, QualityEvent, ResponsablePasoQE } from '../types/qualityEvent.types'

const MAX_RESPONSABLES_VISIBLES = 3
const MS_POR_DIA = 1000 * 60 * 60 * 24

const ICONOS: Record<QESiguientePasoCodigo, LucideIcon> = {
  ASIGNAR_RESPONSABLE: UserPlus,
  INICIAR_INVESTIGACION: Search,
  COMPLETAR_ANALISIS: ClipboardList,
  APROBAR_CAUSA_RAIZ: FileSignature,
  INICIAR_EJECUCION: Wrench,
  EJECUTAR_ACS: ListChecks,
  REGISTRAR_RESULTADO_CIERRE: PenLine,
  FIRMA_JCA: FileSignature,
  FIRMA_SUPERVISOR: FileSignature,
  CIERRE_INCONSISTENTE: AlertTriangle,
  ESPERA_VERIFICACION: Hourglass,
  VERIFICAR_EFICACIA: ClipboardCheck,
  FINALIZADO: CheckCircle2,
}

type Semaforo = 'verde' | 'ambar' | 'rojo'

const SEMAFORO_CLASS: Record<Semaforo, string> = {
  verde: 'text-success dark:text-success',
  ambar: 'text-amber dark:text-amber',
  rojo: 'text-error dark:text-error',
}

// Verde; ámbar a 1 día hábil o menos; rojo si venció (qe-siguiente-paso-responsable D10).
function getSemaforoPlazo(plazo: Date, ahora: Date): Semaforo {
  if (plazo.getTime() < ahora.getTime()) return 'rojo'
  return contarDiasHabiles(ahora, plazo) <= 1 ? 'ambar' : 'verde'
}

// El backend devuelve el nombre ya concatenado; UserAvatar arma las iniciales desde nombre/apellido.
function avatarDe(r: ResponsablePasoQE) {
  const [nombre, ...resto] = r.nombreCompleto.split(' ')
  return { nombre, apellido: resto.join(' ') || ' ', avatarUrl: r.avatarUrl ?? undefined }
}

interface QESiguientePasoBannerProps {
  qe: QualityEvent
}

// Solo informativo: las acciones siguen en sus secciones (qe-siguiente-paso-responsable D1).
export function QESiguientePasoBanner({ qe }: QESiguientePasoBannerProps) {
  const { t, i18n } = useTranslation('qualityEvents')
  const user = useAuthStore((s) => s.user)
  const siguientePaso = qe.siguientePaso
  if (!siguientePaso) return null

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short' })
  const ahora = new Date()
  const desde = new Date(siguientePaso.estadoDesde)

  if (siguientePaso.paso === 'FINALIZADO') {
    return (
      <div
        role="status"
        className="mb-4 flex items-center gap-2.5 rounded-md border border-hairline bg-surface-soft px-4 py-3 text-sm text-body dark:border-hairline/20 dark:bg-surface-dark-soft dark:text-on-dark"
      >
        <CheckCircle2 size={16} className="shrink-0 text-success dark:text-success" aria-hidden="true" />
        <span>{t('detail.siguientePaso.finalizado', { fecha: dateFormatter.format(desde) })}</span>
      </div>
    )
  }

  const Icono = ICONOS[siguientePaso.paso]
  const responsables = siguientePaso.responsables
  const visibles = responsables.slice(0, MAX_RESPONSABLES_VISIBLES)
  const ocultos = responsables.length - visibles.length
  const teToca = !!user && responsables.some((r) => r.id === user.id)
  const diasEnEstado = Math.max(0, Math.floor((ahora.getTime() - desde.getTime()) / MS_POR_DIA))
  const plazo = siguientePaso.plazoFecha ? new Date(siguientePaso.plazoFecha) : null
  const semaforo = plazo ? getSemaforoPlazo(plazo, ahora) : null

  return (
    <div
      role="status"
      aria-label={t('detail.siguientePaso.titulo')}
      data-te-toca={teToca || undefined}
      className={`mb-4 rounded-md border px-4 py-3 text-sm ${
        teToca
          ? 'border-coral bg-coral/5 dark:border-coral dark:bg-coral/10'
          : 'border-hairline bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark-soft'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 text-ink dark:text-on-dark">
        <Icono size={16} className="shrink-0 text-coral dark:text-coral" aria-hidden="true" />
        <span className="font-medium">{t('detail.siguientePaso.titulo')}:</span>
        <span>{t(`detail.siguientePaso.paso.${siguientePaso.paso}`)}</span>
        {teToca && (
          <span className="ml-auto inline-flex items-center rounded-pill bg-coral px-2 py-0.5 text-xs font-medium text-white dark:bg-coral dark:text-white">
            {t('detail.siguientePaso.teToca')}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-body dark:text-on-dark">
        <span className="font-medium">{t('detail.siguientePaso.responsable')}:</span>
        {responsables.length === 0 ? (
          <span className="font-medium text-amber dark:text-amber">{t('detail.siguientePaso.sinResponsable')}</span>
        ) : (
          <>
            {visibles.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1.5">
                <UserAvatar size="sm" user={avatarDe(r)} />
                {r.nombreCompleto}
              </span>
            ))}
            {ocultos > 0 && (
              <span
                className="text-muted dark:text-on-dark-soft"
                title={responsables.slice(MAX_RESPONSABLES_VISIBLES).map((r) => r.nombreCompleto).join(', ')}
              >
                {t('detail.siguientePaso.masResponsables', { count: ocultos })}
              </span>
            )}
          </>
        )}
      </div>

      <p className="mt-1.5 text-xs text-muted dark:text-on-dark-soft">
        {t('detail.siguientePaso.desde', { fecha: dateFormatter.format(desde), dias: diasEnEstado })}
        {plazo && semaforo && (
          <>
            {' · '}
            <span
              className={`font-medium ${SEMAFORO_CLASS[semaforo]}`}
              data-semaforo={semaforo}
              title={siguientePaso.plazoRegla ?? undefined}
            >
              {t('detail.siguientePaso.plazo', { fecha: dateFormatter.format(plazo) })}
            </span>
          </>
        )}
        {siguientePaso.paso === 'EJECUTAR_ACS' && siguientePaso.total != null && (
          <>
            {' · '}
            {t('detail.siguientePaso.progresoAC', { progreso: siguientePaso.progreso ?? 0, total: siguientePaso.total })}
          </>
        )}
      </p>
    </div>
  )
}
