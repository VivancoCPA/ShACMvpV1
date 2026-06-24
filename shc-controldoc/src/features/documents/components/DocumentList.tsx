import { Fragment, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDocumentList } from '../hooks/useDocumentList'
import { DocumentListRow } from './DocumentListRow'
import { DocumentVersionSubRow } from './DocumentVersionSubRow'
import { useAuthStore } from '../../../stores/authStore'
import type { Documento, DocStatus } from '../../../types/documents.types'
import type { UserRole } from '../../../types/auth.types'

const NON_PENDING_ROLES = new Set<UserRole>(['OPERARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'])

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = []
  const left = Math.max(1, current - 3)
  const right = Math.min(total, current + 3)
  if (left > 1) { pages.push(1); if (left > 2) pages.push('...') }
  for (let p = left; p <= right; p++) pages.push(p)
  if (right < total) { if (right < total - 1) pages.push('...'); pages.push(total) }
  return pages
}

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

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <tr key={i}>
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const userId = useAuthStore((s) => s.user?.id) ?? ''
  const effectiveRole: UserRole = (userRole as UserRole | undefined) ?? 'OPERARIO'
  const canCreate = userRole !== undefined && CREATE_ROLES.has(userRole)
  const includeDeleted = searchParams.get('includeDeleted') === 'true'

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
  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalItems)

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

  return (
    <div className="overflow-hidden rounded-lg border border-hairline dark:border-hairline/20">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-canvas text-left dark:bg-surface-dark">
          <thead>
            <tr className="border-b border-hairline bg-surface-soft dark:border-hairline/20 dark:bg-surface-dark-elevated">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted dark:text-on-dark-soft"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
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

      {!isLoading && !isError && totalItems > 0 && (
        <div className="flex items-center justify-between border-t border-hairline bg-canvas px-4 py-3 dark:border-hairline/20 dark:bg-surface-dark">
          <p className="text-sm text-muted dark:text-on-dark-soft">
            {t('list.pagination.showing', { from, to, total: totalItems })}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label={t('list.pagination.previous')}
              className="rounded-sm px-2 py-1 text-sm text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 dark:text-on-dark-soft dark:hover:text-on-dark"
            >
              ‹
            </button>
            {getPageNumbers(currentPage, totalPages).map((p, i) =>
              p === '...'
                ? <span key={`ellipsis-${i}`} className="px-2 py-1 text-sm text-muted">…</span>
                : <button
                    key={p}
                    type="button"
                    onClick={() => goToPage(p)}
                    className={`min-w-[2rem] rounded-sm px-2 py-1 text-sm transition-colors ${
                      p === currentPage
                        ? 'bg-coral text-white'
                        : 'text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark'
                    }`}
                  >{p}</button>
            )}
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label={t('list.pagination.next')}
              className="rounded-sm px-2 py-1 text-sm text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 dark:text-on-dark-soft dark:hover:text-on-dark"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
