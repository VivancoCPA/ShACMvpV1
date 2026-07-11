import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useLocales } from '../../incidents/hooks/useLocales'
import { useIncidentList } from '../../incidents/hooks/useIncidentList'
import { IncidentMapCanvas } from '../../incidents/components/IncidentMapCanvas'

const RANGOS = [3, 6, 12] as const
type Rango = (typeof RANGOS)[number]

export function HeatmapIncidentesWidget() {
  const { t } = useTranslation('dashboard')
  const { locales, isLoading: localesLoading } = useLocales()
  const { incidentes, isLoading: incidentesLoading } = useIncidentList()

  const [selectedLocalId, setSelectedLocalId] = useState<string | null>(null)
  const [rango, setRango] = useState<Rango>(6)

  const activeLocales = locales.filter((l) => l.activo)
  const effectiveLocalId = selectedLocalId ?? activeLocales[0]?.id ?? ''
  const selectedLocal = activeLocales.find((l) => l.id === effectiveLocalId)

  const incidentesEnPeriodo = useMemo(() => {
    const desde = new Date()
    desde.setMonth(desde.getMonth() - rango)
    const desdeMs = desde.getTime()
    return incidentes.filter((inc) => new Date(inc.fechaEvento).getTime() >= desdeMs)
  }, [incidentes, rango])

  const sinUbicacionCount = useMemo(
    () => incidentesEnPeriodo.filter((inc) => !inc.ubicacion).length,
    [incidentesEnPeriodo],
  )

  function handleLocalChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedLocalId(e.target.value)
  }

  if (localesLoading || incidentesLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-hairline border-t-coral dark:border-hairline/20" />
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
          {t('heatmapIncidentes.title')}
        </h2>
        <div
          role="group"
          aria-label={t('heatmapIncidentes.rango.label')}
          className="flex gap-1.5"
        >
          {RANGOS.map((r) => (
            <button
              key={r}
              type="button"
              aria-label={t(`heatmapIncidentes.rango.opciones.${r}`)}
              aria-pressed={rango === r}
              onClick={() => setRango(r)}
              className={clsx(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                rango === r
                  ? 'bg-coral text-white'
                  : 'border border-hairline bg-canvas text-body hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:bg-surface-dark-elevated',
              )}
            >
              {t(`heatmapIncidentes.rango.opciones.${r}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label
          htmlFor="heatmap-local-select"
          className="text-sm font-medium text-ink dark:text-on-dark"
        >
          {t('heatmapIncidentes.localSelector.label')}
        </label>
        <select
          id="heatmap-local-select"
          value={effectiveLocalId}
          onChange={handleLocalChange}
          className="h-9 rounded-md border border-hairline bg-canvas px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark"
        >
          {activeLocales.map((local) => (
            <option key={local.id} value={local.id}>
              {local.nombre}
            </option>
          ))}
        </select>
      </div>

      {sinUbicacionCount > 0 && (
        <p className="rounded-md bg-surface-soft px-3 py-2 text-xs text-muted dark:bg-surface-dark-soft dark:text-on-dark-soft">
          {t('heatmapIncidentes.sinUbicacion', { count: sinUbicacionCount })}
        </p>
      )}

      <div className="flex min-h-[500px]">
        <IncidentMapCanvas
          incidentes={incidentesEnPeriodo}
          localId={effectiveLocalId}
          planoPngUrl={selectedLocal?.planoPngUrl}
          onGroupClick={() => {}}
        />
      </div>
    </section>
  )
}
