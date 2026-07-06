import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { Plus } from 'lucide-react'
import {
  useLocales,
  useZonas,
  useDesactivarLocal,
  useReactivarLocal,
  useDesactivarZona,
  useReactivarZona,
} from '../hooks/useLocales'
import { useIncidents } from '../../incidents/hooks/useIncidents'
import { puedeAdministrarLocales } from '../permissions/localesPermissions'
import { puedeDesactivarZona } from '../utils/localesBusinessRules'
import { useAuthStore } from '../../../stores/authStore'
import { LocalRow } from './LocalRow'
import { ConfirmarDesactivarModal } from './ConfirmarDesactivarModal'
import { ConfirmarReactivarModal } from './ConfirmarReactivarModal'
import { BloqueoIncidentesModal } from './BloqueoIncidentesModal'
import type { Local, Zona } from '../../incidents/types/incident.types'

const MAX_LOCALES_ACTIVOS = 5

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0 dark:border-hairline/20">
      <div className="h-4 w-4 animate-pulse rounded bg-hairline dark:bg-surface-dark-soft" />
      <div className="h-4 w-48 animate-pulse rounded bg-hairline dark:bg-surface-dark-soft" />
    </div>
  )
}

interface PendingAccion {
  tipo: 'local' | 'zona'
  id: string
  nombre: string
}

interface Bloqueo {
  tipo: 'local' | 'zona'
  mensaje: string
}

function extractErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    return (error.response?.data as { message?: string } | null)?.message ?? ''
  }
  return ''
}

export function LocalList() {
  const { t } = useTranslation('locations')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data: locales, isLoading } = useLocales()
  const { data: zonas } = useZonas()
  const { data: incidentsData } = useIncidents({ pageSize: 500 })

  const desactivarLocal = useDesactivarLocal()
  const reactivarLocal = useReactivarLocal()
  const desactivarZona = useDesactivarZona()
  const reactivarZona = useReactivarZona()

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [pendingDesactivar, setPendingDesactivar] = useState<PendingAccion | null>(null)
  const [pendingReactivar, setPendingReactivar] = useState<PendingAccion | null>(null)
  const [bloqueo, setBloqueo] = useState<Bloqueo | null>(null)

  const canAdminister = user ? puedeAdministrarLocales(user) : false

  const zonasPorLocal = useMemo(() => {
    const map = new Map<string, Zona[]>()
    for (const zona of zonas ?? []) {
      const list = map.get(zona.localId) ?? []
      list.push(zona)
      map.set(zona.localId, list)
    }
    return map
  }, [zonas])

  const incidentesBloqueantesPorZona = useMemo(() => {
    const incidentes = incidentsData?.items ?? []
    const result: Record<string, number> = {}
    for (const zona of zonas ?? []) {
      result[zona.id] = puedeDesactivarZona(zona, incidentes).incidentesBloqueantes
    }
    return result
  }, [zonas, incidentsData])

  const localesActivos = (locales ?? []).filter((l) => l.activo).length

  const toggleExpand = (localId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(localId)) next.delete(localId)
      else next.add(localId)
      return next
    })
  }

  const handleEditarLocal = (local: Local) => navigate(`/admin/locales/${local.id}/editar`)
  const handleEditarZona = (zona: Zona) =>
    navigate(`/admin/locales/${zona.localId}/zonas/${zona.id}/editar`)
  const handleNuevaZona = (localId: string) => navigate(`/admin/locales/${localId}/zonas/new`)

  const handleDesactivarLocal = (local: Local) =>
    setPendingDesactivar({ tipo: 'local', id: local.id, nombre: local.nombre })
  const handleDesactivarZona = (zona: Zona) =>
    setPendingDesactivar({ tipo: 'zona', id: zona.id, nombre: zona.nombre })

  const handleReactivarLocal = (local: Local) =>
    setPendingReactivar({ tipo: 'local', id: local.id, nombre: local.nombre })
  const handleReactivarZona = (zona: Zona) =>
    setPendingReactivar({ tipo: 'zona', id: zona.id, nombre: zona.nombre })

  const confirmDesactivar = () => {
    if (!pendingDesactivar) return
    const { tipo, id } = pendingDesactivar

    const options = {
      onError: (error: unknown) => {
        if (isAxiosError(error) && error.response?.status === 409) {
          setBloqueo({ tipo, mensaje: extractErrorMessage(error) })
        }
      },
      onSettled: () => setPendingDesactivar(null),
    }

    if (tipo === 'local') {
      desactivarLocal.mutate(id, options)
    } else {
      desactivarZona.mutate(id, options)
    }
  }

  const confirmReactivar = () => {
    if (!pendingReactivar) return
    const { tipo, id } = pendingReactivar

    const options = { onSettled: () => setPendingReactivar(null) }

    if (tipo === 'local') {
      reactivarLocal.mutate(id, options)
    } else {
      reactivarZona.mutate(id, options)
    }
  }

  const isPendingDesactivar =
    pendingDesactivar?.tipo === 'local' ? desactivarLocal.isPending : desactivarZona.isPending
  const isPendingReactivar =
    pendingReactivar?.tipo === 'local' ? reactivarLocal.isPending : reactivarZona.isPending

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border border-hairline dark:border-hairline/20">
        {Array.from({ length: 4 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted dark:text-on-dark-soft">
          {t('header.localesActivos', { activos: localesActivos, total: MAX_LOCALES_ACTIVOS })}
        </p>
        {canAdminister && (
          <button
            type="button"
            onClick={() => navigate('/admin/locales/new')}
            className="inline-flex items-center gap-1.5 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
          >
            <Plus size={14} aria-hidden="true" />
            {t('header.nuevoLocal')}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-hairline dark:border-hairline/20">
        {!locales || locales.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('list.empty')}
          </div>
        ) : (
          locales.map((local) => (
            <LocalRow
              key={local.id}
              local={local}
              zonas={zonasPorLocal.get(local.id) ?? []}
              expanded={expandedIds.has(local.id)}
              onToggleExpand={toggleExpand}
              canAdminister={canAdminister}
              incidentesBloqueantesPorZona={incidentesBloqueantesPorZona}
              onEditarLocal={handleEditarLocal}
              onDesactivarLocal={handleDesactivarLocal}
              onReactivarLocal={handleReactivarLocal}
              onEditarZona={handleEditarZona}
              onDesactivarZona={handleDesactivarZona}
              onReactivarZona={handleReactivarZona}
              onNuevaZona={handleNuevaZona}
            />
          ))
        )}
      </div>

      {pendingDesactivar && (
        <ConfirmarDesactivarModal
          tipo={pendingDesactivar.tipo}
          nombre={pendingDesactivar.nombre}
          isPending={isPendingDesactivar}
          onConfirm={confirmDesactivar}
          onClose={() => setPendingDesactivar(null)}
        />
      )}

      {pendingReactivar && (
        <ConfirmarReactivarModal
          tipo={pendingReactivar.tipo}
          nombre={pendingReactivar.nombre}
          isPending={isPendingReactivar}
          onConfirm={confirmReactivar}
          onClose={() => setPendingReactivar(null)}
        />
      )}

      {bloqueo && (
        <BloqueoIncidentesModal
          tipo={bloqueo.tipo}
          mensaje={bloqueo.mensaje}
          onClose={() => setBloqueo(null)}
        />
      )}
    </div>
  )
}
