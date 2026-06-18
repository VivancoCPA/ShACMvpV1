import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { forgotPassword } from '../api/auth.api'
import type { ForgotPasswordInput } from '../schemas/forgotPassword.schema'

export function useForgotPassword() {
  const { t } = useTranslation('auth')

  return useMutation({
    mutationFn: (data: ForgotPasswordInput) => forgotPassword(data),
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>
      toast.error(axiosError.response?.data?.message ?? t('errors.networkError'))
    },
  })
}
