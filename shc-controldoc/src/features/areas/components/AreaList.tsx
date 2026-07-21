import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { Pencil } from 'lucide-react'
import { useAreas, useDesactivarArea, useReactivarArea } from '../hooks/useAreas'
import { puedeAdministrarAreas } from '../permissions/areasPermissions'
import { useAuthStore } from '../../../stores/authStore'
import { Pagination } from '../../../components/shared/Pagination'
import { ConfirmarDesactivarAreaModal } from './ConfirmarDesactivarAreaModal'
import { ConfirmarReactivarAreaModal } from './ConfirmarReactivarAreaModal'
import { AreaBloqueoModal } from './AreaBloqueoModal'
import type { Area, AreaConteoBloqueo } from '../types/area.types'

interface AreaListProps {
  onEdit: (area: Area) => void
}

const PAGE_SIZE = 10

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0 dark:border-hairline/20">
      <div className="h-4 w-4 animate-pulse rounded bg-hairline dark:bg-surface-dark-soft" />
      <div className="h-4 w-48 animate-pulse rounded bg-hairline dark:bg-surface-dark-soft" />
    </div>
  )
}

function extractConteo(error: unknown): AreaConteoBloqueo | null {
  if (isAxiosError(error) && error.response?.status === 409) {
    return (error.response.data as { conteo?: AreaConteoBloqueo } | null)?.conteo ?? null
  }
  return null
}

export function AreaList({ onEdit }: AreaListProps) {
  const { t } = useTranslation('areas')
  const user = useAuthStore((s) => s.user)

  const { data: areas, isLoading } = useAreas()
  const desactivarArea = useDesactivarArea()
  const reactivarArea = useReactivarArea()

  const [pendingDesactivar, setPendingDesactivar] = useState<Area | null>(null)
  const [pendingReactivar, setPendingReactivar] = useState<Area | null>(null)
  const [bloqueo, setBloqueo] = useState<AreaConteoBloqueo | null>(null)
  const [page, setPage] = useState(1)

  const canAdminister = user ? puedeAdministrarAreas(user) : false

  const totalItems = areas?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return (areas ?? []).slice(start, start + PAGE_SIZE)
  }, [areas, page])

  const confirmDesactivar = () => {
    if (!pendingDesactivar) return
    desactivarArea.mutate(pendingDesactivar.id, {
      onError: (error) => {
        const conteo = extractConteo(error)
        if (conteo) setBloqueo(conteo)
      },
      onSettled: () => setPendingDesactivar(null),
    })
  }

  const confirmReactivar = () => {
    if (!pendingReactivar) return
    reactivarArea.mutate(pendingReactivar.id, {
      onSettled: () => setPendingReactivar(null),
    })
  }

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border border-hairline dark:border-hairline/20">
        {Array.from({ length: 4 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    )
  }

  const thClass =
    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft'

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-hairline dark:border-hairline/20">
        {!areas || areas.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('list.empty')}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark-soft">
              <tr>
                <th className={thClass}>{t('list.columns.nombre')}</th>
                <th className={thClass}>{t('list.columns.descripcion')}</th>
                <th className={thClass}>{t('list.columns.estado')}</th>
                {canAdminister && <th className={thClass}>{t('list.columns.acciones')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline dark:divide-hairline/20">
              {pageItems.map((area) => (
                <tr
                  key={area.id}
                  data-testid={`area-row-${area.id}`}
                  className="hover:bg-surface-soft dark:hover:bg-surface-dark-soft"
                >
                  <td className="px-4 py-3 text-ink dark:text-on-dark">{area.nombre}</td>
                  <td className="px-4 py-3 text-muted dark:text-on-dark-soft">
                    {area.descripcion ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        area.activo
                          ? 'inline-flex items-center rounded-pill bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success'
                          : 'inline-flex items-center rounded-pill bg-hairline px-2.5 py-0.5 text-xs font-medium text-muted dark:bg-surface-dark-soft dark:text-on-dark-soft'
                      }
                    >
                      {area.activo ? t('badges.activo') : t('badges.inactivo')}
                    </span>
                  </td>
                  {canAdminister && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onEdit(area)}
                          aria-label={t('actions.editar')}
                          className="text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
                        >
                          <Pencil size={16} />
                        </button>
                        {area.activo ? (
                          <button
                            type="button"
                            onClick={() => setPendingDesactivar(area)}
                            className="text-xs font-medium text-error hover:underline"
                          >
                            {t('actions.desactivar')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingReactivar(area)}
                            className="text-xs font-medium text-coral hover:underline"
                          >
                            {t('actions.reactivar')}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      {pendingDesactivar && (
        <ConfirmarDesactivarAreaModal
          nombre={pendingDesactivar.nombre}
          isPending={desactivarArea.isPending}
          onConfirm={confirmDesactivar}
          onClose={() => setPendingDesactivar(null)}
        />
      )}

      {pendingReactivar && (
        <ConfirmarReactivarAreaModal
          nombre={pendingReactivar.nombre}
          isPending={reactivarArea.isPending}
          onConfirm={confirmReactivar}
          onClose={() => setPendingReactivar(null)}
        />
      )}

      {bloqueo && <AreaBloqueoModal conteo={bloqueo} onClose={() => setBloqueo(null)} />}
    </div>
  )
}
