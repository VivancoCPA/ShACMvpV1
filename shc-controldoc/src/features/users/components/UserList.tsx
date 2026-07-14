import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Ban, RotateCcw, KeyRound, X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useUsers, useToggleUserActive, useResetUserPassword } from '../hooks/useUsers'
import { useAuthStore } from '../../../stores/authStore'
import { FilterBar } from '../../../components/shared/FilterBar'
import { Pagination } from '../../../components/shared/Pagination'
import { UserAvatar } from '../../../components/ui/UserAvatar'
import { ROLE_BG_CLASSES } from '../../../components/ui/roleColors'
import { UserFormModal } from './UserFormModal'
import { TemporaryPasswordModal } from './TemporaryPasswordModal'
import { formatDateTime } from '../../../utils/date.utils'
import type { User, UserRole } from '../../../types/auth.types'

const PAGE_SIZE = 10
const COLUMN_COUNT = 6

const ROLE_VALUES: UserRole[] = [
  'OPERARIO',
  'SUPERVISOR',
  'JEFE_CALIDAD_SYST',
  'JEFE_CONTROL_DOCUMENTARIO',
  'AUDITOR_INTERNO',
  'ALTA_DIRECCION',
  'ADMINISTRADOR_SISTEMA',
]

type EstadoFilter = 'TODOS' | 'ACTIVOS' | 'INACTIVOS'

interface ConfirmToggleModalProps {
  user: User
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}

function ConfirmToggleModal({ user, isPending, onConfirm, onClose }: ConfirmToggleModalProps) {
  const { t } = useTranslation('users')
  const nombre = `${user.nombre} ${user.apellido}`
  const isBaja = user.activo
  const titulo = isBaja ? t('list.confirmarBaja.titulo') : t('list.confirmarReactivar.titulo')
  const mensaje = isBaja
    ? t('list.confirmarBaja.mensaje', { nombre })
    : t('list.confirmarReactivar.mensaje', { nombre })
  const cancelar = isBaja ? t('list.confirmarBaja.cancelar') : t('list.confirmarReactivar.cancelar')
  const confirmar = isBaja ? t('list.confirmarBaja.confirmar') : t('list.confirmarReactivar.confirmar')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={cancelar}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-error" />
          <div>
            <h2 className="font-medium text-ink dark:text-on-dark">{titulo}</h2>
            <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">{mensaje}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft disabled:opacity-60"
          >
            {cancelar}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
              isBaja ? 'bg-error hover:bg-error/80' : 'bg-coral hover:bg-coral-dark'
            }`}
          >
            {confirmar}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ConfirmResetModalProps {
  user: User
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}

function ConfirmResetModal({ user, isPending, onConfirm, onClose }: ConfirmResetModalProps) {
  const { t } = useTranslation('users')
  const nombre = `${user.nombre} ${user.apellido}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('list.confirmarReset.cancelar')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-error" />
          <div>
            <h2 className="font-medium text-ink dark:text-on-dark">{t('list.confirmarReset.titulo')}</h2>
            <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">
              {t('list.confirmarReset.mensaje', { nombre })}
            </p>
            <p className="mt-2 text-xs text-muted dark:text-on-dark-soft">
              {t('list.confirmarReset.ayuda')}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft disabled:opacity-60"
          >
            {t('list.confirmarReset.cancelar')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
          >
            {t('list.confirmarReset.confirmar')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function UserList() {
  const { t, i18n } = useTranslation('users')
  const authUser = useAuthStore((s) => s.user)
  const canAdminister = authUser?.rol === 'ADMINISTRADOR_SISTEMA'

  const [rolFilter, setRolFilter] = useState<UserRole | ''>('')
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('TODOS')
  const [page, setPage] = useState(1)
  const [formUser, setFormUser] = useState<User | null | undefined>(undefined)
  const [pendingToggle, setPendingToggle] = useState<User | null>(null)
  const [pendingReset, setPendingReset] = useState<User | null>(null)
  const [resetResult, setResetResult] = useState<{ nombre: string; password: string } | null>(null)

  const { data: users, isLoading } = useUsers({
    ...(rolFilter ? { rol: rolFilter } : {}),
    ...(estadoFilter !== 'TODOS' ? { activo: estadoFilter === 'ACTIVOS' } : {}),
  })

  const toggleActive = useToggleUserActive()
  const resetPassword = useResetUserPassword()

  const totalItems = users?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return (users ?? []).slice(start, start + PAGE_SIZE)
  }, [users, page])

  function handlePageChange(next: number) {
    setPage(next)
  }

  function handleFilterChange(setter: () => void) {
    setter()
    setPage(1)
  }

  function confirmReset() {
    if (!pendingReset) return
    const user = pendingReset
    resetPassword.mutate(user.id, {
      onSuccess: (result) => {
        setResetResult({ nombre: `${user.nombre} ${user.apellido}`, password: result.temporaryPassword })
      },
      onSettled: () => setPendingReset(null),
    })
  }

  function confirmToggle() {
    if (!pendingToggle) return
    const wasActive = pendingToggle.activo
    toggleActive.mutate(pendingToggle.id, {
      onSuccess: () => {
        toast.success(wasActive ? t('list.toasts.bajaExitosa') : t('list.toasts.reactivarExitosa'))
      },
      onError: () => {
        toast.error(wasActive ? t('list.toasts.bajaError') : t('list.toasts.reactivarError'))
      },
      onSettled: () => setPendingToggle(null),
    })
  }

  const selectBase =
    'h-9 rounded-md border border-hairline bg-canvas px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral/40 dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark'
  const thClass =
    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft'

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <FilterBar className="mb-0">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="usr-rol">
              {t('list.filters.rol')}
            </label>
            <select
              id="usr-rol"
              className={`${selectBase} w-56`}
              value={rolFilter}
              onChange={(e) => handleFilterChange(() => setRolFilter(e.target.value as UserRole | ''))}
            >
              <option value="">{t('list.filters.todos')}</option>
              {ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted dark:text-on-dark-soft" htmlFor="usr-estado">
              {t('list.filters.estado')}
            </label>
            <select
              id="usr-estado"
              className={`${selectBase} w-40`}
              value={estadoFilter}
              onChange={(e) => handleFilterChange(() => setEstadoFilter(e.target.value as EstadoFilter))}
            >
              <option value="TODOS">{t('list.filters.todos')}</option>
              <option value="ACTIVOS">{t('list.filters.activos')}</option>
              <option value="INACTIVOS">{t('list.filters.inactivos')}</option>
            </select>
          </div>
        </FilterBar>

        {canAdminister && (
          <button
            type="button"
            onClick={() => setFormUser(null)}
            className="flex items-center gap-2 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
          >
            <Plus size={16} aria-hidden="true" />
            {t('list.actions.nuevo')}
          </button>
        )}
      </div>

      {canAdminister && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted dark:text-on-dark-soft">
          <KeyRound size={13} aria-hidden="true" className="shrink-0" />
          {t('list.actions.resetearPasswordAyuda')}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        <table className="w-full text-sm">
          <thead className="border-b border-hairline bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark-soft">
            <tr>
              <th className={thClass}>{t('list.columns.nombre')}</th>
              <th className={thClass}>{t('list.columns.email')}</th>
              <th className={thClass}>{t('list.columns.rol')}</th>
              <th className={thClass}>{t('list.columns.area')}</th>
              <th className={thClass}>{t('list.columns.estado')}</th>
              <th className={thClass}>{t('list.columns.lastLogin')}</th>
              <th className={thClass}>{t('list.columns.acciones')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline dark:divide-hairline/20">
            {isLoading ? (
              <tr>
                <td colSpan={COLUMN_COUNT + 1} className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
                  …
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT + 1} className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
                  {rolFilter || estadoFilter !== 'TODOS' ? t('list.emptyWithFilters') : t('list.empty')}
                </td>
              </tr>
            ) : (
              pageItems.map((u) => (
                <tr key={u.id} className="hover:bg-surface-soft dark:hover:bg-surface-dark-soft">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar user={u} size="sm" />
                      <span className="text-ink dark:text-on-dark">
                        {u.nombre} {u.apellido}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink dark:text-on-dark">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BG_CLASSES[u.rol]}`}>
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink dark:text-on-dark">{u.area ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.activo
                          ? 'bg-success/20 text-success'
                          : 'bg-muted/20 text-muted dark:text-on-dark-soft'
                      }`}
                    >
                      {u.activo ? t('list.estado.activo') : t('list.estado.inactivo')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted dark:text-on-dark-soft">
                    {u.lastLogin ? formatDateTime(u.lastLogin, i18n.language) : t('list.estado.nunca')}
                  </td>
                  <td className="px-4 py-3">
                    {canAdminister && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setFormUser(u)}
                          aria-label={t('list.actions.editar')}
                          title={t('list.actions.editar')}
                          className="rounded-sm p-1 text-muted transition-colors hover:text-coral dark:text-on-dark-soft dark:hover:text-coral"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingReset(u)}
                          aria-label={t('list.actions.resetearPassword')}
                          title={t('list.actions.resetearPassword')}
                          className="rounded-sm p-1 text-muted transition-colors hover:text-amber dark:text-on-dark-soft dark:hover:text-amber"
                        >
                          <KeyRound size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingToggle(u)}
                          aria-label={u.activo ? t('list.actions.darDeBaja') : t('list.actions.reactivar')}
                          title={u.activo ? t('list.actions.darDeBaja') : t('list.actions.reactivar')}
                          className={`rounded-sm p-1 transition-colors ${
                            u.activo
                              ? 'text-muted hover:text-error dark:text-on-dark-soft dark:hover:text-error'
                              : 'text-muted hover:text-teal dark:text-on-dark-soft dark:hover:text-teal'
                          }`}
                        >
                          {u.activo ? <Ban size={14} aria-hidden="true" /> : <RotateCcw size={14} aria-hidden="true" />}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
      />

      {formUser !== undefined && (
        <UserFormModal user={formUser ?? undefined} onClose={() => setFormUser(undefined)} />
      )}

      {pendingToggle && (
        <ConfirmToggleModal
          user={pendingToggle}
          isPending={toggleActive.isPending}
          onConfirm={confirmToggle}
          onClose={() => setPendingToggle(null)}
        />
      )}

      {pendingReset && (
        <ConfirmResetModal
          user={pendingReset}
          isPending={resetPassword.isPending}
          onConfirm={confirmReset}
          onClose={() => setPendingReset(null)}
        />
      )}

      {resetResult && (
        <TemporaryPasswordModal
          nombre={resetResult.nombre}
          password={resetResult.password}
          onClose={() => setResetResult(null)}
        />
      )}
    </div>
  )
}
