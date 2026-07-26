import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Pencil, Ban, RotateCcw, Users as UsersIcon, Building2 } from 'lucide-react'
import { useEmpresas, useUpdateEmpresa } from '../hooks/useEmpresas'
import { ConfirmModal } from './ConfirmModal'
import type { Empresa } from '../types/empresa.types'

interface EmpresaListProps {
  onEdit: (empresa: Empresa) => void
  canAdminister: boolean
}

export function EmpresaList({ onEdit, canAdminister }: EmpresaListProps) {
  const { t, i18n } = useTranslation('empresas')
  const { data: empresas, isLoading } = useEmpresas()
  const updateMutation = useUpdateEmpresa()
  const [toggleTarget, setToggleTarget] = useState<Empresa | null>(null)

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  function handleConfirmToggle() {
    if (!toggleTarget) return
    const nuevoEstado = toggleTarget.estado === 'ACTIVA' ? 'INACTIVA' : 'ACTIVA'
    updateMutation.mutate(
      { id: toggleTarget.id, data: { estado: nuevoEstado } },
      { onSuccess: () => setToggleTarget(null) },
    )
  }

  if (isLoading) {
    return <p className="text-sm text-muted dark:text-on-dark-soft">{t('list.cargando')}</p>
  }

  if (!empresas || empresas.length === 0) {
    return <p className="text-sm text-muted dark:text-on-dark-soft">{t('list.vacio')}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-hairline bg-surface-soft text-xs uppercase text-muted dark:border-hairline/20 dark:bg-surface-dark-soft dark:text-on-dark-soft">
          <tr>
            <th className="px-4 py-3">{t('list.columns.logo')}</th>
            <th className="px-4 py-3">{t('list.columns.razonSocial')}</th>
            <th className="px-4 py-3">{t('list.columns.ruc')}</th>
            <th className="px-4 py-3">{t('list.columns.estado')}</th>
            <th className="px-4 py-3">{t('list.columns.fechaAlta')}</th>
            <th className="px-4 py-3 text-right">{t('list.columns.acciones')}</th>
          </tr>
        </thead>
        <tbody>
          {empresas.map((empresa) => (
            <tr
              key={empresa.id}
              className="border-b border-hairline last:border-0 dark:border-hairline/20"
            >
              <td className="px-4 py-3">
                {empresa.logoUrl ? (
                  <img
                    src={empresa.logoUrl}
                    alt={empresa.razonSocial}
                    className="h-8 w-8 rounded-md border border-hairline object-contain dark:border-hairline/20"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-coral/10 text-coral dark:bg-coral/20">
                    <Building2 size={16} />
                  </span>
                )}
              </td>
              <td className="px-4 py-3 font-medium text-ink dark:text-on-dark">{empresa.razonSocial}</td>
              <td className="px-4 py-3 text-muted dark:text-on-dark-soft">{empresa.ruc}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-[9999px] px-2.5 py-0.5 text-xs ${
                    empresa.estado === 'ACTIVA'
                      ? 'bg-success/20 text-success'
                      : 'bg-muted-soft/20 text-muted dark:text-on-dark-soft'
                  }`}
                >
                  {t(`estado.${empresa.estado}`)}
                </span>
              </td>
              <td className="px-4 py-3 text-muted dark:text-on-dark-soft">
                {dateFormatter.format(new Date(empresa.fechaAlta))}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Link
                    to={`/admin/empresas/${empresa.id}/usuarios`}
                    aria-label={t('list.actions.usuarios')}
                    title={t('list.actions.usuarios')}
                    className="rounded p-1.5 text-muted hover:bg-hairline hover:text-ink dark:text-on-dark-soft dark:hover:bg-surface-dark-soft dark:hover:text-on-dark"
                  >
                    <UsersIcon size={16} />
                  </Link>
                  {canAdminister && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(empresa)}
                        aria-label={t('list.actions.editar')}
                        title={t('list.actions.editar')}
                        className="rounded p-1.5 text-muted hover:bg-hairline hover:text-ink dark:text-on-dark-soft dark:hover:bg-surface-dark-soft dark:hover:text-on-dark"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setToggleTarget(empresa)}
                        aria-label={
                          empresa.estado === 'ACTIVA'
                            ? t('list.actions.desactivar')
                            : t('list.actions.reactivar')
                        }
                        title={
                          empresa.estado === 'ACTIVA'
                            ? t('list.actions.desactivar')
                            : t('list.actions.reactivar')
                        }
                        className="rounded p-1.5 text-muted hover:bg-hairline hover:text-error dark:text-on-dark-soft dark:hover:bg-surface-dark-soft dark:hover:text-error"
                      >
                        {empresa.estado === 'ACTIVA' ? <Ban size={16} /> : <RotateCcw size={16} />}
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {toggleTarget && (
        <ConfirmModal
          titulo={
            toggleTarget.estado === 'ACTIVA'
              ? t('list.confirmarDesactivar.titulo')
              : t('list.confirmarReactivar.titulo')
          }
          mensaje={
            toggleTarget.estado === 'ACTIVA'
              ? t('list.confirmarDesactivar.mensaje', { nombre: toggleTarget.razonSocial })
              : t('list.confirmarReactivar.mensaje', { nombre: toggleTarget.razonSocial })
          }
          cancelarLabel={t('list.confirmarDesactivar.cancelar')}
          confirmarLabel={
            toggleTarget.estado === 'ACTIVA'
              ? t('list.confirmarDesactivar.confirmar')
              : t('list.confirmarReactivar.confirmar')
          }
          isPending={updateMutation.isPending}
          danger={toggleTarget.estado === 'ACTIVA'}
          onConfirm={handleConfirmToggle}
          onClose={() => setToggleTarget(null)}
        />
      )}
    </div>
  )
}
