import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Pagination } from '../../../components/shared/Pagination'
import { formatCalendarDate, formatShortDate } from '../../../utils/date.utils'
import { isRouteAllowedForRole } from '../../../router/routeAccess'
import { rutaOrigenAC } from '../utils/filtrosUrl'
import { textoPlazo } from '../utils/textoPlazo'
import type {
  ACEstadoNormalizado,
  ACListadoFiltros,
  ACListadoOrden,
  ACListadoPagination,
  ACOrigenTipo,
  AccionCorrectivaListadoItem,
} from '../types/accionesCorrectivasListado.types'
import type { UserRole } from '../../../types/auth.types'

const ORIGEN_BADGE: Record<ACOrigenTipo, string> = {
  QE: 'bg-coral/10 text-coral-dark dark:bg-coral/20 dark:text-coral',
  NC: 'bg-amber/15 text-body-strong dark:bg-amber/20 dark:text-amber',
  INCIDENTE: 'bg-teal/15 text-body-strong dark:bg-teal/20 dark:text-teal',
}

const ESTADO_BADGE: Record<ACEstadoNormalizado, string> = {
  PENDIENTE: 'bg-surface-cream text-body dark:bg-surface-dark-soft dark:text-on-dark-soft',
  EN_EJECUCION: 'bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
  PENDIENTE_VERIFICACION: 'bg-amber/15 text-body-strong dark:bg-amber/20 dark:text-amber',
  CERRADA: 'bg-success/10 text-success dark:bg-success/15 dark:text-success',
}

const TH = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft'
const TD = 'px-3 py-3 align-top text-sm text-body dark:text-on-dark-soft'

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

interface ACTablaProps {
  items: AccionCorrectivaListadoItem[]
  pagination: ACListadoPagination | undefined
  filtros: ACListadoFiltros
  onChange: (filtros: ACListadoFiltros) => void
  rol: UserRole
}

export function ACTabla({ items, pagination, filtros, onChange, rol }: ACTablaProps) {
  const { t, i18n } = useTranslation('accionesCorrectivas')
  const navigate = useNavigate()
  const locale = i18n.language

  const destino = (ac: AccionCorrectivaListadoItem): string | null => {
    const ruta = rutaOrigenAC(ac.origenTipo, ac.origenId)
    return isRouteAllowedForRole(ruta.split('#')[0], rol) ? ruta : null
  }

  const ordenActual = filtros.orden ?? 'plazo'
  const ordenar = (orden: ACListadoOrden) =>
    onChange({
      ...filtros,
      orden,
      dir: ordenActual === orden && filtros.dir !== 'desc' ? 'desc' : undefined,
      page: 1,
    })

  const encabezadoOrdenable = (orden: ACListadoOrden, etiqueta: string) => {
    const activo = ordenActual === orden
    const desc = activo && filtros.dir === 'desc'
    return (
      <th className={TH} aria-sort={activo ? (desc ? 'descending' : 'ascending') : 'none'}>
        <button
          type="button"
          onClick={() => ordenar(orden)}
          className="inline-flex items-center gap-1 uppercase hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/40 dark:hover:text-on-dark"
        >
          {etiqueta}
          {activo &&
            (desc ? (
              <ArrowDown size={12} aria-label={t('orden.descendente')} />
            ) : (
              <ArrowUp size={12} aria-label={t('orden.ascendente')} />
            ))}
        </button>
      </th>
    )
  }

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-hairline bg-surface-card px-4 py-12 text-center text-sm text-muted dark:border-hairline/20 dark:bg-surface-dark-elevated dark:text-on-dark-soft">
        {t('vacio')}
      </p>
    )
  }

  const origenBadge = (ac: AccionCorrectivaListadoItem) => {
    const ruta = destino(ac)
    const contenido = (
      <>
        <span className={`rounded-xs px-1.5 py-0.5 text-[10px] font-semibold ${ORIGEN_BADGE[ac.origenTipo]}`}>
          {t(`origen.${ac.origenTipo}`)}
        </span>
        <span className="font-mono text-xs">{ac.origenNumero}</span>
      </>
    )
    return ruta ? (
      <Link
        to={ruta}
        onClick={(e) => e.stopPropagation()}
        aria-label={t('verOrigen', { numero: ac.origenNumero })}
        className="inline-flex items-center gap-1.5 text-ink hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/40 dark:text-on-dark"
      >
        {contenido}
      </Link>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-ink dark:text-on-dark" title={t('sinAcceso')}>
        {contenido}
      </span>
    )
  }

  const plazo = (ac: AccionCorrectivaListadoItem) => {
    const semaforo = textoPlazo(ac, t)
    return (
      <div className="flex flex-col">
        <span>{formatCalendarDate(ac.plazoFecha, locale)}</span>
        {semaforo && <span className={`text-xs font-medium ${semaforo.clase}`}>{semaforo.texto}</span>}
      </div>
    )
  }

  const estadoBadge = (ac: AccionCorrectivaListadoItem) => (
    <span className={`whitespace-nowrap rounded-pill px-2 py-0.5 text-xs font-medium ${ESTADO_BADGE[ac.estadoNormalizado]}`}>
      {t(`estado.${ac.estadoNormalizado}`)}
    </span>
  )

  const responsable = (ac: AccionCorrectivaListadoItem) => (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-cream text-xs font-medium text-body-strong dark:bg-surface-dark-soft dark:text-on-dark"
      >
        {iniciales(ac.responsableNombre)}
      </span>
      <span>{ac.responsableNombre}</span>
    </span>
  )

  const verificada = (ac: AccionCorrectivaListadoItem) =>
    ac.estadoNormalizado === 'CERRADA' && (ac.verificadaPorNombre || ac.fechaCierre) ? (
      <div className="flex flex-col">
        {ac.verificadaPorNombre && <span>{ac.verificadaPorNombre}</span>}
        {(ac.verificadaEn ?? ac.fechaCierre) && (
          <span className="text-xs text-muted dark:text-on-dark-soft">
            {formatShortDate(ac.verificadaEn ?? ac.fechaCierre ?? '', locale)}
          </span>
        )}
      </div>
    ) : null

  const irAlOrigen = (ac: AccionCorrectivaListadoItem) => {
    const ruta = destino(ac)
    if (ruta) navigate(ruta)
  }

  return (
    <div>
      {/* Escritorio: tabla */}
      <div className="hidden overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20 md:block">
        <table className="w-full min-w-[960px] border-collapse bg-canvas dark:bg-surface-dark">
          <thead className="bg-surface-soft dark:bg-surface-dark-soft">
            <tr>
              <th className={TH}>{t('columnas.origen')}</th>
              <th className={TH}>{t('columnas.descripcion')}</th>
              <th className={TH}>{t('columnas.tipo')}</th>
              <th className={TH}>{t('columnas.responsable')}</th>
              <th className={TH}>{t('columnas.area')}</th>
              {encabezadoOrdenable('plazo', t('columnas.plazo'))}
              {encabezadoOrdenable('estado', t('columnas.estado'))}
              <th className={TH}>{t('columnas.verificadaPor')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((ac) => {
              const clicable = destino(ac) !== null
              return (
                <tr
                  key={ac.id}
                  data-testid={`ac-row-${ac.id}`}
                  onClick={clicable ? () => irAlOrigen(ac) : undefined}
                  className={`border-t border-hairline dark:border-hairline/20 ${
                    clicable ? 'cursor-pointer hover:bg-surface-soft dark:hover:bg-surface-dark-soft' : ''
                  }`}
                >
                  <td className={TD}>{origenBadge(ac)}</td>
                  <td className={`${TD} max-w-xs`}>
                    <span className="line-clamp-2 text-ink dark:text-on-dark" title={ac.descripcion}>
                      {ac.descripcion}
                    </span>
                  </td>
                  <td className={TD}>{t(`tipo.${ac.tipo}`)}</td>
                  <td className={TD}>{responsable(ac)}</td>
                  <td className={TD}>{ac.areaNombre ?? ac.areaId}</td>
                  <td className={TD}>{plazo(ac)}</td>
                  <td className={TD}>{estadoBadge(ac)}</td>
                  <td className={TD}>{verificada(ac)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Móvil: tarjetas apiladas */}
      <ul className="flex flex-col gap-3 md:hidden">
        {items.map((ac) => (
          <li
            key={ac.id}
            onClick={destino(ac) ? () => irAlOrigen(ac) : undefined}
            className="rounded-lg border border-hairline bg-surface-card p-4 dark:border-hairline/20 dark:bg-surface-dark-elevated"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              {origenBadge(ac)}
              {estadoBadge(ac)}
            </div>
            <p className="mb-2 line-clamp-3 text-sm text-ink dark:text-on-dark" title={ac.descripcion}>
              {ac.descripcion}
            </p>
            <dl className="grid grid-cols-2 gap-2 text-xs text-body dark:text-on-dark-soft">
              <div>
                <dt className="text-muted dark:text-on-dark-soft">{t('columnas.responsable')}</dt>
                <dd>{ac.responsableNombre}</dd>
              </div>
              <div>
                <dt className="text-muted dark:text-on-dark-soft">{t('columnas.plazo')}</dt>
                <dd>{plazo(ac)}</dd>
              </div>
              <div>
                <dt className="text-muted dark:text-on-dark-soft">{t('columnas.tipo')}</dt>
                <dd>{t(`tipo.${ac.tipo}`)}</dd>
              </div>
              <div>
                <dt className="text-muted dark:text-on-dark-soft">{t('columnas.area')}</dt>
                <dd>{ac.areaNombre ?? ac.areaId}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      {pagination && (
        <div className="mt-4">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={(page) => onChange({ ...filtros, page })}
          />
        </div>
      )}
    </div>
  )
}
