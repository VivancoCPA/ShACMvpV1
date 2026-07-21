import { Fragment, useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, X } from 'lucide-react'
import { useDocumentList } from '../hooks/useDocumentList'
import { DocumentListRow } from './DocumentListRow'
import { DocumentVersionSubRow } from './DocumentVersionSubRow'
import { Pagination } from '../../../components/shared/Pagination'
import { TABLE_ROW_CLASS } from '../../../constants/ui.constants'
import { useAuthStore } from '../../../stores/authStore'
import { deleteDocument, restaurarDocumento } from '../../../api/endpoints/documents.api'
import { useAreas } from '../../areas/hooks/useAreas'
import { QUERY_KEYS } from '../constants'
import type { Documento, DocStatus } from '../../../types/documents.types'
import type { UserRole } from '../../../types/auth.types'

const NON_PENDING_ROLES = new Set<UserRole>(['OPERARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'])

function isDocPendingForUser(doc: Documento, userId: string, userRole: UserRole): boolean {
  if (!userId || NON_PENDING_ROLES.has(userRole)) return false
  if (userRole === 'SUPERVISOR' && doc.estado === 'EN_REVISION' && doc.revisorId === userId) return true
  if (!NON_PENDING_ROLES.has(userRole) && doc.estado === 'EN_APROBACION' && doc.aprobadorId === userId) return true
  if (userRole === 'JEFE_CALIDAD_SYST' && (doc.estado === 'EN_REVISION' || doc.estado === 'EN_REVISION_PERIODICA')) return true
  if (userRole === 'JEFE_CONTROL_DOCUMENTARIO' && doc.estado === 'EN_REVISION_PERIODICA') return true
  return false
}

const STATUS_RANK: Record<DocStatus, number> = {
  PUBLICADO: 0,
  EN_REVISION_PERIODICA: 1,
  EN_APROBACION: 2,
  EN_REVISION: 3,
  BORRADOR: 4,
  OBSOLETO: 5,
}

const SKELETON_ROWS = 5
const CREATE_ROLES = new Set(['JEFE_CONTROL_DOCUMENTARIO', 'JEFE_CALIDAD_SYST'])
const HIDE_OBSOLETO_ROLES = new Set<UserRole>(['OPERARIO', 'SUPERVISOR'])

type DocGroup = {
  codigo: string
  primary: Documento
  older: Documento[]
}

function buildGroups(docs: Documento[], userRole: UserRole): DocGroup[] {
  const hideObsoleto = HIDE_OBSOLETO_ROLES.has(userRole)
  const map = new Map<string, Documento[]>()

  for (const doc of docs) {
    if (hideObsoleto && doc.estado === 'OBSOLETO') continue
    const list = map.get(doc.codigo) ?? []
    list.push(doc)
    map.set(doc.codigo, list)
  }

  const groups: DocGroup[] = []
  for (const [codigo, versions] of map) {
    const sorted = [...versions].sort((a, b) => {
      const ra = STATUS_RANK[a.estado] ?? 99
      const rb = STATUS_RANK[b.estado] ?? 99
      if (ra !== rb) return ra - rb
      return b.creadoEn.localeCompare(a.creadoEn)
    })
    const [primary, ...older] = sorted
    groups.push({ codigo, primary, older })
  }

  return groups
}

interface DeleteConfirmModalProps {
  documento: Documento
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}

function DeleteConfirmModal({ documento, isPending, onConfirm, onClose }: DeleteConfirmModalProps) {
  const { t } = useTranslation('documents')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('actions.delete.confirm.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-error" />
          <div>
            <h2 className="font-medium text-ink dark:text-on-dark">{t('actions.delete.confirm.title')}</h2>
            <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">
              {t('actions.delete.confirm.message', { titulo: documento.titulo })}
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
            {t('actions.delete.confirm.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white hover:bg-error/80 disabled:opacity-60"
          >
            {t('actions.delete.confirm.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface RestoreConfirmModalProps {
  documento: Documento
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}

function RestoreConfirmModal({ documento, isPending, onConfirm, onClose }: RestoreConfirmModalProps) {
  const { t } = useTranslation('documents')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 dark:bg-black/60">
      <div className="relative w-full max-w-md rounded-xl bg-canvas p-6 shadow-xl dark:bg-surface-dark-elevated">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('deleted.restore.confirm.cancel')}
          className="absolute right-4 top-4 text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <X size={18} />
        </button>
        <div className="mb-4">
          <h2 className="font-medium text-ink dark:text-on-dark">{t('deleted.restore.confirm.title')}</h2>
          <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">
            {t('deleted.restore.confirm.message', { titulo: documento.titulo })}
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-soft disabled:opacity-60"
          >
            {t('deleted.restore.confirm.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/80 disabled:opacity-60"
          >
            {t('deleted.restore.confirm.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <tr key={i} className={TABLE_ROW_CLASS}>
          {Array.from({ length: 8 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded bg-hairline animate-pulse dark:bg-surface-dark-elevated" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function DocumentList() {
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const userRole = useAuthStore((s) => s.user?.rol)
  const { documentos, isLoading, isError, pagination, refetch } = useDocumentList()
  const { data: areas } = useAreas()
  const nombreArea = (id: string) => areas?.find((a) => a.id === id)?.nombre ?? id
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<Documento | null>(null)
  const [pendingRestoreDoc, setPendingRestoreDoc] = useState<Documento | null>(null)

  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string; codigo: string }) => deleteDocument(id),
    onSuccess: (_, { codigo }) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      toast.success(t('actions.delete.toast.success', { codigo }))
      setPendingDeleteDoc(null)
    },
    onError: () => {
      toast.error(t('actions.delete.toast.error'))
      setPendingDeleteDoc(null)
    },
  })

  const restoreMutation = useMutation({
    mutationFn: ({ id }: { id: string; codigo: string }) => restaurarDocumento(id),
    onSuccess: (_, { codigo }) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      toast.success(t('deleted.restore.toast.success', { codigo }))
      setPendingRestoreDoc(null)
    },
    onError: () => {
      toast.error(t('deleted.restore.toast.error'))
      setPendingRestoreDoc(null)
    },
  })

  const userId = useAuthStore((s) => s.user?.id) ?? ''
  const effectiveRole: UserRole = (userRole as UserRole | undefined) ?? 'OPERARIO'
  const canCreate = userRole !== undefined && CREATE_ROLES.has(userRole)
  const includeDeleted = searchParams.get('includeDeleted') === 'true'

  const removeParam = useCallback(
    (key: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete(key)
        next.set('page', '1')
        return next
      })
    },
    [setSearchParams],
  )

  type ChipDef = { key: string; label: string }
  const activeChips: ChipDef[] = []
  const searchParam = searchParams.get('search')
  if (searchParam) activeChips.push({ key: 'search', label: `"${searchParam}"` })
  const estadoParam = searchParams.get('estado')
  if (estadoParam) activeChips.push({ key: 'estado', label: estadoParam })
  const tipoParam = searchParams.get('tipo')
  if (tipoParam) activeChips.push({ key: 'tipo', label: tipoParam })
  const areaParam = searchParams.get('areaId')
  if (areaParam) activeChips.push({ key: 'areaId', label: nombreArea(areaParam) })
  if (searchParams.get('pendientes') === 'true') activeChips.push({ key: 'pendientes', label: t('pendientes.filtro') })
  if (includeDeleted) activeChips.push({ key: 'includeDeleted', label: t('deleted.toggle.label') })

  const pendingDocIds = useMemo(() => {
    const ids = new Set<string>()
    documentos.forEach((doc) => {
      if (isDocPendingForUser(doc, userId, effectiveRole)) ids.add(doc.id)
    })
    return ids
  }, [documentos, userId, effectiveRole])

  const groups = includeDeleted ? [] : buildGroups(documentos, effectiveRole)

  const toggleGroup = (codigo: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) {
        next.delete(codigo)
      } else {
        next.add(codigo)
      }
      return next
    })
  }

  const currentPage = pagination?.page ?? 1
  const totalPages = pagination?.totalPages ?? 1
  const totalItems = pagination?.totalItems ?? 0
  const pageSize = pagination?.pageSize ?? 20

  const goToPage = (page: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('page', String(page))
      return next
    })
  }

  const columns = [
    t('list.columns.codigo'),
    t('list.columns.titulo'),
    t('list.columns.tipo'),
    t('list.columns.version'),
    t('list.columns.estado'),
    t('list.columns.area'),
    t('list.columns.proxRevision'),
    t('list.columns.acciones'),
  ]

  const thClass =
    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft'

  return (
    <>
    {activeChips.length > 0 && (
      <div className="mb-4 flex flex-wrap gap-2">
        {activeChips.map((chip) => (
          <span
            key={chip.key}
            className="inline-flex items-center gap-1 rounded-pill bg-surface-soft px-2.5 py-1 text-xs text-ink dark:bg-surface-dark-soft dark:text-on-dark"
          >
            {chip.label}
            <button
              type="button"
              onClick={() => removeParam(chip.key)}
              aria-label={`${t('list.filters.limpiar')} ${chip.label}`}
              className="ml-0.5 text-muted hover:text-error dark:text-on-dark-soft dark:hover:text-error"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
    )}

    <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
        <table className="w-full text-sm">
          <thead className="border-b border-hairline bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark-soft">
            <tr>
              {columns.map((col) => (
                <th key={col} className={thClass}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline dark:divide-hairline/20">
            {isLoading && <TableSkeleton />}

            {!isLoading && isError && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <p className="mb-3 text-sm text-muted dark:text-on-dark-soft">
                    {t('list.actions.errorMsg')}
                  </p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
                  >
                    {t('list.actions.reintentar')}
                  </button>
                </td>
              </tr>
            )}

            {!isLoading && !isError && (includeDeleted ? documentos.length === 0 : groups.length === 0) && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <p className="mb-3 text-sm text-muted dark:text-on-dark-soft">
                    {t('list.empty')}
                  </p>
                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => navigate('/documents/new')}
                      className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
                    >
                      {t('list.actions.nuevo')}
                    </button>
                  )}
                </td>
              </tr>
            )}

            {/* Deleted documents — flat list, no grouping */}
            {!isLoading &&
              !isError &&
              includeDeleted &&
              documentos.map((doc, i) => (
                <DocumentListRow
                  key={doc.id}
                  documento={doc}
                  userRole={effectiveRole}
                  index={i}
                  onClick={() => navigate(`/documentos/${doc.id}`)}
                  hasVersions={false}
                  isExpanded={false}
                  isPending={false}
                  onDeleteClick={setPendingDeleteDoc}
                  onRestoreClick={setPendingRestoreDoc}
                />
              ))}

            {/* Active documents — grouped by codigo */}
            {!isLoading &&
              !isError &&
              !includeDeleted &&
              groups.map((group, groupIndex) => (
                <Fragment key={group.codigo}>
                  <DocumentListRow
                    documento={group.primary}
                    userRole={effectiveRole}
                    index={groupIndex}
                    onClick={() => navigate(`/documentos/${group.primary.id}`)}
                    hasVersions={group.older.length > 0}
                    isExpanded={expandedGroups.has(group.codigo)}
                    onToggle={() => toggleGroup(group.codigo)}
                    isPending={pendingDocIds.has(group.primary.id)}
                    onDeleteClick={setPendingDeleteDoc}
                    onRestoreClick={setPendingRestoreDoc}
                  />
                  {expandedGroups.has(group.codigo) &&
                    group.older.map((doc) => (
                      <DocumentVersionSubRow
                        key={doc.id}
                        documento={doc}
                        onClick={() => navigate(`/documentos/${doc.id}`)}
                      />
                    ))}
                </Fragment>
              ))}
          </tbody>
        </table>
    </div>

    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      totalItems={totalItems}
      pageSize={pageSize}
      onPageChange={goToPage}
    />

    {pendingDeleteDoc && (
      <DeleteConfirmModal
        documento={pendingDeleteDoc}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate({ id: pendingDeleteDoc.id, codigo: pendingDeleteDoc.codigo })}
        onClose={() => setPendingDeleteDoc(null)}
      />
    )}

    {pendingRestoreDoc && (
      <RestoreConfirmModal
        documento={pendingRestoreDoc}
        isPending={restoreMutation.isPending}
        onConfirm={() => restoreMutation.mutate({ id: pendingRestoreDoc.id, codigo: pendingRestoreDoc.codigo })}
        onClose={() => setPendingRestoreDoc(null)}
      />
    )}
    </>
  )
}
