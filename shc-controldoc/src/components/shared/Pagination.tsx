import { useTranslation } from 'react-i18next'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = []
  const left = Math.max(1, current - 3)
  const right = Math.min(total, current + 3)
  if (left > 1) {
    pages.push(1)
    if (left > 2) pages.push('...')
  }
  for (let p = left; p <= right; p++) pages.push(p)
  if (right < total) {
    if (right < total - 1) pages.push('...')
    pages.push(total)
  }
  return pages
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  const { t } = useTranslation('common')

  if (totalItems === 0) return null

  const from = (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-xs text-muted dark:text-on-dark-soft">
        {t('pagination.showing', { from, to, total: totalItems })}
      </p>
      <nav className="flex items-center gap-1" aria-label="Paginación">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="rounded-md px-2.5 py-1 text-xs text-muted transition-colors hover:bg-hairline disabled:cursor-not-allowed disabled:opacity-40 dark:text-on-dark-soft dark:hover:bg-surface-dark-soft"
        >
          ←
        </button>
        {getPageNumbers(currentPage, totalPages).map((p, i) =>
          p === '...' ? (
            <span
              key={`ellipsis-${i}`}
              className="px-1 text-xs text-muted dark:text-on-dark-soft"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              className={`min-w-[2rem] rounded-md px-2 py-1 text-xs transition-colors ${
                p === currentPage
                  ? 'bg-coral text-white'
                  : 'text-muted hover:bg-hairline dark:text-on-dark-soft dark:hover:bg-surface-dark-soft'
              }`}
              aria-current={p === currentPage ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="rounded-md px-2.5 py-1 text-xs text-muted transition-colors hover:bg-hairline disabled:cursor-not-allowed disabled:opacity-40 dark:text-on-dark-soft dark:hover:bg-surface-dark-soft"
        >
          →
        </button>
      </nav>
    </div>
  )
}
