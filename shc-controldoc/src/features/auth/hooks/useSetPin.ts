import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { setPin } from '../api/auth.api'
import { useAuthStore } from '../../../stores/authStore'

export function useSetPin() {
  const { t } = useTranslation('users')
  const { t: tAuth } = useTranslation('auth')
  const setTienePinFirma = useAuthStore((s) => s.setTienePinFirma)

  return useMutation({
    mutationFn: (data: { password: string; pin: string }) => setPin(data),
    onSuccess: () => {
      setTienePinFirma(true)
      toast.success(t('profile.pinSection.success'))
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>
      if (axiosError.response?.status === 401) {
        // El llamador (ProfilePage) muestra este caso en el campo de contraseña actual,
        // no como toast — ver documents.signature para el mismo patrón.
        return
      }
      toast.error(axiosError.response?.data?.message ?? tAuth('errors.networkError'))
    },
  })
}
