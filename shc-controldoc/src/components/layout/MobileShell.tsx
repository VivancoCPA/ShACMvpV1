import { Outlet } from 'react-router-dom'
import { useDarkMode } from '../../hooks/useDarkMode'
import { useOfflineIncidentSync } from '../../features/incidents/hooks/useOfflineIncidentSync'
import { SyncQueueBadge } from '../../features/incidents/components/SyncQueueBadge'

/**
 * Layout mobile-first de una columna para rutas bajo `/m/*`. Hermano de
 * `AppShell` en el router (no hijo) — sin Sidebar ni TopNav de escritorio.
 * Llama `useDarkMode()` directamente porque `AppShell` no se monta en este
 * árbol de rutas.
 *
 * Monta `useOfflineIncidentSync()` una sola vez aquí (no en el formulario)
 * para que los listeners de sincronización de la cola offline vivan mientras
 * el usuario está en cualquier vista bajo `/m/*`, no solo en el formulario de
 * reporte de incidentes (m7-f2-indicador-offline design.md D2). El formulario
 * ya no invoca el hook — llama directamente a `notifyIncidentEnqueued()`
 * (`offlineQueueStore.ts`), que se apoya en el ciclo de sync registrado por
 * esta única instancia del hook, sin duplicar sus listeners.
 */
export function MobileShell() {
  useDarkMode()
  const { retry } = useOfflineIncidentSync()

  return (
    <div className="min-h-screen bg-canvas dark:bg-surface-dark">
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas dark:border-hairline/20 dark:bg-surface-dark">
        <div className="mx-auto flex h-12 w-full max-w-md items-center justify-end px-4">
          <SyncQueueBadge onRetry={(localId) => void retry(localId)} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
