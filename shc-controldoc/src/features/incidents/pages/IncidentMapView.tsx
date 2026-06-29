import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLocales } from '../hooks/useLocales'
import { useIncidentList } from '../hooks/useIncidentList'
import { IncidentMapCanvas } from '../components/IncidentMapCanvas'
import { IncidentMapSidePanel } from '../components/IncidentMapSidePanel'
import type { MarkerGroup } from '../components/IncidentMapCanvas'

export function IncidentMapView() {
  const { t } = useTranslation('incidents')
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedGroup, setSelectedGroup] = useState<MarkerGroup | null>(null)

  const { locales, isLoading: localesLoading } = useLocales()
  const activeLocales = locales.filter((l) => l.activo)

  const mapLocalParam = searchParams.get('mapLocal')
  const selectedLocalId = mapLocalParam ?? activeLocales[0]?.id ?? ''
  const selectedLocal = activeLocales.find((l) => l.id === selectedLocalId)

  const { incidentes } = useIncidentList()

  function handleLocalChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('mapLocal', e.target.value)
      return next
    })
    setSelectedGroup(null)
  }

  if (localesLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-hairline border-t-coral" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Local selector */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="map-local-select"
          className="text-sm font-medium text-ink dark:text-on-dark"
        >
          {t('map.localSelector.label')}
        </label>
        <select
          id="map-local-select"
          value={selectedLocalId}
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

      {/* Canvas + side panel */}
      <div className="relative flex min-h-[500px] gap-0">
        <div className="flex flex-1">
          <IncidentMapCanvas
            incidentes={incidentes}
            localId={selectedLocalId}
            planoPngUrl={selectedLocal?.planoPngUrl}
            onGroupClick={(group) => setSelectedGroup(group)}
          />
        </div>

        {/* Side panel — fixed width on desktop, overlay on mobile */}
        {selectedGroup !== null && (
          <div className="absolute right-0 top-0 z-20 h-full sm:relative sm:z-auto">
            <IncidentMapSidePanel
              group={selectedGroup}
              onClose={() => setSelectedGroup(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
