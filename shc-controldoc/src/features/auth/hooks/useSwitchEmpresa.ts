import { useMutation } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { switchEmpresa } from '../api/auth.api'
import { useAuthStore } from '../../../stores/authStore'
import { queryClient } from '../../../lib/queryClient'
import { getDefaultRouteForRole } from '../../../router/getDefaultRoute'
import { isRouteAllowedForRole } from '../../../router/routeAccess'

/**
 * Cambia la empresa activa de la sesión sin re-login. Limpia por completo el
 * caché de TanStack Query (empresa-session, D8) y, si la ruta actual no está
 * permitida para el rol resuelto en la nueva empresa, redirige al destino
 * por defecto de ese rol (D9) — de lo contrario permanece donde estaba.
 */
export function useSwitchEmpresa() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation('nav')

  return useMutation({
    mutationFn: (empresaId: string) => switchEmpresa(empresaId),
    onSuccess: ({ user, accessToken, empresaActivaId, empresasDisponibles }) => {
      useAuthStore.getState().switchEmpresa({ user, accessToken, empresaActivaId, empresasDisponibles })
      queryClient.clear()
      if (!isRouteAllowedForRole(location.pathname, user.rol)) {
        navigate(getDefaultRouteForRole(user.rol), { replace: true })
      }
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>
      toast.error(axiosError.response?.data?.message ?? t('empresaSwitcher.switchError'))
    },
  })
}
