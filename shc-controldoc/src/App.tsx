import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { router } from './router'
import { useAuthStore } from './stores/authStore'

export default function App() {
  const { t } = useTranslation('common')
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping)

  // One-time imperative bootstrap: attempt to silently restore the session
  // from the httpOnly refresh cookie before any route (and RoleGuard) sees
  // isAuthenticated. Without this gate, every full-page navigation (reload,
  // typed URL, new tab) briefly — and then permanently, since nothing
  // retries — reports the user as logged out.
  useEffect(() => {
    useAuthStore.getState().bootstrap()
  }, [])

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas dark:bg-surface-dark">
        <div className="flex items-center gap-2 text-sm text-muted dark:text-on-dark-soft">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          <span>{t('session.restoring')}</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </>
  )
}
