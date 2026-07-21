import { useMutation } from '@tanstack/react-query'
import { useNavigate, type Location } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { loginUser } from '../api/auth.api'
import { useAuthStore } from '../../../stores/authStore'
import { getDefaultRouteForRole } from '../../../router/getDefaultRoute'
import { isRouteAllowedForRole } from '../../../router/routeAccess'
import type { LoginInput } from '../schemas/login.schema'

/**
 * `from` es la ubicación original de un deep link no autenticado (ver
 * RoleGuard), capturada por LoginPage vía `location.state?.from`. Si está
 * presente Y el rol recién autenticado tiene permiso RBAC sobre ese destino,
 * el login exitoso navega ahí en vez del default por rol. Un `from` ajeno al
 * rol (deep link intentado por otro usuario en la misma pestaña) se ignora
 * en favor del default — nunca se manda a /no-autorizado, ya que el usuario
 * no eligió ese destino a propósito.
 */
export function useLogin(from?: Location) {
  const navigate = useNavigate()
  const { t } = useTranslation('auth')

  return useMutation({
    mutationFn: (credentials: LoginInput) => loginUser(credentials),
    onSuccess: ({ user, accessToken, mockRefreshToken }) => {
      useAuthStore.getState().login({ user, accessToken, mockRefreshToken })
      const target =
        from && isRouteAllowedForRole(from.pathname, user.rol)
          ? `${from.pathname}${from.search}`
          : getDefaultRouteForRole(user.rol)
      navigate(target, { replace: true })
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>
      toast.error(axiosError.response?.data?.message ?? t('errors.networkError'))
    },
  })
}
