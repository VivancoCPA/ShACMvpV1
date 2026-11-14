import { useTranslation } from 'react-i18next'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { useAuthStore } from '../../../stores/authStore'
import { ResponsablesAcForm } from './ResponsablesAcForm'

/** Sección "Responsables de acciones correctivas" de la empresa activa — ADMINISTRADOR_EMPRESA en
 *  /usuarios, junto a "Seguridad de sesión". No renderiza nada para otros roles. */
export function ResponsablesAcSection() {
  const { t } = useTranslation('users')
  const rol = useAuthStore((s) => s.user?.rol)
  const empresaActivaId = useAuthStore((s) => s.empresaActivaId)

  if (rol !== 'ADMINISTRADOR_EMPRESA' || !empresaActivaId) return null

  return (
    <section
      aria-labelledby="responsables-ac-title"
      className="mt-8 max-w-4xl rounded-lg bg-surface-card p-6 dark:bg-surface-dark-elevated"
    >
      <h2 id="responsables-ac-title" className="font-medium text-ink dark:text-on-dark">
        {t('responsablesAc.title')}
      </h2>
      <p className="mb-5 mt-1 text-sm text-body dark:text-on-dark-soft">{t('responsablesAc.descripcion')}</p>
      <ErrorBoundary>
        <ResponsablesAcForm empresaId={empresaActivaId} />
      </ErrorBoundary>
    </section>
  )
}
