import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getUserNames } from '../../../api/endpoints/users.api'

const STALE_TIME = 5 * 60_000 // los nombres cambian poco (nombres-usuarios-reales D3)

function normalizeIds(ids: (string | null | undefined)[]): string[] {
  const unique = new Set(ids.filter((id): id is string => !!id))
  return [...unique].sort()
}

/**
 * Resuelve nombres reales de usuario vía GET /api/users/nombres (user-names-lookup),
 * nunca vía el store mock. Agrupa todos los ids que necesita una pantalla en una sola
 * llamada — el caller es responsable de pasar el conjunto completo de ids de una vez
 * (ver D4: hoist al componente contenedor cuando varios hijos comparten ids).
 */
export function useUserNames(ids: (string | null | undefined)[]) {
  const { t } = useTranslation('common')
  const normalizedIds = normalizeIds(ids)

  const query = useQuery({
    queryKey: ['users', 'nombres', normalizedIds],
    queryFn: () => getUserNames(normalizedIds),
    enabled: normalizedIds.length > 0,
    staleTime: STALE_TIME,
  })

  function getName(id?: string | null): string {
    if (!id) return t('userNames.noDisponible')
    if (query.isLoading) return t('userNames.cargando')
    return query.data?.find((u) => u.id === id)?.nombreCompleto ?? t('userNames.noDisponible')
  }

  return { getName, isLoading: query.isLoading }
}
