import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { loginUser } from '../api/auth.api'
import { useAuthStore } from '../../../stores/authStore'
import type { LoginInput } from '../schemas/login.schema'

export function useLogin() {
  const navigate = useNavigate()
  const { t } = useTranslation('auth')

  return useMutation({
    mutationFn: (credentials: LoginInput) => loginUser(credentials),
    onSuccess: ({ user, accessToken }) => {
      useAuthStore.getState().login({ user, accessToken })
      navigate('/documentos')
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>
      toast.error(axiosError.response?.data?.message ?? t('errors.networkError'))
    },
  })
}
