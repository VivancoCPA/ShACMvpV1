import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface SemaforoCriticoBannerItem {
  id: string
  codigo: string
  descripcion: string
}

interface SemaforoCriticoBannerProps {
  items: SemaforoCriticoBannerItem[]
  onItemClick?: (id: string) => void
}

export function SemaforoCriticoBanner({ items, onItemClick }: SemaforoCriticoBannerProps) {
  const { t } = useTranslation()

  if (items.length === 0) return null

  return (
    <div className="rounded-lg border border-error bg-error/10 p-4 dark:border-error dark:bg-error/15">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-error dark:text-error" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-error dark:text-error">
            {t('dashboard:semaforo.criticoBanner.title')}
          </h3>
          <p className="mt-0.5 text-sm text-error dark:text-error">
            {t('dashboard:semaforo.criticoBanner.count', { count: items.length })}
          </p>
          <ul className="mt-3 space-y-1">
            {items.map((item) => {
              const label = `${item.codigo} — ${item.descripcion}`
              if (onItemClick) {
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onItemClick(item.id)}
                      className="text-left text-sm text-error underline-offset-2 hover:underline dark:text-error"
                    >
                      {label}
                    </button>
                  </li>
                )
              }
              return (
                <li key={item.id} className="text-sm text-error dark:text-error">
                  {label}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
