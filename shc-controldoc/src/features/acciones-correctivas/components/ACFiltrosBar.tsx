import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterBar } from '../../../components/shared/FilterBar'
import { SearchableSelect } from '../../../components/shared/SearchableSelect'
import { useAreas } from '../../areas/hooks/useAreas'
import { useCandidatosUsuarios } from '../../users/hooks/useCandidatosUsuarios'
import { AC_TIPOS, ROLES_OPERATIVOS } from '../../../constants/accionCorrectivaTipo.constants'
import {
  AC_ESTADOS_NORMALIZADOS,
  AC_ORIGEN_TIPOS,
  type ACEstadoNormalizado,
  type ACListadoFiltros,
} from '../types/accionesCorrectivasListado.types'
import type { User } from '../../../types/auth.types'

const LABEL = 'text-xs font-medium text-muted dark:text-on-dark-soft'
const INPUT =
  'h-9 rounded-md border border-hairline bg-canvas px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:placeholder:text-on-dark-soft'

interface ACFiltrosBarProps {
  filtros: ACListadoFiltros
  onChange: (filtros: ACListadoFiltros) => void
  user: User
}

const FILTROS_LIMPIABLES: (keyof ACListadoFiltros)[] = [
  'estado',
  'vencida',
  'porVencer',
  'tipo',
  'origenTipo',
  'responsableId',
  'areaId',
  'plazoDesde',
  'plazoHasta',
  'creadaDesde',
  'creadaHasta',
  'cerradaDesde',
  'cerradaHasta',
  'search',
]

export function ACFiltrosBar({ filtros, onChange, user }: ACFiltrosBarProps) {
  const { t } = useTranslation('accionesCorrectivas')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const esOperario = user.rol === 'OPERARIO'
  const esSupervisor = user.rol === 'SUPERVISOR'

  const { data: areas = [] } = useAreas()
  const opcionesArea = useMemo(() => {
    const activas = areas.filter((a) => a.activo)
    return esSupervisor ? activas.filter((a) => (user.areaIds ?? []).includes(a.id)) : activas
  }, [areas, esSupervisor, user.areaIds])

  // El OPERARIO solo ve sus AC: no hay filtro de responsable (ni se piden candidatos).
  const { data: candidatos = [] } = useCandidatosUsuarios(esOperario ? [] : ROLES_OPERATIVOS)
  const opcionesResponsable = useMemo(
    () => candidatos.map((c) => ({ id: c.id, label: c.nombreCompleto })),
    [candidatos],
  )

  const set = (cambio: Partial<ACListadoFiltros>) => onChange({ ...filtros, ...cambio, page: 1 })

  const onSearch = (valor: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => set({ search: valor.trim() || undefined }), 300)
  }

  const toggleEstado = (estado: ACEstadoNormalizado) => {
    const actuales = filtros.estado ?? []
    const siguientes = actuales.includes(estado) ? actuales.filter((e) => e !== estado) : [...actuales, estado]
    set({ estado: siguientes.length > 0 ? siguientes : undefined })
  }

  const hayFiltros = FILTROS_LIMPIABLES.some((k) => filtros[k] !== undefined)

  return (
    <FilterBar>
      <div className="flex flex-col gap-1">
        <label className={LABEL} htmlFor="ac-search">
          {t('filtros.buscar')}
        </label>
        <input
          id="ac-search"
          type="search"
          className={`${INPUT} w-60`}
          placeholder={t('filtros.buscarPlaceholder')}
          defaultValue={filtros.search ?? ''}
          key={filtros.search ?? ''}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className={`${LABEL} mb-1`}>{t('filtros.estado')}</legend>
        <div className="flex flex-wrap gap-1">
          {AC_ESTADOS_NORMALIZADOS.map((estado) => {
            const activo = filtros.estado?.includes(estado) ?? false
            return (
              <button
                key={estado}
                type="button"
                aria-pressed={activo}
                onClick={() => toggleEstado(estado)}
                className={`h-9 rounded-md border px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/40 ${
                  activo
                    ? 'border-coral bg-coral/10 text-coral-dark dark:border-coral dark:bg-coral/20 dark:text-coral'
                    : 'border-hairline bg-canvas text-body hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:bg-surface-dark-soft'
                }`}
              >
                {t(`estado.${estado}`)}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label className={LABEL} htmlFor="ac-tipo">
          {t('filtros.tipo')}
        </label>
        <select
          id="ac-tipo"
          className={`${INPUT} w-36`}
          value={filtros.tipo ?? ''}
          onChange={(e) => set({ tipo: AC_TIPOS.find((x) => x === e.target.value) })}
        >
          <option value="">{t('filtros.todos')}</option>
          {AC_TIPOS.map((tipo) => (
            <option key={tipo} value={tipo}>
              {t(`tipo.${tipo}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL} htmlFor="ac-origen">
          {t('filtros.origen')}
        </label>
        <select
          id="ac-origen"
          className={`${INPUT} w-40`}
          value={filtros.origenTipo ?? ''}
          onChange={(e) => set({ origenTipo: AC_ORIGEN_TIPOS.find((x) => x === e.target.value) })}
        >
          <option value="">{t('filtros.todos')}</option>
          {AC_ORIGEN_TIPOS.map((o) => (
            <option key={o} value={o}>
              {t(`origen.nombre.${o}`)}
            </option>
          ))}
        </select>
      </div>

      {!esOperario && (
        <div className="flex w-56 flex-col gap-1">
          <label className={LABEL} htmlFor="ac-responsable">
            {t('filtros.responsable')}
          </label>
          <SearchableSelect
            id="ac-responsable"
            ariaLabel={t('filtros.responsable')}
            options={opcionesResponsable}
            value={filtros.responsableId}
            onChange={(id) => set({ responsableId: id })}
            placeholder={t('filtros.todos')}
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className={LABEL} htmlFor="ac-area">
          {t('filtros.area')}
        </label>
        <select
          id="ac-area"
          className={`${INPUT} w-44`}
          value={filtros.areaId ?? ''}
          onChange={(e) => set({ areaId: e.target.value || undefined })}
        >
          <option value="">{t('filtros.todas')}</option>
          {opcionesArea.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </div>

      {(
        [
          ['plazoDesde', 'filtros.plazoDesde'],
          ['plazoHasta', 'filtros.plazoHasta'],
          ['creadaDesde', 'filtros.creadaDesde'],
          ['creadaHasta', 'filtros.creadaHasta'],
        ] as const
      ).map(([clave, etiqueta]) => (
        <div key={clave} className="flex flex-col gap-1">
          <label className={LABEL} htmlFor={`ac-${clave}`}>
            {t(etiqueta)}
          </label>
          <input
            id={`ac-${clave}`}
            type="date"
            className={`${INPUT} w-40`}
            value={filtros[clave] ?? ''}
            onChange={(e) => set({ [clave]: e.target.value || undefined })}
          />
        </div>
      ))}

      {hayFiltros && (
        <button
          type="button"
          onClick={() => onChange({ page: 1, orden: filtros.orden, dir: filtros.dir, pageSize: filtros.pageSize })}
          className="h-9 rounded-md border border-hairline bg-canvas px-3 text-sm text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
        >
          {t('filtros.limpiar')}
        </button>
      )}
    </FilterBar>
  )
}
