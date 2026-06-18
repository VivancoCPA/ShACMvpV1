import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { resetPassword } from '../api/auth.api'

export function useResetPassword() {
  const navigate = useNavigate()
  const { t } = useTranslation('auth')

  return useMutation({
    mutationFn: (data: { token: string; password: string }) => resetPassword(data),
    onSuccess: () => {
      toast.success(t('resetPassword.title'))
      navigate('/login')
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>
      toast.error(axiosError.response?.data?.message ?? t('errors.networkError'))
    },
  })
}
