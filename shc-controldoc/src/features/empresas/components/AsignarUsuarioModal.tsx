import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { SearchableSelect } from '../../../components/shared/SearchableSelect'
import { useUsers } from '../../users/hooks/useUsers'
import { useAsignarUsuarioEmpresa } from '../hooks/useUsuarioEmpresa'
import { useUsuarioEmpresaPorEmpresa } from '../hooks/useUsuarioEmpresa'
import type { UserRole } from '../../../types/auth.types'

interface AsignarUsuarioModalProps {
  empresaId: string
  onClose: () => void
}

// SUPERADMIN excluido a propósito — es un flag global, nunca un rol asignado
// vía UsuarioEmpresa (ver empresa-admin-types / empresa-admin-schemas).
const ROLE_VALUES: UserRole[] = [
  'OPERARIO',
  'SUPERVISOR',
  'JEFE_CALIDAD_SYST',
  'JEFE_CONTROL_DOCUMENTARIO',
  'AUDITOR_INTERNO',
  'ALTA_DIRECCION',
  'ADMINISTRADOR_SISTEMA',
  'ADMINISTRADOR_EMPRESA',
]

export function AsignarUsuarioModal({ empresaId, onClose }: AsignarUsuarioModalProps) {
  const { t } = useTranslation('empresas')
  const { t: tAuth } = useTranslation('auth')
  const { data: usuarios = [] } = useUsers()
  const { data: asignacionesExistentes = [] } = useUsuarioEmpresaPorEmpresa(empresaId)
  const asignarMutation = useAsignarUsuarioEmpresa(empresaId)

  const [usuarioId, setUsuarioId] = useState<string | undefined>(undefined)
  const [rol, setRol] = useState<Exclude<UserRole, 'SUPERADMIN'>>('OPERARIO')

  const opciones = usuarios.map((u) => ({ id: u.id, label: `${u.nombre} ${u.apellido}`, sublabel: u.email }))

  const asignacionExistente = asignacionesExistentes.find((a) => a.usuarioId === usuarioId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!usuarioId) return
    asignarMutation.mutate({ usuarioId, rol }, { onSuccess: onClose })
  }

  const inputClass =
    'w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-sm text-ink h-10 focus:outline-none focus:ring-2 focus:ring-coral focus:border-coral dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const labelClass = 'mb-1 block text-sm font-medium text-body dark:text-on-dark-soft'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4 dark:bg-black/60">
      <div className="relative w-full max-w-lg rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('form.actions.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>

        <h2 className="mb-4 font-medium text-ink dark:text-on-dark">{t('asignacion.modal.titulo')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="usuarioId" className={labelClass}>
              {t('asignacion.modal.usuario')} <span className="text-error">*</span>
            </label>
            <SearchableSelect
              id="usuarioId"
              options={opciones}
              value={usuarioId}
              onChange={setUsuarioId}
              ariaLabel={t('asignacion.modal.usuario')}
              placeholder={t('asignacion.modal.buscarUsuario')}
            />
          </div>

          {asignacionExistente && (
            <p className="rounded-md bg-amber/10 px-3 py-2 text-xs text-amber">
              {asignacionExistente.estado === 'INACTIVO'
                ? t('asignacion.modal.avisoReactivar')
                : t('asignacion.modal.avisoYaAsignado')}
            </p>
          )}

          <div>
            <label htmlFor="rol" className={labelClass}>
              {t('asignacion.modal.rol')}
            </label>
            <select
              id="rol"
              className={inputClass}
              value={rol}
              onChange={(e) => setRol(e.target.value as Exclude<UserRole, 'SUPERADMIN'>)}
            >
              {ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {tAuth(`roles.${r}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-hairline bg-canvas px-5 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft"
            >
              {t('form.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={!usuarioId || asignarMutation.isPending}
              className="rounded-md bg-coral px-5 py-2.5 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
            >
              {asignarMutation.isPending ? t('form.actions.submitting') : t('asignacion.modal.confirmar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
