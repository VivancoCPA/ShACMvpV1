import { resetAllMockStores } from '../../mocks/resetAllStores'

function handleReset() {
  const confirmed = window.confirm(
    'Esto reiniciará todos los stores mock (documentos, quality events, no conformidades, incidentes, locales/zonas) a su estado de fixtures original. Los datos de usuarios NO se ven afectados. ¿Continuar?',
  )
  if (!confirmed) return

  resetAllMockStores()
  window.location.reload()
}

export function DevResetMocksPage() {
  return (
    <div className="min-h-screen bg-canvas p-8 dark:bg-surface-dark">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-xl font-medium text-ink dark:text-on-dark">
            Reset de stores mock (dev-only)
          </h1>
          <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">
            Página de desarrollo. No forma parte del flujo de producción.
          </p>
        </header>

        <section className="space-y-3 rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated">
          <p className="text-sm text-body dark:text-on-dark">
            Reinicia a su estado de fixtures original los stores mock de: Documentos, Quality
            Events, No Conformidades, Incidentes y Locales/Zonas. La sesión activa se mantiene —
            no cierra el login actual. El store de usuarios (alta/edición/baja desde{' '}
            <code>/usuarios</code>) queda excluido a propósito.
          </p>

          <button
            type="button"
            onClick={handleReset}
            className="rounded-md bg-error px-5 py-3 text-sm font-medium text-white"
          >
            Reiniciar stores mock
          </button>
        </section>
      </div>
    </div>
  )
}
