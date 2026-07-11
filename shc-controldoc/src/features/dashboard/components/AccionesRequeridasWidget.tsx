import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAccionesRequeridas } from '../hooks/useAccionesRequeridas'
import { calcularEstadoSemaforoDesdeFecha } from '../utils/semaforoPendientes'
import type { AccionRequerida, AccionRequeridaDominio } from '../types/accionesRequeridas.types'

const DOMINIO_ORDEN: AccionRequeridaDominio[] = ['QE', 'AC', 'DOCUMENTO']
const VISIBLE_LIMIT = 10

const BORDER_CLASS = {
  alta: 'border-l-error',
  normal: 'border-l-hairline dark:border-l-hairline/20',
} as const

function WidgetSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-hairline dark:bg-surface-dark-soft" />
      ))}
    </div>
  )
}

function AccionRequeridaRow({ item, onClick }: { item: AccionRequerida; onClick: () => void }) {
  const { t } = useTranslation('dashboard')
  const semaforo = item.fechaLimite ? calcularEstadoSemaforoDesdeFecha(item.fechaLimite) : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-4 rounded-lg rounded-l-none border-y border-r border-y-hairline border-r-hairline bg-surface-card px-4 py-3 text-left dark:border-y-hairline/20 dark:border-r-hairline/20 dark:bg-surface-dark-elevated border-l-[3px] ${BORDER_CLASS[item.prioridad]}`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink dark:text-on-dark">{item.codigo}</p>
        <p className="truncate text-xs text-muted dark:text-on-dark-soft">
          {t(`accionesRequeridas.tipo.${item.tipo}`)}
        </p>
      </div>
      {semaforo && (
        <span className="shrink-0 text-xs text-muted dark:text-on-dark-soft">
          {semaforo.diasHabilesRestantes > 0
            ? t('semaforo.venceEn', { dias: semaforo.diasHabilesRestantes })
            : semaforo.diasHabilesRestantes === 0
              ? t('semaforo.venceHoy')
              : t('semaforo.vencidoHace', { dias: Math.abs(semaforo.diasHabilesRestantes) })}
        </span>
      )}
    </button>
  )
}

export function AccionesRequeridasWidget() {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()
  const { items, isLoading } = useAccionesRequeridas()
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? items : items.slice(0, VISIBLE_LIMIT)
  const grouped = DOMINIO_ORDEN.map((dominio) => ({
    dominio,
    items: visible.filter((item) => item.dominio === dominio),
  })).filter((group) => group.items.length > 0)

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-body-strong dark:text-on-dark">
        {t('accionesRequeridas.title')}
      </h2>

      {isLoading ? (
        <WidgetSkeleton />
      ) : items.length === 0 ? (
        <div className="overflow-x-auto rounded-lg border border-hairline dark:border-hairline/20">
          <p className="px-4 py-12 text-center text-sm text-muted dark:text-on-dark-soft">
            {t('accionesRequeridas.empty')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.dominio} className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">
                {t(`accionesRequeridas.dominio.${group.dominio}`)}
              </h3>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <AccionRequeridaRow key={item.id} item={item} onClick={() => navigate(item.ruta)} />
                ))}
              </div>
            </div>
          ))}

          {items.length > VISIBLE_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-sm font-medium text-coral hover:text-coral-dark"
            >
              {showAll
                ? t('accionesRequeridas.verMenos')
                : t('accionesRequeridas.verTodos', { count: items.length })}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
