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

  // detalle-documento-dos-columnas (D3/D5): expone nombre/apellido/avatarUrl para la ficha de
  // responsables (UserAvatar necesita nombre+apellido para las iniciales). Devuelve `undefined`
  // cuando el id está ausente o aún no se resolvió — el caller decide el fallback ("Sin
  // asignar" vs. estado de carga), igual que ya hace con `getName`.
  function getUser(id?: string | null): { nombre: string; apellido: string; avatarUrl?: string } | undefined {
    if (!id) return undefined
    const match = query.data?.find((u) => u.id === id)
    if (!match?.nombre || !match.apellido) return undefined
    return { nombre: match.nombre, apellido: match.apellido, avatarUrl: match.avatarUrl }
  }

  return { getName, getUser, isLoading: query.isLoading }
}
