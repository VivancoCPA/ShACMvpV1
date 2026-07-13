import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { changePassword } from '../api/auth.api'

export function useChangePassword() {
  const { t } = useTranslation('users')
  const { t: tAuth } = useTranslation('auth')

  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => changePassword(data),
    onSuccess: () => {
      toast.success(t('changePassword.success'))
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>
      if (axiosError.response?.status === 401) {
        toast.error(t('changePassword.errors.incorrectCurrentPassword'))
        return
      }
      toast.error(axiosError.response?.data?.message ?? tAuth('errors.networkError'))
    },
  })
}
