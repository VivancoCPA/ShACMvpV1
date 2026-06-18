import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { logoutUser } from '../api/auth.api'
import { useAuthStore } from '../../../stores/authStore'

export function useLogout() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: logoutUser,
    onSettled: () => {
      useAuthStore.getState().logout()
      navigate('/login')
    },
  })
}
