import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UserPlus, Ban, RotateCcw } from 'lucide-react'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { NotFoundPage } from '../../../pages/NotFoundPage'
import { Pagination } from '../../../components/shared/Pagination'
import { UserAvatar } from '../../../components/ui/UserAvatar'
import { useEmpresas } from '../hooks/useEmpresas'
import { useUsuarioEmpresaPorEmpresa, useToggleUsuarioEmpresa } from '../hooks/useUsuarioEmpresa'
import { AsignarUsuarioModal } from '../components/AsignarUsuarioModal'
import { ConfirmModal } from '../components/ConfirmModal'
import type { UsuarioEmpresaConDatos } from '../api/empresas.api'

const PAGE_SIZE = 10

export function EmpresaUsuariosPage() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation('empresas')
  const { t: tAuth } = useTranslation('auth')
  const { data: empresas, isLoading: loadingEmpresas } = useEmpresas()
  const empresa = empresas?.find((e) => e.id === id)

  const { data: asignaciones, isLoading: loadingAsignaciones } = useUsuarioEmpresaPorEmpresa(id ?? '')
  const toggleMutation = useToggleUsuarioEmpresa(id ?? '')

  const [showAsignar, setShowAsignar] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<UsuarioEmpresaConDatos | null>(null)
  const [page, setPage] = useState(1)

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  const totalItems = asignaciones?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return (asignaciones ?? []).slice(start, start + PAGE_SIZE)
  }, [asignaciones, page])

  if (!loadingEmpresas && !empresa) {
    return <NotFoundPage />
  }

  function handleConfirmToggle() {
    if (!toggleTarget) return
    const nuevoEstado = toggleTarget.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    toggleMutation.mutate(
      { usuarioId: toggleTarget.usuarioId, estado: nuevoEstado },
      { onSuccess: () => setToggleTarget(null) },
    )
  }

  const actions = (
    <button
      type="button"
      onClick={() => setShowAsignar(true)}
      className="inline-flex items-center gap-1.5 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
    >
      <UserPlus size={14} aria-hidden="true" />
      {t('asignacion.header.asignarUsuario')}
    </button>
  )

  return (
    <PageWrapper title={empresa ? t('asignacion.header.title', { empresa: empresa.razonSocial }) : ''} actions={actions}>
      <ErrorBoundary>
        {loadingAsignaciones ? (
          <p className="text-sm text-muted dark:text-on-dark-soft">{t('asignacion.cargando')}</p>
        ) : !asignaciones || asignaciones.length === 0 ? (
          <p className="text-sm text-muted dark:text-on-dark-soft">{t('asignacion.vacio')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-surface-soft text-xs uppercase text-muted dark:border-hairline/20 dark:bg-surface-dark-soft dark:text-on-dark-soft">
                <tr>
                  <th className="px-4 py-3">{t('asignacion.columns.usuario')}</th>
                  <th className="px-4 py-3">{t('asignacion.columns.email')}</th>
                  <th className="px-4 py-3">{t('asignacion.columns.rol')}</th>
                  <th className="px-4 py-3">{t('asignacion.columns.estado')}</th>
                  <th className="px-4 py-3">{t('asignacion.columns.fechaAsignacion')}</th>
                  <th className="px-4 py-3 text-right">{t('asignacion.columns.acciones')}</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((a) => (
                  <tr
                    key={a.usuarioId}
                    className="border-b border-hairline last:border-0 dark:border-hairline/20"
                  >
                    <td className="px-4 py-3 font-medium text-ink dark:text-on-dark">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          user={{
                            nombre: a.usuarioNombre,
                            apellido: a.usuarioApellido,
                            avatarUrl: a.usuarioAvatarUrl,
                            rol: a.rol,
                          }}
                          size="sm"
                        />
                        <span>
                          {a.usuarioNombre} {a.usuarioApellido}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted dark:text-on-dark-soft">{a.usuarioEmail}</td>
                    <td className="px-4 py-3 text-muted dark:text-on-dark-soft">{tAuth(`roles.${a.rol}`)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-[9999px] px-2.5 py-0.5 text-xs ${
                          a.estado === 'ACTIVO'
                            ? 'bg-success/20 text-success'
                            : 'bg-muted-soft/20 text-muted dark:text-on-dark-soft'
                        }`}
                      >
                        {t(`asignacion.estado.${a.estado}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted dark:text-on-dark-soft">
                      {dateFormatter.format(new Date(a.fechaAsignacion))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setToggleTarget(a)}
                          aria-label={
                            a.estado === 'ACTIVO'
                              ? t('asignacion.actions.desactivar')
                              : t('asignacion.actions.reactivar')
                          }
                          title={
                            a.estado === 'ACTIVO'
                              ? t('asignacion.actions.desactivar')
                              : t('asignacion.actions.reactivar')
                          }
                          className="rounded p-1.5 text-muted hover:bg-hairline hover:text-error dark:text-on-dark-soft dark:hover:bg-surface-dark-soft dark:hover:text-error"
                        >
                          {a.estado === 'ACTIVO' ? <Ban size={16} /> : <RotateCcw size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ErrorBoundary>

      {!loadingAsignaciones && asignaciones && asignaciones.length > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      {showAsignar && id && (
        <AsignarUsuarioModal empresaId={id} onClose={() => setShowAsignar(false)} />
      )}

      {toggleTarget && (
        <ConfirmModal
          titulo={
            toggleTarget.estado === 'ACTIVO'
              ? t('asignacion.confirmarDesactivar.titulo')
              : t('asignacion.confirmarReactivar.titulo')
          }
          mensaje={t('asignacion.confirmarDesactivar.mensaje', {
            nombre: `${toggleTarget.usuarioNombre} ${toggleTarget.usuarioApellido}`,
          })}
          cancelarLabel={t('asignacion.confirmarDesactivar.cancelar')}
          confirmarLabel={
            toggleTarget.estado === 'ACTIVO'
              ? t('asignacion.confirmarDesactivar.confirmar')
              : t('asignacion.confirmarReactivar.confirmar')
          }
          isPending={toggleMutation.isPending}
          danger={toggleTarget.estado === 'ACTIVO'}
          onConfirm={handleConfirmToggle}
          onClose={() => setToggleTarget(null)}
        />
      )}
    </PageWrapper>
  )
}
