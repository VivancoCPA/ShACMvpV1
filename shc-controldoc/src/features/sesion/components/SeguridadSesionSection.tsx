import { useTranslation } from 'react-i18next'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { useAuthStore } from '../../../stores/authStore'
import { SeguridadSesionForm } from './SeguridadSesionForm'

/** Sección "Seguridad de sesión" de la empresa activa — ADMINISTRADOR_EMPRESA en /usuarios, donde
 *  ya gestiona su empresa y sus usuarios. No renderiza nada para otros roles. */
export function SeguridadSesionSection() {
  const { t } = useTranslation('sesion')
  const rol = useAuthStore((s) => s.user?.rol)
  const empresaActivaId = useAuthStore((s) => s.empresaActivaId)

  if (rol !== 'ADMINISTRADOR_EMPRESA' || !empresaActivaId) return null

  return (
    <section
      aria-labelledby="seguridad-sesion-title"
      className="mt-8 max-w-2xl rounded-lg bg-surface-card p-6 dark:bg-surface-dark-elevated"
    >
      <h2 id="seguridad-sesion-title" className="font-medium text-ink dark:text-on-dark">
        {t('config.title')}
      </h2>
      <p className="mb-5 mt-1 text-sm text-body dark:text-on-dark-soft">{t('config.description')}</p>
      <ErrorBoundary>
        <SeguridadSesionForm empresaId={empresaActivaId} />
      </ErrorBoundary>
    </section>
  )
}
